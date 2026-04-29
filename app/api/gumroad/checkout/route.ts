import { NextResponse } from "next/server";
import { z } from "zod";
import { type PlanKey } from "@/lib/app-config";
import { isBillingLocked, isEmailVerified, isAccountSuspended } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getViewerWorkspace } from "@/lib/app-data";
import { verifyCsrfRequest } from "@/lib/csrf";
import { getAppUrl, getGumroadProductUrl, hasGumroadCheckoutConfig } from "@/lib/env";
import { buildGumroadCheckoutUrl } from "@/lib/gumroad";
import { reserveIdempotencyKey } from "@/lib/idempotency";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { getUnexpectedFormFields, requestExceedsBytes } from "@/lib/validation";

const checkoutSchema = z.object({
  planKey: z.enum(["creator", "pro", "business"]),
  idempotencyKey: z.string().trim().uuid()
}).strict();
const maxCheckoutRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxCheckoutRequestBytes)) {
    return NextResponse.json({ error: "Checkout payload is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["planKey", "csrfToken", "idempotencyKey"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.json({ error: "Unexpected checkout fields." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse({
    planKey: formData.get("planKey")?.toString(),
    idempotencyKey: formData.get("idempotencyKey")?.toString()
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing plan checkout configuration" }, { status: 400 });
  }

  const ipLimiter = await enforceRateLimit({
    request,
    bucket: "billing:checkout:ip",
    limit: 20,
    windowMs: 60 * 60 * 1000
  });

  if (!ipLimiter.allowed) {
    return applyRateLimitHeaders(NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=rate-limited`, { status: 303 }), {
      limit: 20,
      remaining: ipLimiter.remaining,
      resetAt: ipLimiter.resetAt,
      retryAfterSeconds: ipLimiter.retryAfterSeconds,
      store: ipLimiter.store
    });
  }

  const planKey = parsed.data.planKey as Exclude<PlanKey, "free">;

  if (!hasGumroadCheckoutConfig()) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  const workspace = await getViewerWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=/app/billing`, { status: 303 });
  }

  if (isAccountSuspended(workspace.profile)) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=account-suspended`, { status: 303 });
  }

  if (isBillingLocked(workspace.profile)) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=billing-locked`, { status: 303 });
  }

  const userLimiter = await enforceRateLimit({
    request,
    bucket: "billing:checkout:user",
    key: workspace.profile.id,
    limit: 8,
    windowMs: 60 * 60 * 1000
  });

  if (!userLimiter.allowed) {
    return applyRateLimitHeaders(NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=rate-limited`, { status: 303 }), {
      limit: 8,
      remaining: userLimiter.remaining,
      resetAt: userLimiter.resetAt,
      retryAfterSeconds: userLimiter.retryAfterSeconds,
      store: userLimiter.store
    });
  }

  if (!workspace.profile.email || !isEmailVerified({ email_confirmed_at: workspace.profile.email_confirmed_at ?? null })) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=verify-email`, { status: 303 });
  }

  const reservation = await reserveIdempotencyKey({
    scope: `billing-checkout:${workspace.profile.id}`,
    key: parsed.data.idempotencyKey,
    ttlSeconds: 15 * 60
  });
  if (!reservation.reserved) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=already-submitted`, { status: 303 });
  }

  const productUrl = getGumroadProductUrl(planKey);
  if (!productUrl) {
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=missing-configuration`, { status: 303 });
  }

  try {
    const checkoutUrl = buildGumroadCheckoutUrl(productUrl, {
      email: workspace.profile.email
    });

    await logAuditEvent({
      actorUserId: workspace.profile.id,
      targetType: "subscription",
      targetId: workspace.profile.id,
      action: "billing.checkout_started",
      metadata: buildRequestAuditMetadata(request, { plan_key: planKey, provider: "gumroad" })
    });

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    logServerError("Gumroad checkout error", { error, userId: workspace.profile.id, planKey });
    await logAuditEvent({
      actorUserId: workspace.profile.id,
      targetType: "subscription",
      targetId: workspace.profile.id,
      action: "billing.checkout_failed",
      metadata: buildRequestAuditMetadata(request, { plan_key: planKey, provider: "gumroad" })
    });
    return NextResponse.redirect(`${getAppUrl()}/app/billing?checkout=failed`, { status: 303 });
  }
}
