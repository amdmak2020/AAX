import { NextResponse } from "next/server";
import { isEmailVerified } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, getLemonSqueezyStoreUrl, hasLemonSqueezyApiKey } from "@/lib/env";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy";
import { getUnexpectedFormFields } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const formData = await request.formData();
  const unexpectedFields = getUnexpectedFormFields(formData, ["csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
  }
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=csrf-failed`, { status: 303 });
  }

  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  if (!isEmailVerified(user)) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=verify-email`, { status: 303 });
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
        await logAuditEvent({
          actorUserId: user.id,
          targetType: "subscription",
          targetId: subscriptionId,
          action: "billing.portal_opened",
          metadata: buildRequestAuditMetadata(request, { provider: "lemonsqueezy", signed_portal: true })
        });
        return NextResponse.redirect(portalUrl, { status: 303 });
      }
    } catch {
      // Fall back to the unsigned portal URL below.
    }
  }

  const storeUrl = getLemonSqueezyStoreUrl();
  if (storeUrl) {
    await logAuditEvent({
      actorUserId: user.id,
      targetType: "subscription",
      targetId: subscriptionId ?? user.id,
      action: "billing.portal_opened",
      metadata: buildRequestAuditMetadata(request, { provider: "lemonsqueezy", signed_portal: false })
    });
    return NextResponse.redirect(`${storeUrl.replace(/\/$/, "")}/billing`, { status: 303 });
  }

  return NextResponse.redirect(`${getAppUrl()}/app/billing?portal=missing-configuration`, { status: 303 });
}
