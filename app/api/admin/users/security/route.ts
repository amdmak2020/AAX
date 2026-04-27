import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole, isEmailVerified, isRecentlyAuthenticated } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getCurrentProfileOptional } from "@/lib/authz";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUnexpectedFormFields, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";

const actionSchema = z
  .object({
    userId: strictUuidSchema,
    action: z.enum(["suspend_user", "resume_user", "lock_submissions", "unlock_submissions", "lock_billing", "unlock_billing", "flag_abuse", "clear_abuse"]),
    reason: singleLineTextSchema({ max: 160, tooLongMessage: "Keep the reason under 160 characters." }).optional()
  })
  .strict();

function redirectToAdmin(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/app/admin?notice=${encodeURIComponent(code)}`, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfileOptional();
  if (!profile) {
    return NextResponse.redirect(new URL(`/login?next=/app/admin`, request.url), { status: 303 });
  }

  if (!hasRole(profile.role, "admin") || !isEmailVerified(profile) || !isRecentlyAuthenticated(profile)) {
    return redirectToAdmin(request, "admin_access_required");
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "admin:user-security",
    key: profile.id,
    limit: 30,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(redirectToAdmin(request, "rate_limited"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return applyRateLimitHeaders(redirectToAdmin(request, "csrf_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["userId", "action", "reason", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return applyRateLimitHeaders(redirectToAdmin(request, "unexpected_fields"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const parsed = actionSchema.safeParse({
    userId: formData.get("userId")?.toString(),
    action: formData.get("action")?.toString(),
    reason: formData.get("reason")?.toString()
  });

  if (!parsed.success) {
    return applyRateLimitHeaders(redirectToAdmin(request, "invalid_admin_request"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const admin = createSupabaseAdminClient();
  const payloadBase = {
    updated_at: new Date().toISOString()
  } as Record<string, unknown>;

  switch (parsed.data.action) {
    case "suspend_user":
      payloadBase.is_suspended = true;
      payloadBase.suspended_reason = parsed.data.reason ?? "Suspended by admin";
      break;
    case "resume_user":
      payloadBase.is_suspended = false;
      payloadBase.suspended_reason = null;
      break;
    case "lock_submissions":
      payloadBase.submissions_locked = true;
      break;
    case "unlock_submissions":
      payloadBase.submissions_locked = false;
      break;
    case "lock_billing":
      payloadBase.billing_locked = true;
      break;
    case "unlock_billing":
      payloadBase.billing_locked = false;
      break;
    case "flag_abuse":
      payloadBase.abuse_flags = 1;
      break;
    case "clear_abuse":
      payloadBase.abuse_flags = 0;
      break;
  }

  const existing = await admin
    .from("profiles")
    .select("abuse_flags")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (existing.error) {
    logServerError("Admin user security lookup failed", { reason: existing.error.message, userId: parsed.data.userId });
    return applyRateLimitHeaders(redirectToAdmin(request, "update_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  if (parsed.data.action === "flag_abuse") {
    payloadBase.abuse_flags = Math.min(((existing.data?.abuse_flags as number | null) ?? 0) + 1, 9999);
  }

  const result = await admin.from("profiles").update(payloadBase).eq("id", parsed.data.userId);
  if (result.error) {
    logServerError("Admin user security update failed", { reason: result.error.message, userId: parsed.data.userId, action: parsed.data.action });
    return applyRateLimitHeaders(redirectToAdmin(request, "update_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  await logAuditEvent({
    actorUserId: profile.id,
    targetType: "profile",
    targetId: parsed.data.userId,
    action: `admin.user_security.${parsed.data.action}`,
    metadata: buildRequestAuditMetadata(request, { reason: parsed.data.reason ?? null })
  });

  return applyRateLimitHeaders(redirectToAdmin(request, "updated"), {
    limit: 30,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
