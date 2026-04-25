import { PlanBadge } from "@/components/app/plan-badge";
import { UsageMeter } from "@/components/app/usage-meter";
import { PricingCard } from "@/components/public/pricing-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { planCatalog } from "@/lib/app-config";
import { getViewerWorkspace } from "@/lib/app-data";
import { getLemonSqueezyVariantId, hasLemonSqueezyApiKey, hasLemonSqueezyCheckoutConfig } from "@/lib/env";

const billingMessages = {
  success: {
    tone: "border-mint/20 bg-mint/10",
    title: "Checkout completed",
    body: "Your subscription was updated. Credits will reflect the new plan as Lemon Squeezy finishes syncing."
  },
  cancelled: {
    tone: "border-pearl/10 bg-white/[0.03]",
    title: "Checkout cancelled",
    body: "No changes were made to your subscription."
  },
  "missing-subscription": {
    tone: "border-coral/20 bg-coral/10",
    title: "Billing record missing",
    body: "We could not find a subscription record for this account yet."
  },
  "missing-customer": {
    tone: "border-coral/20 bg-coral/10",
    title: "No paid plan found yet",
    body: "Finish your first paid checkout before opening plan management."
  },
  "missing-configuration": {
    tone: "border-lemon/20 bg-lemon/10",
    title: "Lemon Squeezy checkout is not ready yet",
    body: "Add the Lemon Squeezy store ID, store URL, webhook secret, and plan variant IDs to turn on paid checkout."
  },
  failed: {
    tone: "border-coral/20 bg-coral/10",
    title: "Checkout could not start",
    body: "We hit a billing setup problem. Double-check your Lemon Squeezy API key, store ID, and plan variant IDs."
  }
} as const;

export default async function AppBillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;

  const params = searchParams ? await searchParams : {};
  const checkoutState = typeof params.checkout === "string" ? params.checkout : null;
  const portalState = typeof params.portal === "string" ? params.portal : null;
  const notice =
    (checkoutState && billingMessages[checkoutState as keyof typeof billingMessages]) ||
    (portalState && billingMessages[portalState as keyof typeof billingMessages]) ||
    null;

  const lemonApiReady = hasLemonSqueezyApiKey();
  const lemonCheckoutReady = hasLemonSqueezyCheckoutConfig();
  const currentPlan = planCatalog[workspace.subscription.plan_key];
  const remainingCredits = Math.max(workspace.subscription.credits_total - workspace.subscription.credits_used, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase text-mint">Plans</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Pick a plan and keep going</h1>
        <p className="mt-4 leading-7 text-pearl/64">You get a few free boosts to try it. When you need more, upgrade in one step.</p>
      </div>

      {notice ? (
        <div className={`mt-6 rounded-lg border p-4 ${notice.tone}`}>
          <p className="text-sm font-black">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 text-pearl/72">{notice.body}</p>
        </div>
      ) : null}

      <Card className="mt-8">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-pearl/50">Your plan</p>
              <PlanBadge planKey={workspace.subscription.plan_key} />
            </div>
            <h2 className="mt-2 text-3xl font-black">{currentPlan.name}</h2>
            <p className="mt-2 text-sm leading-6 text-pearl/60">{currentPlan.tagline}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-pearl/10 bg-white/[0.03] p-4">
              <p className="text-sm text-pearl/50">Boosts left</p>
              <p className="mt-2 text-3xl font-black">{remainingCredits}</p>
              <p className="mt-1 text-sm text-pearl/58">{workspace.subscription.credits_total} total this period</p>
            </div>
            {workspace.subscription.plan_key !== "free" ? (
              <div className="rounded-lg border border-pearl/10 bg-white/[0.03] p-4">
                <p className="text-sm text-pearl/50">Status</p>
                <p className="mt-2 text-2xl font-black capitalize">{workspace.subscription.status}</p>
                <p className="mt-1 text-sm text-pearl/58">
                  {workspace.subscription.current_period_end
                    ? `Renews on ${new Date(workspace.subscription.current_period_end).toLocaleDateString()}`
                    : "Active plan"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {workspace.subscription.plan_key === "free" ? (
              <Button href="#plans">Upgrade now</Button>
            ) : (
              <form action="/api/lemonsqueezy/portal" method="post">
                <Button
                  href={!lemonCheckoutReady ? "/app/billing?portal=missing-configuration" : undefined}
                  type="submit"
                  variant="secondary"
                >
                  Manage plan
                </Button>
              </form>
            )}
            {!lemonCheckoutReady ? (
              <p className="max-w-[260px] text-xs leading-5 text-pearl/50">
                {lemonApiReady
                  ? "Lemon Squeezy API access is in place. Add the store ID, store URL, webhook secret, and plan variant IDs to finish checkout."
                  : "Add your Lemon Squeezy API key first, then the store ID, store URL, webhook secret, and plan variant IDs."}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <p className="text-sm font-black uppercase text-pearl/50">Usage</p>
          <div className="mt-4">
            <UsageMeter used={workspace.subscription.credits_used} total={workspace.subscription.credits_total} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-black uppercase text-pearl/50">Simple billing</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-pearl/66">
            <li>1 boost = 1 credit.</li>
            <li>Credits refresh with your plan.</li>
            <li>You can upgrade any time.</li>
          </ul>
        </Card>
      </div>

      <div className="mt-10">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase text-pearl/50">Choose a plan</p>
          <h2 className="mt-2 text-3xl font-black" id="plans">Start free, upgrade when you need more</h2>
          <p className="mt-3 text-sm leading-6 text-pearl/62">Most people can start on free, try a few clips, then move to Creator when they want more volume.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-4">
        {Object.values(planCatalog).map((plan) => (
          (() => {
            const paidPlan = plan.key !== "free" ? plan : null;
            const variantId = paidPlan ? getLemonSqueezyVariantId(paidPlan.key) : null;

            return (
          <PricingCard
            key={plan.key}
            plan={{
              name: plan.name,
              price: `$${plan.priceMonthly}`,
              description: plan.tagline,
              credits: `${plan.monthlyCredits} boosts / month`,
              cta:
                workspace.subscription.plan_key === plan.key
                  ? "Current plan"
                  : plan.priceMonthly === 0
                    ? "Stay on Free"
                    : lemonCheckoutReady
                      ? `Upgrade to ${plan.name}`
                      : "Finish Lemon Squeezy setup",
              featured: plan.featured,
              features: plan.features,
              ctaDisabled: workspace.subscription.plan_key === plan.key,
              ctaHref:
                plan.priceMonthly === 0
                  ? "/app"
                  : !lemonCheckoutReady || !variantId
                    ? "/app/billing?checkout=missing-configuration"
                    : undefined,
              ctaFormAction:
                plan.priceMonthly > 0 &&
                lemonCheckoutReady &&
                workspace.subscription.plan_key !== plan.key &&
                Boolean(variantId)
                  ? "/api/lemonsqueezy/checkout"
                  : undefined,
              ctaFields:
                plan.priceMonthly > 0 && variantId
                  ? {
                      planKey: plan.key
                    }
                  : undefined
            }}
          />
            );
          })()
        ))}
      </div>
    </div>
  );
}
