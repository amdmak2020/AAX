import { NextResponse } from "next/server";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";
import { sendOperationalAlert } from "@/lib/monitoring";

const maxAuthRequestBytes = 16 * 1024;

function getAuthOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return url.origin;
}

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxAuthRequestBytes)) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in payload is too large.")}`, request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Your session expired. Refresh and try again.")}`, request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["next", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Unexpected sign-in fields were submitted.")}`, request.url), { status: 303 });
  }

  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");
  const limiter = await enforceRateLimit({
    request,
    bucket: "auth:google",
    limit: 12,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    await sendOperationalAlert({
      code: "auth-google-rate-limited",
      severity: "warning",
      summary: "Google sign-in start hit the abuse limiter.",
      dedupeKey: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Too many sign-in attempts. Please try again shortly.")}`, request.url), {
        status: 303
      }),
      { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const authOrigin = getAuthOrigin(request);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${authOrigin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error || !data.url) {
    await logAuditEvent({
      targetType: "auth_oauth",
      targetId: "google",
      action: "auth.google_start_failed",
      metadata: buildRequestAuditMetadata(request)
    });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in is temporarily unavailable. Try again in a moment.")}`, request.url), {
        status: 303
      }),
      {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      }
    );
  }

  await logAuditEvent({
    targetType: "auth_oauth",
    targetId: "google",
    action: "auth.google_start_succeeded",
    metadata: buildRequestAuditMetadata(request)
  });

  return applyRateLimitHeaders(NextResponse.redirect(data.url, { status: 303 }), {
    limit: 12,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
