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

export function hasAppEncryptionKey() {
  return Boolean(process.env.APP_ENCRYPTION_KEY?.trim());
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getProcessorProviderKey() {
  return process.env.PROCESSOR_PROVIDER ?? "mock";
}

export function getN8nProcessorSecret() {
  return process.env.N8N_PROCESSOR_SECRET ?? process.env.N8N_WEBHOOK_SECRET ?? null;
}

export function getN8nProcessorEndpoint() {
  const raw = process.env.N8N_PROCESSOR_ENDPOINT?.trim() || process.env.N8N_WEBHOOK_URL?.trim() || null;
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.pathname.includes("/webhook-test/")) {
      url.pathname = url.pathname.replace("/webhook-test/", "/webhook/");
      return url.toString();
    }
  } catch {
    return raw;
  }

  return raw;
}

export function hasGumroadWebhookSecret() {
  return Boolean(process.env.GUMROAD_WEBHOOK_SECRET);
}

export function getGumroadSellerId() {
  return process.env.GUMROAD_SELLER_ID?.trim() ?? null;
}

export function hasGumroadWebhookAuth() {
  return Boolean(getGumroadWebhookSecret() || getGumroadSellerId());
}

export function getGumroadPortalUrl() {
  return process.env.GUMROAD_PORTAL_URL?.trim() || "https://app.gumroad.com/library";
}

export function hasGumroadCheckoutConfig() {
  return Boolean(
    process.env.GUMROAD_PRODUCT_URL ||
      (process.env.GUMROAD_CREATOR_PRODUCT_URL &&
        process.env.GUMROAD_PRO_PRODUCT_URL &&
        process.env.GUMROAD_BUSINESS_PRODUCT_URL)
  );
}

export function getGumroadProductUrl(planKey: Exclude<PlanKey, "free">) {
  const sharedUrl = process.env.GUMROAD_PRODUCT_URL?.trim();
  if (sharedUrl) {
    return sharedUrl;
  }

  const urls = {
    creator: process.env.GUMROAD_CREATOR_PRODUCT_URL,
    pro: process.env.GUMROAD_PRO_PRODUCT_URL,
    business: process.env.GUMROAD_BUSINESS_PRODUCT_URL
  } as const;

  return urls[planKey]?.trim() ?? null;
}

export function getGumroadProductId(planKey: Exclude<PlanKey, "free">) {
  const ids = {
    creator: process.env.GUMROAD_CREATOR_PRODUCT_ID,
    pro: process.env.GUMROAD_PRO_PRODUCT_ID,
    business: process.env.GUMROAD_BUSINESS_PRODUCT_ID
  } as const;

  return ids[planKey]?.trim() ?? null;
}

export function getGumroadWebhookSecret() {
  return process.env.GUMROAD_WEBHOOK_SECRET?.trim() ?? null;
}

export function getYouTubeClientId() {
  return process.env.YOUTUBE_CLIENT_ID?.trim() ?? null;
}

export function getYouTubeClientSecret() {
  return process.env.YOUTUBE_CLIENT_SECRET?.trim() ?? null;
}

export function hasYouTubeOAuthConfig() {
  return Boolean(getYouTubeClientId() && getYouTubeClientSecret() && hasAppEncryptionKey());
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
