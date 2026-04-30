import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { getEnv } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { hardenSupabaseCookieOptions } from "@/lib/supabase/cookies";
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

function createOAuthSupabaseClient(request: Request, pendingCookies: { name: string; value: string; options: CookieOptions }[]) {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.headers.get("cookie")
          ? request.headers
              .get("cookie")!
              .split(/;\s*/)
              .filter(Boolean)
              .map((pair) => {
                const index = pair.indexOf("=");
                return {
                  name: index >= 0 ? pair.slice(0, index) : pair,
                  value: index >= 0 ? pair.slice(index + 1) : ""
                };
              })
          : [];
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        pendingCookies.push(...cookiesToSet.map((cookie) => ({ ...cookie, options: hardenSupabaseCookieOptions(cookie.options) })));
      }
    }
  });
}

function attachPendingCookies(response: NextResponse, pendingCookies: { name: string; value: string; options: CookieOptions }[]) {
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
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

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createOAuthSupabaseClient(request, pendingCookies);
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
      attachPendingCookies(
        NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in is temporarily unavailable. Try again in a moment.")}`, request.url), {
          status: 303
        }),
        pendingCookies
      ),
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

  return applyRateLimitHeaders(
    attachPendingCookies(NextResponse.redirect(data.url, { status: 303 }), pendingCookies),
    {
      limit: 12,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    }
  );
}
