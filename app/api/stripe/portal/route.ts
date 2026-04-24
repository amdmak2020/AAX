import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
  }

  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  const subscriptionResult = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  const customer = subscriptionResult.data?.stripe_customer_id;
  if (!customer) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-customer`, { status: 303 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${getAppUrl()}/app/billing`
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
