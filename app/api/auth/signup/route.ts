import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit, normalizeEmail } from "@/lib/request-security";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, requestExceedsBytes, singleLineTextSchema } from "@/lib/validation";

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
  const unexpectedFields = getUnexpectedFormFields(formData, ["name", "email", "password", "next"]);
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
