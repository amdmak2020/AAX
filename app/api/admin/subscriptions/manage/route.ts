import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog } from "@/lib/app-config";
import { hasRole, isEmailVerified, isRecentlyAuthenticated } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getCurrentProfileOptional } from "@/lib/authz";
import { normalizeSubscriptionRow, updateSubscriptionPlan } from "@/lib/account-bootstrap";
import { verifyCsrfRequest } from "@/lib/csrf";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUnexpectedFormFields, singleLineTextSchema, strictUuidSchema } from "@/lib/validation";

const schema = z
  .object({
    userId: strictUuidSchema,
    action: z.enum(["downgrade_to_free", "set_past_due", "set_cancelled", "set_refunded", "restore_active"]),
    reason: singleLineTextSchema({ max: 160, tooLongMessage: "Keep the reason under 160 characters." })
  })
  .strict();

function redirectToAdmin(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/app/admin?notice=${encodeURIComponent(code)}`, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfileOptional();
  if (!profile) {
    return NextResponse.redirect(new URL(`/login?next=/app/admin`, request.url), { status: 303 });
  }

  if (!hasRole(profile.role, "admin") || !isEmailVerified(profile) || !isRecentlyAuthenticated(profile)) {
    return redirectToAdmin(request, "admin_access_required");
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "admin:subscription-manage",
    key: profile.id,
    limit: 30,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(redirectToAdmin(request, "rate_limited"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return applyRateLimitHeaders(redirectToAdmin(request, "csrf_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["userId", "action", "reason", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return applyRateLimitHeaders(redirectToAdmin(request, "unexpected_fields"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const parsed = schema.safeParse({
    userId: formData.get("userId")?.toString(),
    action: formData.get("action")?.toString(),
    reason: formData.get("reason")?.toString()
  });

  if (!parsed.success) {
    return applyRateLimitHeaders(redirectToAdmin(request, "invalid_admin_request"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const admin = createSupabaseAdminClient();
  const subscriptionResult = await admin.from("subscriptions").select("*").eq("user_id", parsed.data.userId).maybeSingle();
  if (subscriptionResult.error || !subscriptionResult.data) {
    logServerError("Admin subscription lookup failed", { reason: subscriptionResult.error?.message ?? "missing", userId: parsed.data.userId });
    return applyRateLimitHeaders(redirectToAdmin(request, "update_failed"), {
      limit: 30,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const current = normalizeSubscriptionRow(parsed.data.userId, subscriptionResult.data as Record<string, unknown>);
  const base = {
    userId: parsed.data.userId,
    customerId: current.stripe_customer_id,
    subscriptionId: current.stripe_subscription_id,
    currentPeriodEnd: current.current_period_end
  };

  switch (parsed.data.action) {
    case "downgrade_to_free":
      await updateSubscriptionPlan({
        ...base,
        planKey: "free",
        status: "free",
        creditsTotal: planCatalog.free.monthlyCredits,
        creditsUsed: Math.min(current.credits_used, planCatalog.free.monthlyCredits)
      });
      break;
    case "set_past_due":
      await updateSubscriptionPlan({
        ...base,
        planKey: current.plan_key,
        status: "past_due",
        creditsTotal: current.credits_total,
        creditsUsed: current.credits_used
      });
      break;
    case "set_cancelled":
      await updateSubscriptionPlan({
        ...base,
        planKey: current.plan_key,
        status: "cancelled",
        creditsTotal: current.credits_total,
        creditsUsed: current.credits_used
      });
      break;
    case "set_refunded":
      await updateSubscriptionPlan({
        ...base,
        planKey: "free",
        status: "refunded",
        creditsTotal: planCatalog.free.monthlyCredits,
        creditsUsed: Math.min(current.credits_used, planCatalog.free.monthlyCredits)
      });
      break;
    case "restore_active":
      await updateSubscriptionPlan({
        ...base,
        planKey: current.plan_key === "free" ? "creator" : current.plan_key,
        status: "active",
        creditsTotal: current.plan_key === "free" ? planCatalog.creator.monthlyCredits : current.credits_total,
        creditsUsed: current.credits_used
      });
      break;
  }

  await logAuditEvent({
    actorUserId: profile.id,
    targetType: "subscription",
    targetId: parsed.data.userId,
    action: `admin.subscription.${parsed.data.action}`,
    metadata: buildRequestAuditMetadata(request, { reason: parsed.data.reason, previous_plan: current.plan_key, previous_status: current.status })
  });

  return applyRateLimitHeaders(redirectToAdmin(request, "updated"), {
    limit: 30,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
