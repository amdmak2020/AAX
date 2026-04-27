import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getProcessorProvider } from "@/lib/processor/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security";
import { optionalHttpUrlSchema, requestExceedsBytes, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";
import { finalizePersistentWebhookEvent, reservePersistentWebhookEvent } from "@/lib/webhook-ledger";

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

  if (requestExceedsBytes(request, maxProcessorWebhookBytes)) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const secret = getEnv("N8N_PROCESSOR_SECRET");
  const incoming = request.headers.get("x-processor-secret");

  if (!secureCompare(secret, incoming)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ received: true, duplicate: true, store: reservation.store });
  }

  const provider = getProcessorProvider();
  const parsedResult = provider.parseWebhook ? await provider.parseWebhook(payload) : null;
  const parsed = processorWebhookResultSchema.safeParse(parsedResult);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid processor webhook payload." }, { status: 400 });
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
    return NextResponse.json({ error: "Could not resolve target job." }, { status: 400 });
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
    console.error("Processor webhook update failed", update.error);
    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "failed",
      metadata: { provider: provider.key, target_id: targetId, external_job_id: parsed.data.externalJobId ?? null },
      errorMessage: update.error.message
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
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

  return NextResponse.json({ ok: true });
}
