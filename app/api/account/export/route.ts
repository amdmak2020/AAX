import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Export is unavailable." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const [profile, subscription, jobs, usage] = await Promise.all([
    admin.from("profiles").select("email,full_name,role,created_at,updated_at").eq("id", user.id).maybeSingle(),
    admin.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("video_jobs").select("id,title,status,created_at,updated_at,output_asset_path,error_message,progress").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    admin.from("usage_ledger").select("change_amount,reason,created_at,job_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500)
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? null
    },
    profile: profile.data ?? null,
    subscription: subscription.data ?? null,
    jobs: jobs.data ?? [],
    usage: usage.data ?? []
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="autoagentx-export-${user.id}.json"`,
      "cache-control": "no-store"
    }
  });
}
