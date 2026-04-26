import type { User } from "@supabase/supabase-js";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SubscriptionSnapshot = {
  id: string | null;
  user_id: string;
  plan_key: PlanKey;
  credits_total: number;
  credits_used: number;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

function makeFreeSubscriptionSnapshot(userId: string): SubscriptionSnapshot {
  return {
    id: null,
    user_id: userId,
    plan_key: "free",
    credits_total: planCatalog.free.monthlyCredits,
    credits_used: 0,
    status: "trialing",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null
  };
}

export function normalizeSubscriptionRow(userId: string, row: Record<string, unknown>): SubscriptionSnapshot {
  const rawPlanKey = typeof row.plan_key === "string" ? row.plan_key : typeof row.plan === "string" ? row.plan : "free";
  const planKey = rawPlanKey in planCatalog ? (rawPlanKey as PlanKey) : "free";
  const plan = planCatalog[planKey];
  const rawCreditsTotal = typeof row.credits_total === "number" ? row.credits_total : null;
  const rawCreditsUsed = typeof row.credits_used === "number" ? row.credits_used : null;
  const creditsTotal = Math.max(rawCreditsTotal && rawCreditsTotal > 0 ? rawCreditsTotal : 0, plan.monthlyCredits);
  const creditsUsed = Math.min(rawCreditsUsed && rawCreditsUsed >= 0 ? rawCreditsUsed : 0, creditsTotal);

  return {
    id: typeof row.id === "string" ? row.id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : userId,
    plan_key: planKey,
    credits_total: creditsTotal,
    credits_used: creditsUsed,
    status: typeof row.status === "string" ? row.status : "trialing",
    stripe_customer_id: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    stripe_subscription_id: typeof row.stripe_subscription_id === "string" ? row.stripe_subscription_id : null,
    current_period_end: typeof row.current_period_end === "string" ? row.current_period_end : null
  };
}

export async function updateSubscriptionUsage(params: { subscriptionId: string | null; userId: string; nextCreditsUsed: number }) {
  if (!params.subscriptionId) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const update = await admin
    .from("subscriptions")
    .update({
      credits_used: params.nextCreditsUsed,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.subscriptionId);

  if (update.error) {
    throw new Error(update.error.message);
  }
}

export async function updateSubscriptionPlan(params: {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  planKey: PlanKey;
  status: string;
  creditsTotal: number;
  creditsUsed?: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const fullPayload = {
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    credits_total: params.creditsTotal,
    credits_used: params.creditsUsed ?? 0,
    current_period_end: params.currentPeriodEnd,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString()
  };
  const basePayload = {
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    credits_total: params.creditsTotal,
    credits_used: params.creditsUsed ?? 0,
    current_period_end: params.currentPeriodEnd,
    updated_at: new Date().toISOString()
  };
  const attempts = [
    { ...fullPayload, plan_key: params.planKey },
    { ...basePayload, plan_key: params.planKey },
    { ...fullPayload, plan: params.planKey },
    { ...basePayload, plan: params.planKey }
  ];

  let lastError: string | null = null;

  for (const payload of attempts) {
    const result = await admin.from("subscriptions").update(payload).eq("user_id", params.userId);
    if (!result.error) {
      return;
    }

    lastError = result.error.message;
  }

  throw new Error(lastError ?? "Could not update subscription plan.");
}

export async function ensureAccountRecords(user: User) {
  const admin = createSupabaseAdminClient();

  const profilePayload = {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata.full_name as string | undefined) ?? "",
    avatar_url: (user.user_metadata.avatar_url as string | undefined) ?? null,
    updated_at: new Date().toISOString()
  };

  await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });

  try {
    const subscriptionResult = await admin.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();

    if (subscriptionResult.data) {
      return normalizeSubscriptionRow(user.id, subscriptionResult.data as Record<string, unknown>);
    }

    const inserted = await admin
      .from("subscriptions")
      .insert({
        user_id: user.id
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) {
      return makeFreeSubscriptionSnapshot(user.id);
    }

    return normalizeSubscriptionRow(user.id, inserted.data as Record<string, unknown>);
  } catch {
    return makeFreeSubscriptionSnapshot(user.id);
  }
}
