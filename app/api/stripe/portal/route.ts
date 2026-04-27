import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCsrfRequest } from "@/lib/csrf";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";

const maxStripePortalRequestBytes = 8 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxStripePortalRequestBytes)) {
    return NextResponse.json({ error: "Portal payload is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=csrf-failed`, { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
  }

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
