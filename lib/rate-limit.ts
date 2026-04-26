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

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

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

export function takeRateLimitToken(options: RateLimitOptions): RateLimitResult {
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
