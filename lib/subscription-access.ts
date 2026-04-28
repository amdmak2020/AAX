import type { PlanKey } from "@/lib/app-config";
import type { SubscriptionStatus } from "@/lib/account-bootstrap";

export function hasActiveBillingAccessForBoost(input: {
  planKey: PlanKey;
  status: SubscriptionStatus;
}) {
  return input.planKey === "free" || input.status === "active" || input.status === "trialing";
}
