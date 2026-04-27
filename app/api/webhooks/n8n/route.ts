import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { statusLabels } from "@/lib/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { secureCompare } from "@/lib/security";
import { optionalHttpUrlSchema, requestExceedsBytes, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";
import { finalizePersistentWebhookEvent, reservePersistentWebhookEvent } from "@/lib/webhook-ledger";

const maxWebhookBytes = 64 * 1024;
const n8nWebhookSchema = z
  .object({
    jobId: strictUuidSchema,
    status: z.enum(Object.keys(statusLabels) as [keyof typeof statusLabels, ...(keyof typeof statusLabels)[]]),
    progress: z.number().int().min(0).max(100).optional(),
    outputUrl: optionalHttpUrlSchema.optional(),
    output_asset_path: optionalHttpUrlSchema.optional(),
    error: singleLineTextSchema({ max: 600, tooLongMessage: "Error text is too long." }).optional(),
    error_message: singleLineTextSchema({ max: 600, tooLongMessage: "Error text is too long." }).optional(),
    executionId: z.string().trim().max(255).optional(),
    n8n_execution_id: z.string().trim().max(255).optional()
  })
  .strict();

export async function POST(request: Request) {
  let ledgerId: string | null = null;

  if (requestExceedsBytes(request, maxWebhookBytes)) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const secret = getEnv("N8N_WEBHOOK_SECRET");
  const incoming = request.headers.get("x-shorts-machine-secret");

  if (!secureCompare(secret, incoming)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reservation = await reservePersistentWebhookEvent({
    source: "n8n",
    payload: JSON.stringify(body ?? {}),
    ttlSeconds: 7 * 24 * 60 * 60
  });
  ledgerId = "ledgerId" in reservation ? reservation.ledgerId ?? null : null;
  if (!reservation.reserved) {
    return NextResponse.json({ received: true, duplicate: true, store: reservation.store });
  }

  const parsed = n8nWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("video_jobs")
      .update({
        status: parsed.data.status,
        progress: parsed.data.progress ?? undefined,
        output_asset_path: parsed.data.outputUrl ?? parsed.data.output_asset_path ?? undefined,
        error_message: parsed.data.error ?? parsed.data.error_message ?? undefined,
        n8n_execution_id: parsed.data.executionId ?? parsed.data.n8n_execution_id ?? undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", parsed.data.jobId);

    if (error) {
      console.error("n8n webhook update failed", error);
      await finalizePersistentWebhookEvent({
        ledgerId,
        status: "failed",
        metadata: { provider: "n8n", job_id: parsed.data.jobId, status: parsed.data.status },
        errorMessage: error.message
      });
      return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
    }
  }

  await logAuditEvent({
    targetType: "video_job",
    targetId: parsed.data.jobId,
    action: "n8n.webhook_applied",
    metadata: buildRequestAuditMetadata(request, {
      status: parsed.data.status,
      execution_id: parsed.data.executionId ?? parsed.data.n8n_execution_id ?? null,
      store: reservation.store
    })
  });

  await finalizePersistentWebhookEvent({
    ledgerId,
    status: "processed",
    metadata: {
      provider: "n8n",
      job_id: parsed.data.jobId,
      status: parsed.data.status,
      execution_id: parsed.data.executionId ?? parsed.data.n8n_execution_id ?? null
    }
  });

  return NextResponse.json({ ok: true });
}
