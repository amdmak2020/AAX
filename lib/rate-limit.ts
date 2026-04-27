type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type UpstashCommandResult = {
  result?: unknown;
  error?: string;
};

const RATE_LIMIT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}"
].join("\n");

declare global {
  // eslint-disable-next-line no-var
  var __aaxRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

function getStore() {
  if (!globalThis.__aaxRateLimitStore) {
    globalThis.__aaxRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return globalThis.__aaxRateLimitStore;
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

function normalizeRateLimitResult(currentCount: number, ttlMs: number, limit: number): RateLimitResult {
  const retryAfterSeconds = currentCount > limit ? Math.max(Math.ceil(ttlMs / 1000), 1) : 0;

  return {
    allowed: currentCount <= limit,
    remaining: Math.max(limit - currentCount, 0),
    retryAfterSeconds,
    resetAt: Date.now() + Math.max(ttlMs, 0)
  };
}

function takeMemoryRateLimitToken(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const cacheKey = `${options.bucket}:${options.key}`;
  const current = store.get(cacheKey);

  if (!current || current.resetAt <= now) {
    const next: RateLimitBucket = {
      count: 1,
      resetAt: now + options.windowMs
    };
    store.set(cacheKey, next);

    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      retryAfterSeconds: 0,
      resetAt: next.resetAt
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
      resetAt: current.resetAt
    };
  }

  current.count += 1;
  store.set(cacheKey, current);

  return {
    allowed: true,
    remaining: Math.max(options.limit - current.count, 0),
    retryAfterSeconds: 0,
    resetAt: current.resetAt
  };
}

async function takeUpstashRateLimitToken(options: RateLimitOptions, config: { url: string; token: string }) {
  const cacheKey = `rate-limit:${options.bucket}:${options.key}`;
  const response = await fetch(`${config.url}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([["EVAL", RATE_LIMIT_SCRIPT, 1, cacheKey, String(options.windowMs)]])
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  const firstResult = Array.isArray(payload) ? (payload[0] as UpstashCommandResult | undefined) : undefined;

  if (!firstResult || firstResult.error) {
    throw new Error(firstResult?.error ?? "Upstash rate limit response was invalid.");
  }

  const resultTuple = Array.isArray(firstResult.result) ? firstResult.result : null;
  const currentCount = Number(resultTuple?.[0]);
  const ttlMs = Number(resultTuple?.[1]);

  if (!Number.isFinite(currentCount) || !Number.isFinite(ttlMs)) {
    throw new Error("Upstash rate limit payload did not return count/ttl.");
  }

  return normalizeRateLimitResult(currentCount, ttlMs, options.limit);
}

export async function takeRateLimitToken(options: RateLimitOptions): Promise<RateLimitResult> {
  const config = getUpstashConfig();

  if (!config) {
    return takeMemoryRateLimitToken(options);
  }

  try {
    return await takeUpstashRateLimitToken(options, config);
  } catch (error) {
    console.error("Falling back to in-memory rate limit store", error);
    return takeMemoryRateLimitToken(options);
  }
}
