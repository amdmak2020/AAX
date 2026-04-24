import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, getStripePriceId, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { planCatalog, type PlanKey } from "@/lib/app-config";

export async function POST(request: Request) {
  const formData = await request.formData();
  const priceId = formData.get("priceId")?.toString();
  const planKey = formData.get("planKey")?.toString() as Exclude<PlanKey, "free"> | null;

  if (!priceId || !planKey || !(planKey in planCatalog)) {
    return NextResponse.json({ error: "Missing plan checkout configuration" }, { status: 400 });
  }

  if (!isStripeConfigured() || getStripePriceId(planKey) !== priceId) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  const admin = createSupabaseAdminClient();
  const profileResult = await admin.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
  const subscriptionResult = await admin.from("subscriptions").select("id,stripe_customer_id").eq("user_id", user.id).maybeSingle();

  if (subscriptionResult.error || !subscriptionResult.data) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-subscription`, { status: 303 });
  }

  const stripe = getStripe();
  let customerId = subscriptionResult.data.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profileResult.data?.email ?? undefined,
      name: profileResult.data?.full_name ?? undefined,
      metadata: {
        supabaseUserId: user.id
      }
    });

    customerId = customer.id;

    await admin
      .from("subscriptions")
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", subscriptionResult.data.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      planKey
    },
    success_url: `${getAppUrl()}/app/billing?checkout=success`,
    cancel_url: `${getAppUrl()}/app/billing?checkout=cancelled`
  });

  return NextResponse.redirect(session.url ?? `${getAppUrl()}/app/billing`, { status: 303 });
}
