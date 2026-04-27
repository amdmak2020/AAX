import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";
import { logServerError } from "@/lib/secure-log";

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long."),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });
const maxAuthRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxAuthRequestBytes)) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Password update payload is too large.")}`, request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Your session expired. Refresh and try again.")}`, request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["password", "confirmPassword", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Unexpected password fields were submitted.")}`, request.url), { status: 303 });
  }

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
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logServerError("Password update failed", { reason: error.message, userId: user?.id ?? null });
    return applyRateLimitHeaders(
      NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Could not update password right now.")}`, request.url), { status: 303 }),
      { limit: 10, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  await logAuditEvent({
    actorUserId: user?.id ?? null,
    targetType: "auth_user",
    targetId: user?.id ?? "unknown",
    action: "auth.password_updated",
    metadata: buildRequestAuditMetadata(request)
  });

  return applyRateLimitHeaders(NextResponse.redirect(new URL("/login?reset=success", request.url), { status: 303 }), {
    limit: 10,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
