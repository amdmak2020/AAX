import { NextResponse } from "next/server";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { normalizeSubscriptionRow, type SubscriptionStatus, updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getGumroadProductId, getGumroadSellerId, getGumroadWebhookSecret } from "@/lib/env";
import { getGumroadEventName, parseGumroadBoolean, verifyGumroadSignature } from "@/lib/gumroad";
import { sendOperationalAlert } from "@/lib/monitoring";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestExceedsBytes, sanitizeSingleLineText } from "@/lib/validation";
import { finalizePersistentWebhookEvent, reservePersistentWebhookEvent } from "@/lib/webhook-ledger";

const maxGumroadWebhookBytes = 256 * 1024;

function matchPlanFromVariantText(text: string | null | undefined): PlanKey | null {
  const normalized = text?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/\bcreator\b/.test(normalized)) {
    return "creator";
  }

  if (/\bpro\b/.test(normalized)) {
    return "pro";
  }

  if (/\bbusiness\b/.test(normalized)) {
    return "business";
  }

  return null;
}

function mapWebhookToPlanKey(fields: URLSearchParams, productId: string | null): PlanKey {
  const variantHints = [
    fields.get("variant"),
    fields.get("variants"),
    fields.get("formatted_variants"),
    fields.get("tier"),
    fields.get("option"),
    fields.get("purchase[variants]"),
    fields.get("subscription_name"),
    fields.get("price_name")
  ];

  for (const hint of variantHints) {
    const matched = matchPlanFromVariantText(hint);
    if (matched) {
      return matched;
    }
  }

  const normalized = productId?.trim() ?? "";
  if (!normalized) {
    return "free";
  }

  const map = {
    [getGumroadProductId("creator") ?? ""]: "creator",
    [getGumroadProductId("pro") ?? ""]: "pro",
    [getGumroadProductId("business") ?? ""]: "business"
  } as const;

  return map[normalized as keyof typeof map] ?? "free";
}

function normalizeStatus(eventName: string, fields: URLSearchParams, planKey: PlanKey): SubscriptionStatus {
  if (eventName === "sale_refunded") return "refunded";
  if (eventName === "subscription_cancelled") return "cancelled";

  if (parseGumroadBoolean(fields.get("cancelled"))) return "cancelled";
  if (parseGumroadBoolean(fields.get("refunded")) || parseGumroadBoolean(fields.get("chargebacked")) || parseGumroadBoolean(fields.get("disputed"))) {
    return "refunded";
  }

  return planKey === "free" ? "free" : "active";
}

