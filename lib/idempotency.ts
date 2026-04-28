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

function digestValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function reserveInUpstash(key: string, ttlSeconds: number) {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    return null;
  }

  const response = await fetch(`${url}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([["SET", key, "1", "NX", "EX", String(ttlSeconds)]]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash idempotency request failed with ${response.status}.`);
  }

  const payload = (await response.json().catch(() => null)) as Array<{ result?: string | null; error?: string }> | null;
  const firstResult = Array.isArray(payload) ? payload[0] : null;

  if (!firstResult || firstResult.error) {
    throw new Error(firstResult?.error ?? "Upstash idempotency response was invalid.");
  }

  return firstResult.result === "OK";
}

export async function reserveIdempotencyKey(options: {
  scope: string;
  key: string;
  ttlSeconds: number;
}) {
  const scopedKey = `idem:${options.scope}:${digestValue(options.key)}`;

  if (hasUpstashRateLimitConfig()) {
    const reserved = await reserveInUpstash(scopedKey, options.ttlSeconds);
    if (reserved !== null) {
      return { reserved, store: "upstash" as const, key: scopedKey };
    }
  }

  cleanupMemoryLedger();
  const current = memoryLedger.get(scopedKey);
  if (current && current > Date.now()) {
    return { reserved: false, store: "memory" as const, key: scopedKey };
  }

  memoryLedger.set(scopedKey, Date.now() + options.ttlSeconds * 1000);
  return { reserved: true, store: "memory" as const, key: scopedKey };
}
