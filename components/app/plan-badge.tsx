import { planCatalog, type PlanKey } from "@/lib/app-config";

export function PlanBadge({ planKey }: { planKey: PlanKey }) {
  const plan = planCatalog[planKey];
  return <span className="rounded bg-mint/15 px-2 py-1 text-xs font-black text-mint">{plan.name}</span>;
}
