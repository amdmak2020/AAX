import type { PlanKey } from "@/lib/app-config";

export function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  return value;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getProcessorProviderKey() {
  return process.env.PROCESSOR_PROVIDER ?? "mock";
}

export function hasLemonSqueezyApiKey() {
  return Boolean(process.env.LEMONSQUEEZY_API_KEY);
}

export function getLemonSqueezyStoreId() {
  return process.env.LEMONSQUEEZY_STORE_ID ?? null;
}

export function getLemonSqueezyStoreUrl() {
  return process.env.LEMONSQUEEZY_STORE_URL ?? null;
}

export function hasLemonSqueezyCheckoutConfig() {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
      process.env.LEMONSQUEEZY_STORE_ID &&
      process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID &&
      process.env.LEMONSQUEEZY_PRO_VARIANT_ID &&
      process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID
  );
}

export function getLemonSqueezyVariantId(planKey: Exclude<PlanKey, "free">) {
  const variantIds = {
    creator: process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID,
    pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID,
    business: process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID
  } as const;

  return variantIds[planKey] ?? null;
}

export function getLemonSqueezyWebhookSecret() {
  return process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? null;
}

export function hasUpstashRateLimitConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function bypassUsageLimits() {
  const raw = process.env.BYPASS_USAGE_LIMITS?.trim().toLowerCase();

  if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") {
    return true;
  }

  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}
