import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getProcessorProvider } from "@/lib/processor/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { secureCompare } from "@/lib/security";
import { optionalHttpUrlSchema, requestExceedsBytes, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";
import { finalizePersistentWebhookEvent, reservePersistentWebhookEvent } from "@/lib/webhook-ledger";
import { logServerError } from "@/lib/secure-log";
import { sendOperationalAlert } from "@/lib/monitoring";

const maxProcessorWebhookBytes = 64 * 1024;
const processorWebhookResultSchema = z
  .object({
    externalJobId: z.string().trim().max(255).nullable().optional(),
    jobId: strictUuidSchema.nullable().optional(),
    status: z.enum(["draft", "queued", "processing", "rendering", "completed", "failed"]),
    progress: z.number().int().min(0).max(100).nullable().optional(),
    outputVideoUrl: optionalHttpUrlSchema.nullable().optional(),
    errorMessage: singleLineTextSchema({ max: 600, tooLongMessage: "Error text is too long." }).nullable().optional()
  })
  .strict();

export async function POST(request: Request) {
  let ledgerId: string | null = null;
  let targetId: string | null = null;
  const limiter = await enforceRateLimit({
    request,
    bucket: "webhook:processor",
    limit: 180,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Too many requests." }, { status: 429 }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  if (requestExceedsBytes(request, maxProcessorWebhookBytes)) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Request rejected." }, { status: 413 }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const secret = getEnv("N8N_PROCESSOR_SECRET");
  const incoming = request.headers.get("x-processor-secret");

  if (!secureCompare(secret, incoming)) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const payload = await request.json().catch(() => null);
  const payloadText = JSON.stringify(payload ?? {});
  const reservation = await reservePersistentWebhookEvent({
    source: "processor",
    payload: payloadText,
    ttlSeconds: 7 * 24 * 60 * 60
  });
  ledgerId = "ledgerId" in reservation ? reservation.ledgerId ?? null : null;
  if (!reservation.reserved) {
    return applyRateLimitHeaders(NextResponse.json({ received: true, duplicate: true, store: reservation.store }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const provider = getProcessorProvider();
  const parsedResult = provider.parseWebhook ? await provider.parseWebhook(payload) : null;
  const parsed = processorWebhookResultSchema.safeParse(parsedResult);

  if (!parsed.success) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const admin = createSupabaseAdminClient();
  targetId = parsed.data.jobId ?? null;

  if (!targetId && parsed.data.externalJobId) {
    const lookup = await admin.from("video_jobs").select("id").eq("n8n_execution_id", parsed.data.externalJobId).maybeSingle();
    targetId = lookup.data?.id ?? null;
  }

  if (!targetId) {
    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "skipped",
      metadata: { provider: provider.key, reason: "missing_target_job", external_job_id: parsed.data.externalJobId ?? null }
    });
    return applyRateLimitHeaders(NextResponse.json({ received: true, skipped: true }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const update = await admin
    .from("video_jobs")
    .update({
      status: parsed.data.status,
      progress: parsed.data.progress ?? undefined,
      output_asset_path: parsed.data.outputVideoUrl ?? undefined,
      error_message: parsed.data.errorMessage ?? undefined,
      updated_at: new Date().toISOString()
    })
    .eq("id", targetId);

  if (update.error) {
    logServerError("Processor webhook update failed", { reason: update.error.message, targetId, provider: provider.key });
    await sendOperationalAlert({
      code: "processor-webhook-update-failed",
      severity: "critical",
      summary: "The processor webhook could not update a video job.",
      dedupeKey: targetId,
      details: { targetId, provider: provider.key, externalJobId: parsed.data.externalJobId ?? null }
    });
    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "failed",
      metadata: { provider: provider.key, target_id: targetId, external_job_id: parsed.data.externalJobId ?? null },
      errorMessage: update.error.message
    });
    return applyRateLimitHeaders(NextResponse.json({ error: "Webhook processing failed." }, { status: 500 }), {
      limit: 180,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  await logAuditEvent({
    targetType: "video_job",
    targetId,
    action: "processor.webhook_applied",
    metadata: buildRequestAuditMetadata(request, {
      provider: provider.key,
      status: parsed.data.status,
      external_job_id: parsed.data.externalJobId ?? null,
      store: reservation.store
    })
  });

  await finalizePersistentWebhookEvent({
    ledgerId,
    status: "processed",
    metadata: {
      provider: provider.key,
      target_id: targetId,
      external_job_id: parsed.data.externalJobId ?? null,
      status: parsed.data.status
    }
  });

  if (parsed.data.status === "failed") {
    await sendOperationalAlert({
      code: "processor-job-failed",
      severity: "warning",
      summary: "A processor webhook reported a failed job.",
      dedupeKey: targetId,
      details: { targetId, provider: provider.key, externalJobId: parsed.data.externalJobId ?? null }
    });
  }

  return applyRateLimitHeaders(NextResponse.json({ ok: true }), {
    limit: 180,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
