import { NextResponse } from "next/server";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { statusLabels } from "@/lib/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { secureCompare } from "@/lib/security";

export async function POST(request: Request) {
  const secret = getEnv("N8N_WEBHOOK_SECRET");
  const incoming = request.headers.get("x-shorts-machine-secret");

  if (!secureCompare(secret, incoming)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validStatuses = Object.keys(statusLabels);
  if (!body.jobId || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("video_jobs")
      .update({
        status: body.status,
        progress: body.progress ?? undefined,
        output_asset_path: body.outputUrl ?? body.output_asset_path ?? undefined,
        error_message: body.error ?? body.error_message ?? undefined,
        n8n_execution_id: body.executionId ?? body.n8n_execution_id ?? undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", body.jobId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
