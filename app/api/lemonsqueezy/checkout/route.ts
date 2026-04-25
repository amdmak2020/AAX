import { NextResponse } from "next/server";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { getViewerWorkspace } from "@/lib/app-data";
import { getAppUrl, getLemonSqueezyStoreId, getLemonSqueezyVariantId, hasLemonSqueezyCheckoutConfig } from "@/lib/env";
import { createLemonSqueezyCheckout } from "@/lib/lemonsqueezy";

export async function POST(request: Request) {
  const formData = await request.formData();
  const planKey = formData.get("planKey")?.toString() as Exclude<PlanKey, "free"> | null;

  if (!planKey || !(planKey in planCatalog)) {
    return NextResponse.json({ error: "Missing plan checkout configuration" }, { status: 400 });
  }

  if (!hasLemonSqueezyCheckoutConfig()) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  const workspace = await getViewerWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  const storeId = getLemonSqueezyStoreId();
  const variantId = getLemonSqueezyVariantId(planKey);

  if (!storeId || !variantId) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  try {
    const checkoutUrl = await createLemonSqueezyCheckout({
      storeId,
      variantId,
      planName: planCatalog[planKey].name,
      email: workspace.profile.email,
      name: workspace.profile.full_name,
      userId: workspace.profile.id,
      redirectUrl: `${getAppUrl()}/app/billing?checkout=success`
    });

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    console.error("Lemon Squeezy checkout error", error);
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=failed`, { status: 303 });
  }
}
