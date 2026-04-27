import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { normalizeSubscriptionRow, type SubscriptionStatus, updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { getLemonSqueezyVariantId, getLemonSqueezyWebhookSecret } from "@/lib/env";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestExceedsBytes, strictUuidSchema } from "@/lib/validation";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { finalizePersistentWebhookEvent, reservePersistentWebhookEvent } from "@/lib/webhook-ledger";

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
  let ledgerId: string | null = null;
  let targetUserId: string | null = null;
  let webhookId: string | null = null;
  let eventName: string | undefined;

  try {
    const limiter = await enforceRateLimit({
      request,
      bucket: "webhook:lemonsqueezy",
      limit: 240,
      windowMs: 10 * 60 * 1000
    });

    if (!limiter.allowed) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Too many requests." }, { status: 429 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        retryAfterSeconds: limiter.retryAfterSeconds,
        store: limiter.store
      });
    }

    if (requestExceedsBytes(request, maxLemonWebhookBytes)) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Request rejected." }, { status: 413 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const secret = getLemonSqueezyWebhookSecret();
    if (!secret) {
      console.error("Lemon Squeezy webhook is missing a signing secret.");
      return applyRateLimitHeaders(NextResponse.json({ error: "Webhook processing failed." }, { status: 500 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const signature = request.headers.get("X-Signature");
    const payloadText = await request.text();

    if (!verifyLemonSqueezySignature(payloadText, signature, secret)) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const rawPayload = JSON.parse(payloadText) as unknown;
    const parsedPayload = lemonWebhookSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const payload = parsedPayload.data;
    eventName = payload.meta?.event_name;
    webhookId = payload.meta?.webhook_id ?? null;

    const reservation = await reservePersistentWebhookEvent({
      source: "lemonsqueezy",
      payload: payloadText,
      ttlSeconds: 30 * 24 * 60 * 60,
      eventId: webhookId,
      eventName
    });
    ledgerId = "ledgerId" in reservation ? reservation.ledgerId ?? null : null;
    if (!reservation.reserved) {
      return applyRateLimitHeaders(NextResponse.json({ received: true, duplicate: true, store: reservation.store }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const dataType = payload.data?.type ?? null;
    const subscriptionId = payload.data?.id ? String(payload.data.id) : null;
    const attributes = payload.data?.attributes;

    if (dataType === "subscription-invoices") {
      await finalizePersistentWebhookEvent({
        ledgerId,
        status: "skipped",
        metadata: { provider: "lemonsqueezy", event_name: eventName ?? null, reason: "subscription_invoices_ignored" }
      });
      return applyRateLimitHeaders(NextResponse.json({ received: true, skipped: true }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
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

    targetUserId = userId;

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
      await finalizePersistentWebhookEvent({
        ledgerId,
        status: "skipped",
        metadata: {
          provider: "lemonsqueezy",
          event_name: eventName ?? null,
          webhook_id: webhookId,
          customer_id: customerId,
          reason: "missing_user_mapping"
        }
      });
      return applyRateLimitHeaders(NextResponse.json({ received: true, skipped: true }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
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

    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "processed",
      targetUserId: userId,
      metadata: {
        provider: "lemonsqueezy",
        event_name: eventName ?? null,
        webhook_id: webhookId,
        plan_key: planKey,
        status
      }
    });

    return applyRateLimitHeaders(NextResponse.json({ received: true }), {
      limit: 240,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  } catch (error) {
    console.error("Lemon Squeezy webhook error", error);
    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "failed",
      targetUserId,
      metadata: {
        provider: "lemonsqueezy",
        event_name: eventName ?? null,
        webhook_id: webhookId
      },
      errorMessage: error instanceof Error ? error.message : "Unknown webhook processing error"
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
