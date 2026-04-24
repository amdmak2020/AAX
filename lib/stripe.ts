import Stripe from "stripe";
import { getEnv } from "@/lib/env";

export function getStripe() {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia"
  });
}
