import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, getLemonSqueezyStoreUrl, hasLemonSqueezyApiKey } from "@/lib/env";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  if (!hasLemonSqueezyApiKey()) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
  }

  const admin = createSupabaseAdminClient();
  const subscriptionResult = await admin.from("subscriptions").select("stripe_subscription_id").eq("user_id", user.id).maybeSingle();
  const subscriptionId = subscriptionResult.data?.stripe_subscription_id;

  if (subscriptionId) {
    try {
      const subscription = await getLemonSqueezySubscription(subscriptionId);
      const portalUrl = subscription.attributes.urls?.customer_portal;
      if (portalUrl) {
        return NextResponse.redirect(portalUrl, { status: 303 });
      }
    } catch {
      // Fall back to the unsigned portal URL below.
    }
  }

  const storeUrl = getLemonSqueezyStoreUrl();
  if (storeUrl) {
    return NextResponse.redirect(`${storeUrl.replace(/\/$/, "")}/billing`, { status: 303 });
  }

  return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
}
