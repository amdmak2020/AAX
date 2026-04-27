import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRequestAuditMetadata, hashAuditIdentifier, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { getAppUrl } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, requestExceedsBytes, singleLineTextSchema } from "@/lib/validation";
import { sendOperationalAlert } from "@/lib/monitoring";

const signupSchema = z.object({
  name: singleLineTextSchema({ min: 2, max: 80, requiredMessage: "Add your name.", tooLongMessage: "Name is too long." }),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long.")
}).strict();
const maxAuthRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxAuthRequestBytes)) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Sign-up payload is too large.")}`, request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Your session expired. Refresh and try again.")}`, request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["name", "email", "password", "next", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Unexpected sign-up fields were submitted.")}`, request.url), { status: 303 });
  }

  const name = formData.get("name")?.toString() ?? "";
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password")?.toString() ?? "";
  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");
  const parsed = signupSchema.safeParse({ name, email, password });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(parsed.error.flatten().formErrors[0] ?? "Name, email, and password are required.")}`, request.url),
      { status: 303 }
    );
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "auth:signup",
    key: `${parsed.data.email}:${request.headers.get("user-agent") ?? ""}`,
    limit: 5,
    windowMs: 30 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Too many sign-up attempts. Please wait a bit and try again.")}`, request.url), {
        status: 303
      }),
      { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const ipLimiter = await enforceRateLimit({
    request,
    bucket: "auth:signup:ip",
    limit: 12,
    windowMs: 60 * 60 * 1000
  });

  if (!ipLimiter.allowed) {
    await sendOperationalAlert({
      code: "auth-signup-ip-rate-limited",
      severity: "warning",
      summary: "Repeated signup attempts triggered the per-IP limiter.",
      dedupeKey: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Too many sign-up attempts. Please wait a bit and try again.")}`, request.url), {
        status: 303
      }),
      { limit: 12, remaining: ipLimiter.remaining, resetAt: ipLimiter.resetAt, retryAfterSeconds: ipLimiter.retryAfterSeconds, store: ipLimiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    await logAuditEvent({
      targetType: "auth_email",
      targetId: hashAuditIdentifier(parsed.data.email) ?? "unknown",
      action: "auth.signup_failed",
      metadata: buildRequestAuditMetadata(request)
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("We couldn't create that account. Double-check the details or try signing in.")}`, request.url), { status: 303 }),
      { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  await logAuditEvent({
    actorUserId: error ? null : undefined,
    targetType: "auth_email",
    targetId: hashAuditIdentifier(parsed.data.email) ?? "unknown",
    action: "auth.signup_requested",
    metadata: buildRequestAuditMetadata(request, { email_verification: true })
  });

  return applyRateLimitHeaders(
    NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(parsed.data.email)}`, request.url), { status: 303 }),
    { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
  );
}
