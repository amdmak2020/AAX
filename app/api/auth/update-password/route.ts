import { NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long."),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const parsed = updatePasswordSchema.safeParse({ password, confirmPassword });

  if (!parsed.success) {
    const formErrors = parsed.error.flatten();
    const message =
      formErrors.formErrors[0] ?? formErrors.fieldErrors.password?.[0] ?? formErrors.fieldErrors.confirmPassword?.[0] ?? "Could not update password.";
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "auth:update-password",
    limit: 10,
    windowMs: 30 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Too many password update attempts. Please wait a little and try again.")}`, request.url), {
        status: 303
      }),
      { limit: 10, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent(error.message)}`, request.url), { status: 303 }),
      { limit: 10, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  return applyRateLimitHeaders(NextResponse.redirect(new URL("/login?reset=success", request.url), { status: 303 }), {
    limit: 10,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
