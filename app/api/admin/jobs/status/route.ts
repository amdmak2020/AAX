import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["draft", "queued", "processing", "rendering", "completed", "failed"]),
  outputVideoUrl: z.string().url().optional().or(z.literal("")),
  errorMessage: z.string().optional()
});

export async function POST(request: Request) {
  await requireAdmin();
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid admin status payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("video_jobs")
    .update({
      status: parsed.data.status,
      output_asset_path: parsed.data.outputVideoUrl || undefined,
      error_message: parsed.data.errorMessage ?? undefined,
      progress: parsed.data.status === "completed" ? 100 : parsed.data.status === "rendering" ? 80 : parsed.data.status === "processing" ? 40 : 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.jobId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
