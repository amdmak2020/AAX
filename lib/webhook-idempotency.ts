import crypto from "node:crypto";
import { reserveIdempotencyKey } from "@/lib/idempotency";

function digestPayload(payload: string) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function reserveWebhookDelivery(options: {
  source: string;
  payload: string;
  ttlSeconds: number;
  eventId?: string | null;
}) {
  const keyMaterial = options.eventId?.trim() || digestPayload(options.payload);
  return reserveIdempotencyKey({
    scope: `webhook:${options.source}`,
    key: keyMaterial,
    ttlSeconds: options.ttlSeconds
  });
}
