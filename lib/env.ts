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

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function hasPaddleApiKey() {
  return Boolean(process.env.PADDLE_API_KEY);
}

export function hasPaddleCheckoutConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
      process.env.PADDLE_CREATOR_PRICE_ID &&
      process.env.PADDLE_PRO_PRICE_ID &&
      process.env.PADDLE_BUSINESS_PRICE_ID
  );
}

export function getPaddlePriceId(planKey: Exclude<PlanKey, "free">) {
  const priceIds = {
    creator: process.env.PADDLE_CREATOR_PRICE_ID,
    pro: process.env.PADDLE_PRO_PRICE_ID,
    business: process.env.PADDLE_BUSINESS_PRICE_ID
  } as const;

  return priceIds[planKey] ?? null;
}

export function getStripePriceId(planKey: Exclude<PlanKey, "free">) {
  const priceIds = {
    creator: process.env.STRIPE_CREATOR_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
    business: process.env.STRIPE_BUSINESS_PRICE_ID
  } as const;

  return priceIds[planKey] ?? null;
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
