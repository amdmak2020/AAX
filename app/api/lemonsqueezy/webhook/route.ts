import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { getLemonSqueezyVariantId, getLemonSqueezyWebhookSecret } from "@/lib/env";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestExceedsBytes, strictUuidSchema } from "@/lib/validation";

const maxLemonWebhookBytes = 256 * 1024;
const stringOrNumberSchema = z.union([z.string(), z.number()]);
const lemonWebhookSchema = z
  .object({
    meta: z
      .object({
        event_name: z.string().trim().max(80).optional(),
        custom_data: z
          .object({
            user_id: strictUuidSchema.optional(),
            plan_name: z.string().trim().max(80).optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    data: z
      .object({
        id: stringOrNumberSchema.optional(),
        type: z.string().trim().max(80).optional(),
        attributes: z
          .object({
            customer_id: stringOrNumberSchema.optional(),
            variant_id: stringOrNumberSchema.optional(),
            status: z.string().trim().max(80).optional(),
            renews_at: z.string().trim().max(80).nullable().optional(),
            ends_at: z.string().trim().max(80).nullable().optional(),
            cancelled: z.boolean().optional(),
            user_email: z.string().email().max(320).nullable().optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

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
  if (eventName === "subscription_payment_failed") return "past_due";
  if (eventName === "subscription_payment_recovered") return "active";
  if (eventName === "subscription_unpaused" || eventName === "subscription_resumed") return "active";
  return status ?? "active";
}

export async function POST(request: Request) {
  try {
    if (requestExceedsBytes(request, maxLemonWebhookBytes)) {
      return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
    }

    const secret = getLemonSqueezyWebhookSecret();
    if (!secret) {
      return NextResponse.json({ error: "Missing LEMONSQUEEZY_WEBHOOK_SECRET" }, { status: 500 });
    }

    const signature = request.headers.get("X-Signature");
    const payloadText = await request.text();

    if (!verifyLemonSqueezySignature(payloadText, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const rawPayload = JSON.parse(payloadText) as unknown;
    const parsed = lemonWebhookSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid Lemon Squeezy webhook payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const eventName = payload.meta?.event_name;
    const dataType = payload.data?.type ?? null;
    const subscriptionId = payload.data?.id ? String(payload.data.id) : null;
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
  } catch (error) {
    console.error("Lemon Squeezy webhook error", error);
    const message = error instanceof Error ? error.message : "Unknown Lemon Squeezy webhook failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
