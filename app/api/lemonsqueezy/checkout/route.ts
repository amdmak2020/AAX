import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, type PlanKey } from "@/lib/app-config";
import { isEmailVerified } from "@/lib/access-control";
import { getViewerWorkspace } from "@/lib/app-data";
import { getAppUrl, getLemonSqueezyStoreId, getLemonSqueezyVariantId, hasLemonSqueezyCheckoutConfig } from "@/lib/env";
import { createLemonSqueezyCheckout } from "@/lib/lemonsqueezy";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";

const checkoutSchema = z.object({
  planKey: z.enum(["creator", "pro", "business"])
}).strict();
const maxCheckoutRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxCheckoutRequestBytes)) {
    return NextResponse.json({ error: "Checkout payload is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const unexpectedFields = getUnexpectedFormFields(formData, ["planKey"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.json({ error: "Unexpected checkout fields." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse({
    planKey: formData.get("planKey")?.toString()
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing plan checkout configuration" }, { status: 400 });
  }

  const planKey = parsed.data.planKey as Exclude<PlanKey, "free">;

  if (!hasLemonSqueezyCheckoutConfig()) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  const workspace = await getViewerWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  if (!workspace.profile.email || !isEmailVerified({ email_confirmed_at: workspace.profile.email_confirmed_at ?? null })) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=verify-email`, { status: 303 });
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
