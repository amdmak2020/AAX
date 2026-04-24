import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, sourceUploadMaxMb, type PlanKey } from "@/lib/app-config";
import { ensureAccountRecords, updateSubscriptionUsage } from "@/lib/account-bootstrap";
import { bypassUsageLimits, getAppUrl } from "@/lib/env";
import { getProcessorProvider } from "@/lib/processor/provider";
import { uploadSourceVideo } from "@/lib/storage/supabase-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createBoostSchema = z.object({
  description: z.string().trim().min(1, "Add a short description before submitting."),
  sourceUrl: z.string().optional()
});

const DEFAULT_PRESET = "balanced" as const;
const DEFAULT_TARGET_PLATFORM = "tiktok" as const;

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
      return NextResponse.json({ error: descriptionError ?? "Invalid boost job payload." }, { status: 400 });
    }

    const hasFile = isUploadedFile(file);
    const sourceUrl = parsed.data.sourceUrl?.trim() || "";
    const hasUrl = sourceUrl.length > 0;
    const useUrlSource = hasUrl;
    const useFileSource = hasFile && !useUrlSource;
    const projectName = getProjectName(sourceUrl, useFileSource ? file : null);

    if (!useFileSource && !useUrlSource) {
      return NextResponse.json({ error: "Choose either a source upload or a YouTube / X URL." }, { status: 400 });
    }

    if (useUrlSource && !isSupportedSourceUrl(sourceUrl)) {
      return NextResponse.json({ error: "Only YouTube and X / Twitter links are supported right now." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/app/create", request.url));
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
      return NextResponse.json({ error: "No boosts remaining on the current plan." }, { status: 402 });
    }

    const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);

    if (useFileSource && file.size > uploadLimitMb * 1024 * 1024) {
      return NextResponse.json({ error: `Uploads are currently limited to ${uploadLimitMb}MB.` }, { status: 400 });
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
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    try {
      await updateSubscriptionUsage({
        subscriptionId: subscription.id,
        userId: user.id,
        nextCreditsUsed: subscription.credits_used + 1
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update credit usage.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const usageLedgerInsert = await admin.from("usage_ledger").insert({
      user_id: user.id,
      job_id: jobId,
      change_amount: -1,
      reason: usageBypassed ? "boost_job_created_bypassed_limit" : "boost_job_created"
    });

    if (usageLedgerInsert.error) {
      return NextResponse.json({ error: usageLedgerInsert.error.message }, { status: 500 });
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

    return NextResponse.redirect(new URL(`/app/jobs/${jobId}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Boost job creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
