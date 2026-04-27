import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { normalizeSubscriptionRow, type SubscriptionStatus, updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { getLemonSqueezyVariantId, getLemonSqueezyWebhookSecret } from "@/lib/env";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestExceedsBytes, strictUuidSchema } from "@/lib/validation";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { reserveWebhookDelivery } from "@/lib/webhook-idempotency";

const maxLemonWebhookBytes = 256 * 1024;
const stringOrNumberSchema = z.union([z.string(), z.number()]);
const lemonWebhookSchema = z
  .object({
    meta: z
      .object({
        event_name: z.string().trim().max(80).optional(),
        webhook_id: z.string().trim().max(120).optional(),
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

function normalizeStatus(eventName: string | undefined, status: string | null | undefined, planKey: PlanKey): SubscriptionStatus {
  if (eventName === "order_refunded" || eventName === "subscription_payment_refunded") return "refunded";
  if (eventName === "subscription_expired") return "expired";
  if (eventName === "subscription_cancelled") return "cancelled";
  if (eventName === "subscription_paused") return "paused";
  if (eventName === "subscription_payment_failed") return "past_due";
  if (eventName === "subscription_payment_recovered" || eventName === "subscription_payment_success") return "active";
  if (eventName === "subscription_unpaused" || eventName === "subscription_resumed" || eventName === "subscription_plan_changed") return "active";

  const normalized = status?.toLowerCase().trim();
  if (normalized === "expired") return "expired";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "paused") return "paused";
  if (normalized === "past_due" || normalized === "past-due" || normalized === "unpaid") return "past_due";
  if (normalized === "trialing") return "trialing";
  if (normalized === "active") return "active";
  return planKey === "free" ? "free" : "active";
}

export async function POST(request: Request) {
  try {
    if (requestExceedsBytes(request, maxLemonWebhookBytes)) {
      return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
    }

    const secret = getLemonSqueezyWebhookSecret();
    if (!secret) {
      console.error("Lemon Squeezy webhook is missing a signing secret.");
      return NextResponse.json({ error: "Webhook configuration is incomplete." }, { status: 500 });
    }

    const signature = request.headers.get("X-Signature");
    const payloadText = await request.text();

    if (!verifyLemonSqueezySignature(payloadText, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const rawPayload = JSON.parse(payloadText) as unknown;
    const parsedPayload = lemonWebhookSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: "Invalid Lemon Squeezy webhook payload." }, { status: 400 });
    }

    const payload = parsedPayload.data;
    const reservation = await reserveWebhookDelivery({
      source: "lemonsqueezy",
      payload: payloadText,
      ttlSeconds: 30 * 24 * 60 * 60,
      eventId: payload.meta?.webhook_id ?? null
    });
    if (!reservation.reserved) {
      return NextResponse.json({ received: true, duplicate: true, store: reservation.store });
    }

    const eventName = payload.meta?.event_name;
    const dataType = payload.data?.type ?? null;
    const subscriptionId = payload.data?.id ? String(payload.data.id) : null;
    const attributes = payload.data?.attributes;

    if (dataType === "subscription-invoices") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const customerId = attributes?.customer_id ? String(attributes.customer_id) : null;
    const currentPeriodEnd = attributes?.renews_at ?? attributes?.ends_at ?? null;

    let userId = payload.meta?.custom_data?.user_id ?? null;
    let existingSubscriptionRow: Record<string, unknown> | null = null;

    if (!userId && customerId) {
      const admin = createSupabaseAdminClient();
      const existing = await admin.from("subscriptions").select("*").eq("stripe_customer_id", customerId).maybeSingle();
      existingSubscriptionRow = (existing.data as Record<string, unknown> | null) ?? null;
      userId = existing.data?.user_id ?? null;
    }

    if (!userId) {
      await logAuditEvent({
        actorUserId: null,
        targetType: "subscription",
        targetId: subscriptionId ?? customerId ?? "unknown",
        action: `billing.webhook_skipped.${eventName ?? "unknown"}`,
        metadata: buildRequestAuditMetadata(request, {
          provider: "lemonsqueezy",
          reason: "missing_user_mapping",
          customer_id: customerId,
          webhook_id: payload.meta?.webhook_id ?? null
        })
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    const existingSubscription = existingSubscriptionRow ? normalizeSubscriptionRow(userId, existingSubscriptionRow) : null;
    const mappedPlanKey = mapVariantToPlanKey(attributes?.variant_id);
    const planKey =
      mappedPlanKey === "free" && existingSubscription && existingSubscription.plan_key !== "free"
        ? existingSubscription.plan_key
        : mappedPlanKey;
    const status = normalizeStatus(eventName, attributes?.status, planKey);

    await updateSubscriptionPlan({
      userId,
      customerId,
      subscriptionId,
      planKey,
      status,
      creditsTotal: planCatalog[planKey].monthlyCredits,
      currentPeriodEnd
    });

    await logAuditEvent({
      actorUserId: userId,
      targetType: "subscription",
      targetId: subscriptionId ?? userId,
      action: `billing.webhook.${eventName ?? "unknown"}`,
      metadata: buildRequestAuditMetadata(request, {
        provider: "lemonsqueezy",
        plan_key: planKey,
        status,
        store: reservation.store,
        duplicate: false,
        webhook_id: payload.meta?.webhook_id ?? null
      })
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Lemon Squeezy webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
