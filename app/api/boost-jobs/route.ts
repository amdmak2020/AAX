import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, sourceUploadMaxMb, type PlanKey } from "@/lib/app-config";
import { ensureAccountRecords, normalizeProfileSecurityRow, updateSubscriptionUsage } from "@/lib/account-bootstrap";
import { areSubmissionsLocked, isAccountSuspended } from "@/lib/access-control";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { bypassUsageLimits, getAppUrl } from "@/lib/env";
import { detectVideoFileType } from "@/lib/file-security";
import { reserveIdempotencyKey } from "@/lib/idempotency";
import { parseSafeRemoteUrl } from "@/lib/network-security";
import { getProcessorProvider } from "@/lib/processor/provider";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { logServerError } from "@/lib/secure-log";
import { uploadSourceVideo } from "@/lib/storage/supabase-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, multilineTextSchema, optionalHttpUrlSchema, requestExceedsBytes, sanitizeSingleLineText } from "@/lib/validation";

const createBoostSchema = z.object({
  description: multilineTextSchema({ min: 1, max: 600, requiredMessage: "Add a short description before submitting.", tooLongMessage: "Keep the description under 600 characters." }),
  sourceUrl: optionalHttpUrlSchema.optional(),
  idempotencyKey: z.string().trim().uuid("Refresh and try again before submitting.")
}).strict();

const DEFAULT_PRESET = "balanced" as const;
const DEFAULT_TARGET_PLATFORM = "tiktok" as const;
const MAX_CREATE_REQUEST_BYTES = (sourceUploadMaxMb + 2) * 1024 * 1024;
const allowedSourceHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "x.com", "www.x.com", "twitter.com", "www.twitter.com"]);

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function buildCreateErrorUrl(request: Request, code: string) {
  const url = new URL("/app/create", request.url);
  url.searchParams.set("error", code);
  return url;
}

function respondWithCreateError(request: Request, code: string, message: string, status: number) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: message, code }, { status });
  }

  return NextResponse.redirect(buildCreateErrorUrl(request, code), { status: 303 });
}

function getProjectName(sourceUrl: string, file: File | null) {
  if (file?.name?.trim()) {
    const withoutExtension = sanitizeSingleLineText(file.name.replace(/\.[^.]+$/, ""));
    return withoutExtension || "Boosted clip";
  }

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.hostname.includes("youtu")) {
        return "YouTube clip";
      }
      if (url.hostname.includes("x.com") || url.hostname.includes("twitter.com")) {
        return "X clip";
      }
    } catch {
      return "Boosted clip";
    }
  }

  return "Boosted clip";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.name.trim().length > 0;
}

function isSupportedUploadedFile(file: File) {
  return file.size > 0;
}

