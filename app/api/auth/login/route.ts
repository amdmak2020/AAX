import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailVerified } from "@/lib/access-control";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
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
  const unexpectedFields = getUnexpectedFormFields(formData, ["email", "password", "next"]);
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
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Too many login attempts. Try again in a few minutes.")}`, request.url), {
        status: 303
      }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });

  if (error) {
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("We couldn't sign you in with those details.")}`, request.url), { status: 303 }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(parsed.data.email)}&pending=1`, request.url), { status: 303 }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  return applyRateLimitHeaders(NextResponse.redirect(new URL(next, request.url), { status: 303 }), {
    limit: 8,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
