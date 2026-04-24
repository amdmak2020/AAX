import { NextResponse } from "next/server";
import { getProcessorProvider } from "@/lib/processor/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security";

export async function POST(request: Request) {
  const secret = getEnv("N8N_PROCESSOR_SECRET");
  const incoming = request.headers.get("x-processor-secret");

  if (!secureCompare(secret, incoming)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const provider = getProcessorProvider();
  const parsed = provider.parseWebhook ? await provider.parseWebhook(payload) : null;

  if (!parsed) {
    return NextResponse.json({ error: "Invalid processor webhook payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  let targetId = parsed.jobId ?? null;

  if (!targetId && parsed.externalJobId) {
    const lookup = await admin.from("video_jobs").select("id").eq("n8n_execution_id", parsed.externalJobId).maybeSingle();
    targetId = lookup.data?.id ?? null;
  }

  if (!targetId) {
    return NextResponse.json({ error: "Could not resolve target job." }, { status: 400 });
  }

  const update = await admin
    .from("video_jobs")
    .update({
      status: parsed.status,
      progress: parsed.progress ?? undefined,
      output_asset_path: parsed.outputVideoUrl ?? undefined,
      error_message: parsed.errorMessage ?? undefined,
      updated_at: new Date().toISOString()
    })
    .eq("id", targetId);

  if (update.error) {
    return NextResponse.json({ error: update.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