function isSupportedSourceUrl(input: string) {
  try {
    const url = parseSafeRemoteUrl(input, { allowHosts: allowedSourceHosts });
    return allowedSourceHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (requestExceedsBytes(request, MAX_CREATE_REQUEST_BYTES)) {
      return respondWithCreateError(request, "request_too_large", `Uploads are currently limited to ${sourceUploadMaxMb}MB.`, 413);
    }

    const formData = await request.formData();
    const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
    if (!csrfCheck.ok) {
      return respondWithCreateError(request, "csrf_failed", "Your session expired. Refresh and try again.", 403);
    }

    const unexpectedFields = getUnexpectedFormFields(formData, ["sourceFile", "sourceUrl", "description", "csrfToken", "idempotencyKey"]);
    if (unexpectedFields.length > 0) {
      return respondWithCreateError(request, "unexpected_fields", "Unexpected fields were submitted.", 400);
    }

    const file = formData.get("sourceFile");

    const parsed = createBoostSchema.safeParse({
      description: formData.get("description")?.toString(),
      sourceUrl: formData.get("sourceUrl")?.toString().trim(),
      idempotencyKey: formData.get("idempotencyKey")?.toString()
    });

    if (!parsed.success) {
      const descriptionError = parsed.error.flatten().fieldErrors.description?.[0];
      return respondWithCreateError(request, "missing_description", descriptionError ?? "Invalid boost job payload.", 400);
    }

    const hasFile = isUploadedFile(file);
    const sourceUrl = parsed.data.sourceUrl || "";
    const hasUrl = sourceUrl.length > 0;
    const useUrlSource = hasUrl;
    const useFileSource = hasFile && !useUrlSource;
    const projectName = getProjectName(sourceUrl, useFileSource ? file : null);

    if (!useFileSource && !useUrlSource) {
      return respondWithCreateError(request, "missing_source", "Choose either a source upload or a YouTube / X URL.", 400);
    }

    if (useUrlSource && !isSupportedSourceUrl(sourceUrl)) {
      return respondWithCreateError(request, "unsupported_source", "Only YouTube and X / Twitter links are supported right now.", 400);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/app/create", request.url), { status: 303 });
    }

    const profileGuardResult = await supabase
      .from("profiles")
      .select("is_suspended,submissions_locked,suspended_reason,abuse_flags")
      .eq("id", user.id)
      .maybeSingle();
    const profileGuard = normalizeProfileSecurityRow(profileGuardResult.data as Record<string, unknown> | null | undefined);

    if (isAccountSuspended(profileGuard)) {
      return respondWithCreateError(request, "account_suspended", profileGuard.suspended_reason ?? "Your account is suspended. Contact support for help.", 403);
    }

    if (areSubmissionsLocked(profileGuard)) {
      return respondWithCreateError(request, "submissions_locked", "New boost submissions are currently locked on this account.", 403);
    }

    const limiter = await enforceRateLimit({
      request,
      bucket: "boost-jobs:create",
      key: user.id,
      limit: 12,
      windowMs: 15 * 60 * 1000
    });

    if (!limiter.allowed) {
      return applyRateLimitHeaders(
        respondWithCreateError(
          request,
          "rate_limited",
          "You have submitted a lot of boost jobs in a short window. Give it a minute and try again.",
          429
        ),
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds, store: limiter.store }
      );
    }

    const admin = createSupabaseAdminClient();
    const subscription = (await ensureAccountRecords(user)) as {
      id: string | null;
      plan_key: PlanKey;
      credits_total: number;
      credits_used: number;
    };
    const plan = planCatalog[subscription.plan_key];
    const usageBypassed = bypassUsageLimits();

    if (!usageBypassed && subscription.credits_used >= subscription.credits_total) {
      return applyRateLimitHeaders(
        respondWithCreateError(request, "no_credits", "No boosts remaining on the current plan.", 402),
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
      );
    }

    const reservation = await reserveIdempotencyKey({
      scope: `boost-job:${user.id}`,
      key: parsed.data.idempotencyKey,
      ttlSeconds: 60 * 60
    });
    if (!reservation.reserved) {
      return applyRateLimitHeaders(
        respondWithCreateError(request, "duplicate_submission", "That clip was already submitted. Refresh before trying again.", 409),
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
      );
    }

    const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);

    if (useFileSource && file.size > uploadLimitMb * 1024 * 1024) {
      return applyRateLimitHeaders(
        respondWithCreateError(request, "file_too_large", `Uploads are currently limited to ${uploadLimitMb}MB.`, 400),
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
      );
    }

    if (useFileSource && file) {
      if (file.name.length > 255) {
        return applyRateLimitHeaders(respondWithCreateError(request, "file_name_too_long", "File names must stay under 255 characters.", 400), {
          limit: 12,
          remaining: limiter.remaining,
          resetAt: limiter.resetAt,
          store: limiter.store
        });
      }

      if (!isSupportedUploadedFile(file)) {
        return applyRateLimitHeaders(
          respondWithCreateError(request, "unsupported_file_type", "Upload an MP4, MOV, M4V, or WebM video.", 400),
          { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
        );
      }

      const detectedType = detectVideoFileType(new Uint8Array(await file.slice(0, 96).arrayBuffer()));
      if (!detectedType) {
        return applyRateLimitHeaders(
          respondWithCreateError(request, "unsupported_file_type", "Upload an MP4, MOV, M4V, or WebM video.", 400),
          { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
        );
      }
    }

    const jobId = randomUUID();
    const source =
      useFileSource && file
        ? await uploadSourceVideo({ userId: user.id, jobId, file })
        : {
            path: null,
            publicUrl: sourceUrl,
            fileName: null,
            detectedMime: null
          };

    const insert = await admin.from("video_jobs").insert({
      id: jobId,
      user_id: user.id,
      title: projectName,
      mode: "twitter",
      status: "queued",
      twitter_url: source.publicUrl,
      style: DEFAULT_PRESET,
      voice: DEFAULT_TARGET_PLATFORM,
      progress: 5,
      credits_reserved: 1
    });

    if (insert.error) {
      logServerError("Boost job insert failed", { reason: insert.error.message, userId: user.id, jobId });
      return applyRateLimitHeaders(respondWithCreateError(request, "generic", "We couldn't save that submission right now.", 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    await logAuditEvent({
      actorUserId: user.id,
      targetType: "video_job",
      targetId: jobId,
      action: "boost_job.created",
      metadata: buildRequestAuditMetadata(request, {
        plan_key: subscription.plan_key,
        source_type: useFileSource ? "upload" : "external-url"
      })
    });

    try {
      await updateSubscriptionUsage({
        subscriptionId: subscription.id,
        userId: user.id,
        nextCreditsUsed: subscription.credits_used + 1
      });
    } catch (error) {
      logServerError("Boost job usage update failed", { error, userId: user.id, jobId });
      return applyRateLimitHeaders(respondWithCreateError(request, "usage_update_failed", "We couldn't reserve a credit for that clip.", 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const usageLedgerInsert = await admin.from("usage_ledger").insert({
      user_id: user.id,
      job_id: jobId,
      change_amount: -1,
      reason: usageBypassed ? "boost_job_created_bypassed_limit" : "boost_job_created"
    });

    if (usageLedgerInsert.error) {
      logServerError("Usage ledger insert failed", { reason: usageLedgerInsert.error.message, userId: user.id, jobId });
      return applyRateLimitHeaders(respondWithCreateError(request, "usage_update_failed", "We couldn't finalize the credit reservation.", 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt,
        store: limiter.store
      });
    }

    const provider = getProcessorProvider();
    const submit = await provider.submitJob({
      jobId,
      userId: user.id,
      projectName,
      preset: DEFAULT_PRESET,
      targetPlatform: DEFAULT_TARGET_PLATFORM,
      description: parsed.data.description,
      sourceType: useFileSource ? "upload" : "external-url",
      sourceVideoUrl: source.publicUrl,
      sourceFileName: source.fileName,
      callbackUrl: `${getAppUrl()}/api/webhooks/processor`,
      advanced: {
        subtitleStyle: null,
        addOpeningText: true,
        cropMode: null,
        extraNotes: null
      }
    });

    await admin
      .from("video_jobs")
      .update({
        status: submit.accepted ? submit.status : "failed",
        n8n_execution_id: submit.externalJobId ?? null,
        error_message: submit.accepted ? null : submit.message ?? "Processor was unavailable.",
        progress: submit.accepted ? (submit.status === "queued" ? 10 : 25) : 0,
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);

    return applyRateLimitHeaders(NextResponse.redirect(new URL(`/app/jobs/${jobId}`, request.url), { status: 303 }), {
      limit: 12,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  } catch (error) {
    logServerError("Boost job creation failed", { error });
    return respondWithCreateError(request, "generic", "The boost did not start. Please try again.", 500);
  }
}
