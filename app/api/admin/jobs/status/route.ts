import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole, isEmailVerified, isRecentlyAuthenticated } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { refundReservedCreditForJob } from "@/lib/credits";
import { getCurrentProfileOptional } from "@/lib/authz";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalHttpUrlSchema, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";

const schema = z.object({
  jobId: strictUuidSchema,
  status: z.enum(["draft", "queued", "processing", "rendering", "completed", "failed"]),
  outputVideoUrl: optionalHttpUrlSchema.optional(),
  errorMessage: singleLineTextSchema({ max: 600, tooLongMessage: "Keep the error message under 600 characters." }).optional()
}).strict();

export async function POST(request: Request) {
  const profile = await getCurrentProfileOptional();
  if (!profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRole(profile.role, "admin")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!isEmailVerified(profile) || !isRecentlyAuthenticated(profile)) {
    return NextResponse.json({ error: "Admin re-authentication required." }, { status: 403 });
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "admin:job-status",
    key: profile.id,
    limit: 60,
    windowMs: 5 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Too many admin status updates. Try again shortly." }, { status: 429 }), {
      limit: 60,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  const csrfCheck = await verifyCsrfRequest(request);
  if (!csrfCheck.ok) {
    return applyRateLimitHeaders(NextResponse.json({ error: "CSRF validation failed." }, { status: 403 }), {
      limit: 60,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Invalid admin status payload." }, { status: 400 }), {
      limit: 60,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const admin = createSupabaseAdminClient();
  const jobLookup = await admin.from("video_jobs").select("user_id").eq("id", parsed.data.jobId).maybeSingle();
  const { error } = await admin
    .from("video_jobs")
    .update({
      status: parsed.data.status,
      output_asset_path: parsed.data.outputVideoUrl || undefined,
      error_message: parsed.data.errorMessage ?? undefined,
      progress: parsed.data.status === "completed" ? 100 : parsed.data.status === "rendering" ? 80 : parsed.data.status === "processing" ? 40 : 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.jobId);

  if (error) {
    return applyRateLimitHeaders(NextResponse.json({ error: error.message }, { status: 500 }), {
      limit: 60,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  await logAuditEvent({
    actorUserId: profile.id,
    targetType: "video_job",
    targetId: parsed.data.jobId,
    action: "admin.job_status_updated",
    metadata: buildRequestAuditMetadata(request, { status: parsed.data.status })
  });

  if (parsed.data.status === "failed" && typeof jobLookup.data?.user_id === "string") {
    try {
      await refundReservedCreditForJob({
        jobId: parsed.data.jobId,
        userId: jobLookup.data.user_id,
        reason: "admin_cancelled",
        request,
        actorUserId: profile.id,
        note: parsed.data.errorMessage ?? "Marked failed by admin"
      });
    } catch {
      return applyRateLimitHeaders(NextResponse.json({ error: "Admin refund processing failed." }, { status: 500 }), {
        limit: 60,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }
  }

  return applyRateLimitHeaders(NextResponse.json({ ok: true }), {
    limit: 60,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
