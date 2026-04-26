import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, sourceUploadMaxMb, type PlanKey } from "@/lib/app-config";
import { ensureAccountRecords, updateSubscriptionUsage } from "@/lib/account-bootstrap";
import { bypassUsageLimits, getAppUrl } from "@/lib/env";
import { getProcessorProvider } from "@/lib/processor/provider";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { uploadSourceVideo } from "@/lib/storage/supabase-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createBoostSchema = z.object({
  description: z.string().trim().min(1, "Add a short description before submitting."),
  sourceUrl: z.string().optional()
});

const DEFAULT_PRESET = "balanced" as const;
const DEFAULT_TARGET_PLATFORM = "tiktok" as const;

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
    const withoutExtension = file.name.replace(/\.[^.]+$/, "").trim();
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

function isSupportedSourceUrl(input: string) {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com"
    ].includes(hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("sourceFile");

    const parsed = createBoostSchema.safeParse({
      description: formData.get("description")?.toString(),
      sourceUrl: formData.get("sourceUrl")?.toString().trim()
    });

    if (!parsed.success) {
      const descriptionError = parsed.error.flatten().fieldErrors.description?.[0];
      return respondWithCreateError(request, "missing_description", descriptionError ?? "Invalid boost job payload.", 400);
    }

    const hasFile = isUploadedFile(file);
    const sourceUrl = parsed.data.sourceUrl?.trim() || "";
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

    const limiter = enforceRateLimit({
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
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt, retryAfterSeconds: limiter.retryAfterSeconds }
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
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt }
      );
    }

    const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);

    if (useFileSource && file.size > uploadLimitMb * 1024 * 1024) {
      return applyRateLimitHeaders(
        respondWithCreateError(request, "file_too_large", `Uploads are currently limited to ${uploadLimitMb}MB.`, 400),
        { limit: 12, remaining: limiter.remaining, resetAt: limiter.resetAt }
      );
    }

    const jobId = randomUUID();
    const source =
      useFileSource && file
        ? await uploadSourceVideo({ userId: user.id, jobId, file })
        : {
            path: null,
            publicUrl: sourceUrl,
            fileName: null
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
      return applyRateLimitHeaders(respondWithCreateError(request, "generic", insert.error.message, 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt
      });
    }

    try {
      await updateSubscriptionUsage({
        subscriptionId: subscription.id,
        userId: user.id,
        nextCreditsUsed: subscription.credits_used + 1
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update credit usage.";
      return applyRateLimitHeaders(respondWithCreateError(request, "usage_update_failed", message, 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt
      });
    }

    const usageLedgerInsert = await admin.from("usage_ledger").insert({
      user_id: user.id,
      job_id: jobId,
      change_amount: -1,
      reason: usageBypassed ? "boost_job_created_bypassed_limit" : "boost_job_created"
    });

    if (usageLedgerInsert.error) {
      return applyRateLimitHeaders(respondWithCreateError(request, "usage_update_failed", usageLedgerInsert.error.message, 500), {
        limit: 12,
        remaining: limiter.remaining,
        resetAt: limiter.resetAt
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
      sourceFileName: useFileSource && file ? file.name : null,
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
      resetAt: limiter.resetAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Boost job creation failed.";
    return respondWithCreateError(request, "generic", message, 500);
  }
}
