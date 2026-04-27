import crypto from "node:crypto";
import { getEnv, hasUpstashRateLimitConfig } from "@/lib/env";

const memoryLedger = new Map<string, number>();

function cleanupMemoryLedger() {
  const now = Date.now();
  for (const [key, expiresAt] of memoryLedger.entries()) {
    if (expiresAt <= now) {
      memoryLedger.delete(key);
    }
  }
}

function digestPayload(payload: string) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function reserveInUpstash(key: string, ttlSeconds: number) {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    return null;
  }

  const endpoint = `${url}/set/${encodeURIComponent(key)}/1?NX=true&EX=${ttlSeconds}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash idempotency request failed with ${response.status}.`);
  }

  const json = (await response.json().catch(() => null)) as { result?: string | null } | null;
  return json?.result === "OK";
}

export async function reserveWebhookDelivery(options: {
  source: string;
  payload: string;
  ttlSeconds: number;
}) {
  const digest = digestPayload(options.payload);
  const key = `webhook:${options.source}:${digest}`;

  if (hasUpstashRateLimitConfig()) {
    const reserved = await reserveInUpstash(key, options.ttlSeconds);
    if (reserved !== null) {
      return { reserved, store: "upstash" as const, key };
    }
  }

  cleanupMemoryLedger();
  const current = memoryLedger.get(key);
  if (current && current > Date.now()) {
    return { reserved: false, store: "memory" as const, key };
  }

  memoryLedger.set(key, Date.now() + options.ttlSeconds * 1000);
  return { reserved: true, store: "memory" as const, key };
}
