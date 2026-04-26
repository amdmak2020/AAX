import { NextResponse } from "next/server";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { getLemonSqueezyVariantId, getLemonSqueezyWebhookSecret } from "@/lib/env";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LemonSqueezyWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      customer_id?: string | number;
      variant_id?: string | number;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      cancelled?: boolean;
      user_email?: string | null;
    };
  };
};

function mapVariantToPlanKey(variantId: string | number | null | undefined): PlanKey {
  const normalized = variantId ? String(variantId) : null;

  const map = {
    [getLemonSqueezyVariantId("creator") ?? ""]: "creator",
    [getLemonSqueezyVariantId("pro") ?? ""]: "pro",
    [getLemonSqueezyVariantId("business") ?? ""]: "business"
  } as const;

  return normalized && map[normalized as keyof typeof map] ? map[normalized as keyof typeof map] : "free";
}

function normalizeStatus(eventName: string | undefined, status: string | null | undefined) {
  if (eventName === "subscription_expired") return "expired";
  if (eventName === "subscription_cancelled") return "cancelled";
  if (eventName === "subscription_paused") return "paused";
  if (eventName === "subscription_unpaused" || eventName === "subscription_resumed") return "active";
  return status ?? "active";
}

export async function POST(request: Request) {
  const secret = getLemonSqueezyWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Missing LEMONSQUEEZY_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("X-Signature");
  const payloadText = await request.text();

  if (!verifyLemonSqueezySignature(payloadText, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const payload = JSON.parse(payloadText) as LemonSqueezyWebhookPayload;
  const eventName = payload.meta?.event_name;
  const dataType = payload.data?.type ?? null;
  const subscriptionId = payload.data?.id ?? null;
  const attributes = payload.data?.attributes;

  if (dataType === "subscription-invoices") {
    return NextResponse.json({ received: true, skipped: true });
  }

  const customerId = attributes?.customer_id ? String(attributes.customer_id) : null;
  const planKey = mapVariantToPlanKey(attributes?.variant_id);
  const status = normalizeStatus(eventName, attributes?.status);
  const currentPeriodEnd = attributes?.renews_at ?? attributes?.ends_at ?? null;

  let userId = payload.meta?.custom_data?.user_id ?? null;

  if (!userId && customerId) {
    const admin = createSupabaseAdminClient();
    const existing = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = existing.data?.user_id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ received: true, skipped: true });
  }

  await updateSubscriptionPlan({
    userId,
    customerId,
    subscriptionId,
    planKey,
    status,
    creditsTotal: planCatalog[planKey].monthlyCredits,
    currentPeriodEnd
  });

  return NextResponse.json({ received: true });
}
