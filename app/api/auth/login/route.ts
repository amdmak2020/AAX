import { NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

export async function POST(request: Request) {
  const formData = await request.formData();
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

  const limiter = enforceRateLimit({
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
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });

  if (error) {
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url), { status: 303 }),
      { limit: 8, remaining: limiter.remaining, resetAt: limiter.resetAt }
    );
  }

  return applyRateLimitHeaders(NextResponse.redirect(new URL(next, request.url), { status: 303 }), {
    limit: 8,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt
  });
}
