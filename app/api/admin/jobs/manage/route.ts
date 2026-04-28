import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole, isEmailVerified, isRecentlyAuthenticated } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getCurrentProfileOptional } from "@/lib/authz";
import { refundReservedCreditForJob } from "@/lib/credits";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUnexpectedFormFields, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";

const schema = z
  .object({
    jobId: strictUuidSchema,
    action: z.enum(["cancel_job", "refund_credit"]),
    reason: singleLineTextSchema({ max: 160, tooLongMessage: "Keep the reason under 160 characters." })
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
    bucket: "admin:job-manage",
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

  const unexpectedFields = getUnexpectedFormFields(formData, ["jobId", "action", "reason", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return applyRateLimitHeaders(redirectToAdmin(request, "unexpected_fields"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const parsed = schema.safeParse({
    jobId: formData.get("jobId")?.toString(),
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
  const jobResult = await admin.from("video_jobs").select("id,user_id,status").eq("id", parsed.data.jobId).maybeSingle();
  if (jobResult.error || !jobResult.data) {
    logServerError("Admin job lookup failed", { reason: jobResult.error?.message ?? "missing", jobId: parsed.data.jobId });
    return applyRateLimitHeaders(redirectToAdmin(request, "update_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  if (parsed.data.action === "cancel_job") {
    const update = await admin
      .from("video_jobs")
      .update({
        status: "failed",
        error_message: `Cancelled by admin: ${parsed.data.reason}`,
        progress: 0,
        updated_at: new Date().toISOString()
      })
      .eq("id", parsed.data.jobId);

    if (update.error) {
      logServerError("Admin cancel job failed", { reason: update.error.message, jobId: parsed.data.jobId });
      return applyRateLimitHeaders(redirectToAdmin(request, "update_failed"), {
        limit: 30,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    await refundReservedCreditForJob({
      jobId: parsed.data.jobId,
      userId: jobResult.data.user_id,
      reason: "admin_cancelled",
      request,
      actorUserId: profile.id,
      note: parsed.data.reason
    });
  } else {
    await refundReservedCreditForJob({
      jobId: parsed.data.jobId,
      userId: jobResult.data.user_id,
      reason: "manual_refund",
      request,
      actorUserId: profile.id,
      note: parsed.data.reason
    });
  }

  await logAuditEvent({
    actorUserId: profile.id,
    targetType: "video_job",
    targetId: parsed.data.jobId,
    action: `admin.job.${parsed.data.action}`,
    metadata: buildRequestAuditMetadata(request, { reason: parsed.data.reason })
  });

  return applyRateLimitHeaders(redirectToAdmin(request, "updated"), {
    limit: 30,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
