import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resetSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email"));
  const parsed = resetSchema.safeParse({ email });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(parsed.error.flatten().formErrors[0] ?? "Email is required.")}`, request.url),
      { status: 303 }
    );
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "auth:reset",
    key: `${parsed.data.email}:${request.headers.get("user-agent") ?? ""}`,
    limit: 5,
    windowMs: 30 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(
      NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent("Too many reset requests. Please wait a bit before trying again.")}`, request.url),
        { status: 303 }
      ),
      { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/update-password`
  });

  if (error) {
    console.error("Password reset request failed", error);
  }

  return applyRateLimitHeaders(
    NextResponse.redirect(new URL(`/forgot-password?sent=1&email=${encodeURIComponent(parsed.data.email)}`, request.url), { status: 303 }),
    { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
  );
}
