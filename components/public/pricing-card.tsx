import { Check } from "lucide-react";
import { MagneticPanel } from "@/components/effects/magnetic-panel";
import { InteractiveSurface } from "@/components/effects/interactive-surface";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  plan: {
    name: string;
    price: string;
    description: string;
    credits: string;
    cta: string;
    featured: boolean;
    features: readonly string[];
    ctaHref?: string;
    ctaFormAction?: string;
    ctaFields?: Record<string, string>;
    ctaDisabled?: boolean;
  };
};

export function PricingCard({ plan }: PricingCardProps) {
  return (
    <MagneticPanel className="h-full">
      <InteractiveSurface className="h-full rounded-lg">
        <Card className={cn("interactive-card interactive-lift pricing-card-shell flex h-full flex-col overflow-hidden", plan.featured && "border-mint/65 bg-mint/[0.08]")}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-black">{plan.name}</h3>
            {plan.featured ? <span className="pulse-chip rounded bg-mint px-2 py-1 text-xs font-black text-ink">Popular</span> : null}
          </div>
          <div className="mt-5 flex items-end gap-1">
            <span className="text-4xl font-black">{plan.price}</span>
            <span className="pb-1 text-sm text-pearl/54">/month</span>
          </div>
          <p className="mt-4 min-h-12 text-sm leading-6 text-pearl/66">{plan.description}</p>
          <p className="mt-4 rounded-lg bg-ink/50 px-3 py-2 text-sm font-bold text-lemon">{plan.credits}</p>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-pearl/72">
            {plan.features.map((feature) => (
              <li className="flex gap-2" key={feature}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {plan.ctaFormAction ? (
            <form action={plan.ctaFormAction} className="mt-7" method="post">
              {Object.entries(plan.ctaFields ?? {}).map(([name, value]) => (
                <input key={name} name={name} type="hidden" value={value} />
              ))}
              <Button className="w-full" disabled={plan.ctaDisabled} type="submit" variant={plan.featured ? "primary" : "secondary"}>
                {plan.cta}
              </Button>
            </form>
          ) : (
            <Button
              className="mt-7 w-full"
              disabled={plan.ctaDisabled}
              href={plan.ctaDisabled ? undefined : plan.ctaHref ?? `/signup?plan=${plan.name.toLowerCase()}`}
              variant={plan.featured ? "primary" : "secondary"}
            >
              {plan.cta}
            </Button>
          )}
        </Card>
      </InteractiveSurface>
    </MagneticPanel>
  );
}