export async function POST(request: Request) {
  let ledgerId: string | null = null;
  let webhookEventName = "gumroad.unknown";
  let targetUserId: string | null = null;

  try {
    const limiter = await enforceRateLimit({
      request,
      bucket: "webhook:gumroad",
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

    if (requestExceedsBytes(request, maxGumroadWebhookBytes)) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Request rejected." }, { status: 413 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const payloadText = await request.text();
    const fields = new URLSearchParams(payloadText);
    const secret = getGumroadWebhookSecret();
    const configuredSellerId = getGumroadSellerId();
    const signature = request.headers.get("X-Gumroad-Signature");
    const payloadSellerId = fields.get("seller_id")?.trim() ?? null;

    const signatureValid = Boolean(secret && verifyGumroadSignature(payloadText, signature, secret));
    const sellerIdValid = Boolean(configuredSellerId && payloadSellerId === configuredSellerId);

    if (!secret && !configuredSellerId) {
      logServerError("Gumroad webhook is missing both signing secret and seller ID.");
      return applyRateLimitHeaders(NextResponse.json({ error: "Webhook processing failed." }, { status: 500 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    if (!signatureValid && !sellerIdValid) {
      return applyRateLimitHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
        limit: 240,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    webhookEventName = getGumroadEventName(fields);
    const saleId = fields.get("sale_id")?.trim() || null;
    const subscriptionId = fields.get("subscription_id")?.trim() || saleId;
    const productId = fields.get("product_id")?.trim() || null;
    const purchaserId = fields.get("purchaser_id")?.trim() || fields.get("user_id")?.trim() || fields.get("email")?.trim() || null;

    const reservation = await reservePersistentWebhookEvent({
      source: "gumroad",
      payload: payloadText,
      ttlSeconds: 30 * 24 * 60 * 60,
      eventId: saleId || subscriptionId || undefined,
      eventName: webhookEventName
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

    const admin = createSupabaseAdminClient();
    let userId: string | null = null;
    let existingSubscriptionRow: Record<string, unknown> | null = null;

    if (subscriptionId) {
      const existingBySubscription = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", subscriptionId).maybeSingle();
      existingSubscriptionRow = (existingBySubscription.data as Record<string, unknown> | null) ?? null;
      userId = existingBySubscription.data?.user_id ?? null;
    }

    const normalizedEmail = fields.get("email")?.trim().toLowerCase() || null;
    if (!userId && normalizedEmail) {
      const profileResult = await admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
      userId = profileResult.data?.id ?? null;
    }

    if (!userId && purchaserId) {
      const existingByCustomer = await admin.from("subscriptions").select("*").eq("stripe_customer_id", purchaserId).maybeSingle();
      existingSubscriptionRow = (existingByCustomer.data as Record<string, unknown> | null) ?? existingSubscriptionRow;
      userId = existingByCustomer.data?.user_id ?? null;
    }

    targetUserId = userId;

    if (!userId) {
      await logAuditEvent({
        actorUserId: null,
        targetType: "subscription",
        targetId: subscriptionId ?? purchaserId ?? "unknown",
        action: `billing.webhook_skipped.${webhookEventName}`,
        metadata: buildRequestAuditMetadata(request, {
          provider: "gumroad",
          reason: "missing_user_mapping",
          sale_id: saleId,
          subscription_id: subscriptionId
        })
      });

      await finalizePersistentWebhookEvent({
        ledgerId,
        status: "skipped",
        metadata: {
          provider: "gumroad",
          event_name: webhookEventName,
          sale_id: saleId,
          subscription_id: subscriptionId,
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
    const mappedPlanKey = mapWebhookToPlanKey(fields, productId);
    const planKey =
      mappedPlanKey === "free" && existingSubscription && existingSubscription.plan_key !== "free"
        ? existingSubscription.plan_key
        : mappedPlanKey;
    const status = normalizeStatus(webhookEventName, fields, planKey);

    if (status === "past_due" || status === "cancelled" || status === "expired" || status === "refunded" || status === "paused") {
      await sendOperationalAlert({
        code: `billing-${status}`,
        severity: status === "past_due" || status === "refunded" ? "critical" : "warning",
        summary: `A Gumroad subscription entered ${status}.`,
        dedupeKey: subscriptionId ?? purchaserId,
        details: { userId, subscriptionId, purchaserId, eventName: webhookEventName, planKey, status }
      });
    }

    await updateSubscriptionPlan({
      userId,
      customerId: purchaserId,
      subscriptionId,
      planKey,
      status,
      creditsTotal: planCatalog[planKey].monthlyCredits,
      currentPeriodEnd: null
    });

    await logAuditEvent({
      actorUserId: userId,
      targetType: "subscription",
      targetId: subscriptionId ?? userId,
      action: `billing.webhook.${webhookEventName}`,
      metadata: buildRequestAuditMetadata(request, {
        provider: "gumroad",
        plan_key: planKey,
        status,
        product_id: productId,
        sale_id: saleId
      })
    });

    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "processed",
      targetUserId: userId,
      metadata: {
        provider: "gumroad",
        event_name: webhookEventName,
        sale_id: saleId,
        subscription_id: subscriptionId,
        product_id: productId,
        purchaser_id: purchaserId,
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
    logServerError("Gumroad webhook error", { error, targetUserId, eventName: webhookEventName });
    await sendOperationalAlert({
      code: "billing-webhook-failed",
      severity: "critical",
      summary: "A Gumroad webhook failed to process.",
      dedupeKey: targetUserId,
      details: { targetUserId, eventName: webhookEventName }
    });
    await finalizePersistentWebhookEvent({
      ledgerId,
      status: "failed",
      targetUserId,
      metadata: {
        provider: "gumroad",
        event_name: webhookEventName
      },
      errorMessage: error instanceof Error ? sanitizeSingleLineText(error.message) : "Unknown webhook processing error"
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
