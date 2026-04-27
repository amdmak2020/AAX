import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailVerified } from "@/lib/access-control";
import { buildRequestAuditMetadata, hashAuditIdentifier, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { sendOperationalAlert } from "@/lib/monitoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
}).strict();
const maxAuthRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxAuthRequestBytes)) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Login payload is too large.")}`, request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Your session expired. Refresh and try again.")}`, request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["email", "password", "next", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Unexpected login fields were submitted.")}`, request.url), { status: 303 });
  }

  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password")?.toString() ?? "";
  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");
  const parsed = loginSchema.safeParse({ email, password });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(parsed.error.flatten().formErrors[0] ?? "Email and password are required.")}`, request.url),
      { status: 303 }
    );
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "auth:login",
    key: `${email}:${request.headers.get("user-agent") ?? ""}`,
    limit: 8,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    await sendOperationalAlert({
      code: "auth-login-rate-limited",
      severity: "warning",
      summary: "Repeated login failures triggered the per-identity limiter.",
      dedupeKey: parsed.data.email,
      details: { scope: "identity", emailHash: hashAuditIdentifier(parsed.data.email) }
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Too many login attempts. Try again in a few minutes.")}`, request.url), {
        status: 303
      }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const ipLimiter = await enforceRateLimit({
    request,
    bucket: "auth:login:ip",
    limit: 25,
    windowMs: 30 * 60 * 1000
  });

  if (!ipLimiter.allowed) {
    await sendOperationalAlert({
      code: "auth-login-ip-rate-limited",
      severity: "warning",
      summary: "Repeated login failures triggered the per-IP limiter.",
      dedupeKey: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
      details: { scope: "ip" }
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Too many login attempts. Try again in a few minutes.")}`, request.url), {
        status: 303
      }),
      { limit: 25, remaining: ipLimiter.remaining, resetAt: ipLimiter.resetAt, retryAfterSeconds: ipLimiter.retryAfterSeconds, store: ipLimiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });

  if (error) {
    await logAuditEvent({
      targetType: "auth_email",
      targetId: hashAuditIdentifier(parsed.data.email) ?? "unknown",
      action: "auth.login_failed",
      metadata: buildRequestAuditMetadata(request, { reason: "invalid_credentials" })
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("We couldn't sign you in with those details.")}`, request.url), { status: 303 }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    await logAuditEvent({
      actorUserId: data.user.id,
      targetType: "auth_user",
      targetId: data.user.id,
      action: "auth.login_blocked_unverified",
      metadata: buildRequestAuditMetadata(request)
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(parsed.data.email)}&pending=1`, request.url), { status: 303 }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  await logAuditEvent({
    actorUserId: data.user.id,
    targetType: "auth_user",
    targetId: data.user.id,
    action: "auth.login_succeeded",
    metadata: buildRequestAuditMetadata(request)
  });

  return applyRateLimitHeaders(NextResponse.redirect(new URL(next, request.url), { status: 303 }), {
    limit: 8,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
