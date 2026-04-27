import Stripe from "stripe";
import { NextResponse } from "next/server";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

function mapStripePriceToPlanKey(priceId: string | null | undefined): Exclude<PlanKey, "free"> | null {
  if (!priceId) return null;

  const map = {
    [process.env.STRIPE_CREATOR_PRICE_ID ?? ""]: "creator",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
    [process.env.STRIPE_BUSINESS_PRICE_ID ?? ""]: "business"
  } as const;

  return map[priceId as keyof typeof map] ?? null;
}

async function upsertSubscriptionFromStripeSubscription(subscription: Stripe.Subscription) {
  const admin = createSupabaseAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const planKey = mapStripePriceToPlanKey(priceId) ?? "free";
  const plan = planCatalog[planKey];

  const existing = await admin
    .from("subscriptions")
    .select("id,user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const userId =
    existing.data?.user_id ?? (subscription.metadata?.userId || subscription.metadata?.supabaseUserId || null);

  if (!userId) {
    return;
  }

  await updateSubscriptionPlan({
    userId,
    customerId,
    subscriptionId: subscription.id,
    planKey,
    status:
      subscription.status === "active"
        ? "active"
        : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "past_due" || subscription.status === "unpaid"
            ? "past_due"
            : subscription.status === "canceled"
              ? "cancelled"
              : subscription.status === "incomplete"
                ? "trialing"
                : "expired",
    creditsTotal: plan.monthlyCredits,
    creditsUsed: 0,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = session.metadata?.userId ?? session.client_reference_id;
  const planKey = (session.metadata?.planKey as Exclude<PlanKey, "free"> | undefined) ?? "creator";
  const plan = planCatalog[planKey];

  if (!userId) {
    return;
  }

  await updateSubscriptionPlan({
    userId,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    subscriptionId: null,
    planKey,
    status: "active",
    creditsTotal: plan.monthlyCredits,
    currentPeriodEnd: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
  });
}

export async function POST(request: Request) {
  const secret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscriptionFromStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
