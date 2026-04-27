import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reserveWebhookDelivery } from "@/lib/webhook-idempotency";
import { logServerError } from "@/lib/secure-log";

type WebhookLedgerStatus = "processing" | "processed" | "failed" | "skipped";

function digestPayload(payload: string) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function buildDedupeKey(eventId: string | null | undefined, payload: string) {
  return eventId?.trim() || digestPayload(payload);
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("webhook_events") === true;
}

export async function reservePersistentWebhookEvent(options: {
  source: string;
  payload: string;
  ttlSeconds: number;
  eventId?: string | null;
  eventName?: string | null;
  targetUserId?: string | null;
}) {
  const dedupeKey = buildDedupeKey(options.eventId, options.payload);
  const payloadHash = digestPayload(options.payload);

  try {
    const admin = createSupabaseAdminClient();
    const insert = await admin
      .from("webhook_events")
      .insert({
        provider: options.source,
        dedupe_key: dedupeKey,
        event_id: options.eventId?.trim() || null,
        event_name: options.eventName?.trim() || null,
        payload_hash: payloadHash,
        target_user_id: options.targetUserId ?? null,
        status: "processing",
        metadata: {}
      })
      .select("id")
      .single();

    if (insert.data?.id) {
      return { reserved: true as const, store: "supabase", ledgerId: insert.data.id as string };
    }

    if (insert.error?.code === "23505") {
      const existing = await admin
        .from("webhook_events")
        .select("id,status,processing_attempts")
        .eq("provider", options.source)
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      const existingStatus = existing.data?.status;
      if (existing.data?.id && (existingStatus === "failed" || existingStatus === "received")) {
        const attempts = typeof existing.data.processing_attempts === "number" ? existing.data.processing_attempts + 1 : 2;
        await admin
          .from("webhook_events")
          .update({
            status: "processing",
            last_error: null,
            last_received_at: new Date().toISOString(),
            processing_attempts: attempts
          })
          .eq("id", existing.data.id);

        return { reserved: true as const, store: "supabase-retry", ledgerId: existing.data.id as string };
      }

      return { reserved: false as const, store: "supabase", ledgerId: existing.data?.id ?? null };
    }

    if (isMissingTableError(insert.error)) {
      return reserveWebhookDelivery({
        source: options.source,
        payload: options.payload,
        ttlSeconds: options.ttlSeconds,
        eventId: options.eventId
      });
    }

    throw new Error(insert.error?.message ?? "Could not reserve webhook event.");
  } catch (error) {
    logServerError("Webhook ledger reservation failed", { error, source: options.source });
    return reserveWebhookDelivery({
      source: options.source,
      payload: options.payload,
      ttlSeconds: options.ttlSeconds,
      eventId: options.eventId
    });
  }
}

export async function finalizePersistentWebhookEvent(input: {
  ledgerId?: string | null;
  status: WebhookLedgerStatus;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  if (!input.ledgerId) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const payload = {
      status: input.status,
      target_user_id: input.targetUserId ?? null,
      metadata: input.metadata ?? {},
      last_error: input.errorMessage ?? null,
      processed_at: input.status === "processed" || input.status === "skipped" ? new Date().toISOString() : null
    };

    const update = await admin.from("webhook_events").update(payload).eq("id", input.ledgerId);
    if (isMissingTableError(update.error)) {
      return;
    }
    if (update.error) {
      logServerError("Webhook ledger finalization failed", { reason: update.error.message, ledgerId: input.ledgerId, status: input.status });
    }
  } catch (error) {
    logServerError("Webhook ledger finalization failed", { error, ledgerId: input.ledgerId, status: input.status });
  }
}
