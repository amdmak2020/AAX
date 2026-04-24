import { currentAccount } from "@/lib/account";
import { mockJobs, type JobMode, type JobStatus, type VideoJob } from "@/lib/jobs";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type JobRow = {
  id: string;
  title: string;
  mode: JobMode;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  progress: number;
  style: string;
  voice: string;
  credits_reserved: number;
  output_asset_path: string | null;
  error_message: string | null;
};

function mapJob(row: JobRow): VideoJob {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progress: row.progress,
    style: row.style,
    voice: row.voice,
    credits: row.credits_reserved,
    outputUrl: row.output_asset_path ?? undefined,
    error: row.error_message ?? undefined
  };
}

export async function getCurrentAppData() {
  if (!isSupabaseConfigured()) {
    return { account: currentAccount, jobs: mockJobs, usingFallback: true };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { account: currentAccount, jobs: mockJobs, usingFallback: true };
    }

    const [profileResult, subscriptionResult, jobsResult] = await Promise.all([
      supabase.from("profiles").select("full_name,email,role").eq("id", user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,credits_total,credits_used").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("video_jobs")
        .select("id,title,mode,status,created_at,updated_at,progress,style,voice,credits_reserved,output_asset_path,error_message")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (profileResult.error || subscriptionResult.error || jobsResult.error) {
      return { account: currentAccount, jobs: mockJobs, usingFallback: true };
    }

    const profile = profileResult.data;
    const subscription = subscriptionResult.data;

    return {
      account: {
        name: profile?.full_name ?? user.email ?? currentAccount.name,
        email: profile?.email ?? user.email ?? currentAccount.email,
        plan: subscription?.plan ?? "Free",
        creditsUsed: subscription?.credits_used ?? 0,
        creditsTotal: subscription?.credits_total ?? 3,
        role: profile?.role ?? "user"
      },
      jobs: (jobsResult.data ?? []).map((row) => mapJob(row as JobRow)),
      usingFallback: false
    };
  } catch {
    return { account: currentAccount, jobs: mockJobs, usingFallback: true };
  }
}

export async function getAppJob(id: string) {
  if (!isSupabaseConfigured()) {
    return mockJobs.find((job) => job.id === id);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return undefined;
    }

    const { data, error } = await supabase
      .from("video_jobs")
      .select("id,title,mode,status,created_at,updated_at,progress,style,voice,credits_reserved,output_asset_path,error_message")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return undefined;
    }

    return mapJob(data as JobRow);
  } catch {
    return mockJobs.find((job) => job.id === id);
  }
}
