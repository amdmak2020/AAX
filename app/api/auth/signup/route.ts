import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Add your name.").max(80, "Name is too long."),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long.")
});

export async function POST(request: Request) {
  const formData = await request.formData();
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
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("We couldn't create that account. Double-check the details or try signing in.")}`, request.url), { status: 303 }),
      { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  return applyRateLimitHeaders(
    NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(parsed.data.email)}`, request.url), { status: 303 }),
    { limit: 5, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
  );
}
