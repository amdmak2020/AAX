import { planCatalog, type PlanKey } from "@/lib/app-config";
import { normalizeRole, type AppRole } from "@/lib/access-control";
import { ensureAccountRecords, normalizeSubscriptionRow } from "@/lib/account-bootstrap";
import type { BoostJob } from "@/lib/boost-jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { materializeRemoteOutputVideo, resolveStoredOutputVideoUrl } from "@/lib/storage/supabase-storage";
import { sanitizeMultilineText, sanitizeSingleLineText } from "@/lib/validation";

type SubscriptionRow = {
  plan_key: PlanKey;
  credits_total: number;
  credits_used: number;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

type BoostJobRow = {
  id: string;
  user_id: string;
  title: string;
  status: BoostJob["status"];
  style: string | null;
  voice: string | null;
  twitter_url: string | null;
  processor_provider?: string | null;
  n8n_execution_id?: string | null;
  output_asset_path: string | null;
  error_message: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

type ViewerProfile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  is_suspended: boolean;
  submissions_locked: boolean;
  billing_locked: boolean;
  abuse_flags: number;
  suspended_reason: string | null;
};

type ViewerWorkspace = {
  profile: ViewerProfile;
  subscription: SubscriptionRow;
  jobs: BoostJob[];
};

function asPreset(value: string | null | undefined): BoostJob["preset"] {
  return value === "hook-boost" || value === "caption-boost" || value === "retention-boost" || value === "balanced" ? value : "balanced";
}

function asTargetPlatform(value: string | null | undefined): BoostJob["targetPlatform"] {
  return value === "tiktok" || value === "youtube-shorts" || value === "instagram-reels" ? value : "tiktok";
}

async function mapBoostJob(row: BoostJobRow): Promise<BoostJob> {
  const resolvedOutputUrl = await resolveStoredOutputVideoUrl(row.output_asset_path);
  return {
    id: row.id,
    userId: row.user_id,
    projectName: sanitizeSingleLineText(row.title).slice(0, 160) || "Boosted clip",
    status: row.status,
    preset: asPreset(row.style),
    targetPlatform: asTargetPlatform(row.voice),
    description: null,
    processorProvider: row.processor_provider ?? "n8n",
    externalJobId: row.n8n_execution_id ?? null,
    sourceVideoUrl: row.twitter_url ?? "",
    sourceFileName: null,
    outputVideoUrl: resolvedOutputUrl,
    outputPosterUrl: null,
    errorMessage: row.error_message ? sanitizeMultilineText(row.error_message).slice(0, 600) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
    progress: row.progress
  };
}

export async function getViewerWorkspace(): Promise<ViewerWorkspace | null> {
  if (!isSupabaseConfigured()) {
    return {
      profile: {
        id: "demo-user",
        email: "creator@example.com",
        full_name: "Demo Creator",
        role: "admin",
        email_confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        is_suspended: false,
        submissions_locked: false,
        billing_locked: false,
        abuse_flags: 0,
        suspended_reason: null
      },
      subscription: {
        plan_key: "free" as PlanKey,
        credits_total: planCatalog.free.monthlyCredits,
        credits_used: 0,
        status: "trialing",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_end: null
      },
      jobs: [] as BoostJob[]
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const ensuredSubscription = await ensureAccountRecords(user);

  const [profileResult, subscriptionResult, jobsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,role,is_suspended,submissions_locked,billing_locked,abuse_flags,suspended_reason")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("video_jobs")
      .select(
        "id,user_id,title,status,style,voice,twitter_url,error_message,progress,created_at,updated_at,output_asset_path,n8n_execution_id"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  return {
    profile: {
      ...(profileResult.data ?? { id: user.id, email: user.email ?? "", full_name: "", role: "user" }),
      email: sanitizeSingleLineText(profileResult.data?.email ?? user.email ?? "").slice(0, 320),
      full_name: sanitizeSingleLineText(profileResult.data?.full_name ?? "").slice(0, 120),
      role: normalizeRole((profileResult.data?.role as AppRole | "user" | undefined) ?? "user"),
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      is_suspended: profileResult.data?.is_suspended ?? false,
      submissions_locked: profileResult.data?.submissions_locked ?? false,
      billing_locked: profileResult.data?.billing_locked ?? false,
      abuse_flags: profileResult.data?.abuse_flags ?? 0,
      suspended_reason: profileResult.data?.suspended_reason ?? null
    } satisfies ViewerProfile,
    subscription:
      subscriptionResult.data
        ? (normalizeSubscriptionRow(user.id, subscriptionResult.data as Record<string, unknown>) satisfies SubscriptionRow)
        : ({
            plan_key: ensuredSubscription.plan_key,
            credits_total: ensuredSubscription.credits_total,
            credits_used: ensuredSubscription.credits_used,
            status: ensuredSubscription.status,
            stripe_customer_id: ensuredSubscription.stripe_customer_id,
            stripe_subscription_id: ensuredSubscription.stripe_subscription_id,
            current_period_end: ensuredSubscription.current_period_end
          } satisfies SubscriptionRow),
    jobs: await Promise.all(((jobsResult.data ?? []) as BoostJobRow[]).map(mapBoostJob))
  };
}

export async function getBoostJobForViewer(id: string) {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;
  const job = workspace.jobs.find((entry) => entry.id === id) ?? null;
  if (!job || !job.outputVideoUrl || !/^https?:\/\//i.test(job.outputVideoUrl) || job.status !== "completed") {
    return job;
  }

  const admin = createSupabaseAdminClient();
  const rawJobResult = await admin
    .from("video_jobs")
    .select("id,user_id,output_asset_path")
    .eq("id", id)
    .maybeSingle();

  const rawStoredOutput = typeof rawJobResult.data?.output_asset_path === "string" ? rawJobResult.data.output_asset_path : null;
  const rawUserId = typeof rawJobResult.data?.user_id === "string" ? rawJobResult.data.user_id : null;

  if (!rawStoredOutput || !rawUserId || !/^https?:\/\//i.test(rawStoredOutput)) {
    return job;
  }

  try {
    const hosted = await materializeRemoteOutputVideo({
      userId: rawUserId,
      jobId: id,
      remoteUrl: rawStoredOutput
    });

    await admin
      .from("video_jobs")
      .update({
        output_asset_path: hosted.path,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    return {
      ...job,
      outputVideoUrl: hosted.signedUrl
    };
  } catch {
    return job;
  }
}

export async function getAdminOverview() {
  const admin = createSupabaseAdminClient();
  const [users, jobs, subscriptions] = await Promise.all([
    admin
      .from("profiles")
      .select("id,email,full_name,role,created_at,is_suspended,submissions_locked,billing_locked,abuse_flags,suspended_reason")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("video_jobs")
      .select(
        "id,user_id,title,status,style,voice,twitter_url,error_message,progress,created_at,updated_at,output_asset_path,n8n_execution_id"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("subscriptions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50)
  ]);

  return {
    users: users.data ?? [],
    jobs: await Promise.all(((jobs.data ?? []) as BoostJobRow[]).map(mapBoostJob)),
    subscriptions: subscriptions.data ?? []
  };
}
