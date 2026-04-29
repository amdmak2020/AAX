import { PricingCard } from "@/components/public/pricing-card";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { plans } from "@/lib/product";
import { getCurrentAppData } from "@/lib/supabase/data";
import { formatCredits } from "@/lib/utils";

export default async function BillingPage() {
  const { account } = await getCurrentAppData();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase text-mint">Billing</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Plan and credits</h1>
        <p className="mt-4 leading-7 text-pearl/66">Subscriptions run through Gumroad. Credits renew with your plan.</p>
      </div>
      <Card className="mt-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-pearl/50">Current plan</p>
            <h2 className="mt-1 text-3xl font-black">{account.plan}</h2>
            <p className="mt-2 text-pearl/62">{formatCredits(account.creditsUsed, account.creditsTotal)}</p>
          </div>
          <form action="/api/gumroad/portal" method="post">
            <CsrfHiddenInput />
            <Button type="submit" variant="secondary">
              Manage subscription
            </Button>
          </form>
        </div>
      </Card>
      <div className="mt-8 grid gap-5 lg:grid-cols-4">
        {plans.map((plan) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </div>
    </div>
  );
}
