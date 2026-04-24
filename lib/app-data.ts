import { planCatalog, type PlanKey } from "@/lib/app-config";
import { ensureAccountRecords, normalizeSubscriptionRow } from "@/lib/account-bootstrap";
import type { BoostJob } from "@/lib/boost-jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

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

function asPreset(value: string | null | undefined): BoostJob["preset"] {
  return value === "hook-boost" || value === "caption-boost" || value === "retention-boost" || value === "balanced" ? value : "balanced";
}

function asTargetPlatform(value: string | null | undefined): BoostJob["targetPlatform"] {
  return value === "tiktok" || value === "youtube-shorts" || value === "instagram-reels" ? value : "tiktok";
}

function mapBoostJob(row: BoostJobRow): BoostJob {
  return {
    id: row.id,
    userId: row.user_id,
    projectName: row.title,
    status: row.status,
    preset: asPreset(row.style),
    targetPlatform: asTargetPlatform(row.voice),
    description: null,
    processorProvider: row.processor_provider ?? "n8n",
    externalJobId: row.n8n_execution_id ?? null,
    sourceVideoUrl: row.twitter_url ?? "",
    sourceFileName: null,
    outputVideoUrl: row.output_asset_path,
    outputPosterUrl: null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
    progress: row.progress
  };
}

export async function getViewerWorkspace() {
  if (!isSupabaseConfigured()) {
    return {
      profile: { id: "demo-user", email: "creator@example.com", full_name: "Demo Creator", role: "admin" },
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
    supabase.from("profiles").select("id,email,full_name,role").eq("id", user.id).maybeSingle(),
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
    profile: profileResult.data ?? { id: user.id, email: user.email ?? "", full_name: "", role: "user" },
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
    jobs: ((jobsResult.data ?? []) as BoostJobRow[]).map(mapBoostJob)
  };
}

export async function getBoostJobForViewer(id: string) {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;
  return workspace.jobs.find((job) => job.id === id) ?? null;
}

export async function getAdminOverview() {
  const admin = createSupabaseAdminClient();
  const [users, jobs, subscriptions] = await Promise.all([
    admin.from("profiles").select("id,email,full_name,role,created_at").order("created_at", { ascending: false }).limit(30),
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
    jobs: ((jobs.data ?? []) as BoostJobRow[]).map(mapBoostJob),
    subscriptions: subscriptions.data ?? []
  };
}
