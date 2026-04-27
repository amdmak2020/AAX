import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";

const maxAuthRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxAuthRequestBytes)) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in payload is too large.")}`, request.url), { status: 303 });
  }

  const formData = await request.formData();
  const unexpectedFields = getUnexpectedFormFields(formData, ["next"]);
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
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Too many sign-in attempts. Please try again shortly.")}`, request.url), {
        status: 303
      }),
      { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error || !data.url) {
    return applyRateLimitHeaders(NextResponse.json({ error: error?.message ?? "Could not start Google sign in." }, { status: 400 }), {
      limit: 12,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  return applyRateLimitHeaders(NextResponse.redirect(data.url, { status: 303 }), {
    limit: 12,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
