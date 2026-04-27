import { z } from "zod";
import { takeRateLimitToken } from "@/lib/rate-limit";

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function applyRateLimitHeaders(
  response: Response,
  details: {
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds?: number;
    store?: "memory" | "upstash";
  }
) {
  response.headers.set("X-RateLimit-Limit", String(details.limit));
  response.headers.set("X-RateLimit-Remaining", String(details.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(details.resetAt / 1000)));
  if (details.store) {
    response.headers.set("X-RateLimit-Store", details.store);
  }

  if (details.retryAfterSeconds && details.retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(details.retryAfterSeconds));
  }

  return response;
}

export async function enforceRateLimit(options: {
  request: Request;
  bucket: string;
  key?: string | null;
  limit: number;
  windowMs: number;
}) {
  const baseKey = options.key?.trim() || getClientIp(options.request);
  return await takeRateLimitToken({
    bucket: options.bucket,
    key: baseKey,
    limit: options.limit,
    windowMs: options.windowMs
  });
}

const emailSchema = z.string().trim().email().max(320);

export function normalizeEmail(input: FormDataEntryValue | null | undefined) {
  const value = input?.toString() ?? "";
  const parsed = emailSchema.safeParse(value.toLowerCase());
  return parsed.success ? parsed.data : null;
}
