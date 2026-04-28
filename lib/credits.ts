import { reserveIdempotencyKey } from "@/lib/idempotency";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/secure-log";
import { refundSubscriptionCredit } from "@/lib/account-bootstrap";

type RefundReason =
  | "processor_failed"
  | "n8n_failed"
  | "admin_cancelled"
  | "processor_unavailable"
  | "manual_refund";

export async function refundReservedCreditForJob(input: {
  jobId: string;
  userId: string;
  reason: RefundReason;
  request?: Request;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const reservation = await reserveIdempotencyKey({
    scope: "job-failed-refund",
    key: input.jobId,
    ttlSeconds: 365 * 24 * 60 * 60
  });

  if (!reservation.reserved) {
    return { refunded: false as const, reason: "already_refunded" as const };
  }

  const admin = createSupabaseAdminClient();
  const [jobResult, subscriptionResult] = await Promise.all([
    admin.from("video_jobs").select("id,user_id,credits_reserved").eq("id", input.jobId).maybeSingle(),
    admin.from("subscriptions").select("id,credits_used").eq("user_id", input.userId).maybeSingle()
  ]);

  if (jobResult.error) {
    throw new Error(jobResult.error.message);
  }

  if (subscriptionResult.error) {
    throw new Error(subscriptionResult.error.message);
  }

  const reservedCredits = typeof jobResult.data?.credits_reserved === "number" ? jobResult.data.credits_reserved : 0;
  const currentCreditsUsed = typeof subscriptionResult.data?.credits_used === "number" ? subscriptionResult.data.credits_used : 0;

  if (!jobResult.data || jobResult.data.user_id !== input.userId || reservedCredits < 1) {
    return { refunded: false as const, reason: "no_reserved_credit" as const };
  }

  const subscriptionId = typeof subscriptionResult.data?.id === "string" ? subscriptionResult.data.id : null;
  const creditReleased = await refundSubscriptionCredit({
    subscriptionId,
    currentCreditsUsed
  });

  if (!creditReleased) {
    return { refunded: false as const, reason: "credit_update_conflict" as const };
  }

  const usageLedgerInsert = await admin.from("usage_ledger").insert({
    user_id: input.userId,
    job_id: input.jobId,
    change_amount: 1,
    reason: `boost_job_credit_refund:${input.reason}`
  });

  if (usageLedgerInsert.error) {
    logServerError("Failed to write usage ledger refund entry", {
      reason: usageLedgerInsert.error.message,
      jobId: input.jobId,
      userId: input.userId,
      refundReason: input.reason
    });
  }

  const jobUpdate = await admin
    .from("video_jobs")
    .update({
      credits_reserved: 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.jobId);

  if (jobUpdate.error) {
    logServerError("Failed to zero reserved credits on refunded job", {
      reason: jobUpdate.error.message,
      jobId: input.jobId,
      userId: input.userId,
      refundReason: input.reason
    });
  }

  await logAuditEvent({
    actorUserId: input.actorUserId ?? input.userId,
    targetType: "video_job",
    targetId: input.jobId,
    action: "billing.credit_refunded",
    metadata: input.request
      ? buildRequestAuditMetadata(input.request, { refund_reason: input.reason, note: input.note ?? null })
      : { refund_reason: input.reason, note: input.note ?? null }
  });

  return { refunded: true as const, reason: "refunded" as const };
}
