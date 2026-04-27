import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { triggerVideoWorkflow } from "@/lib/n8n";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnexpectedFormFields, optionalHttpUrlSchema, requestExceedsBytes, singleLineTextSchema } from "@/lib/validation";

const createJobSchema = z.object({
  mode: z.literal("twitter"),
  title: singleLineTextSchema({ min: 2, max: 120, requiredMessage: "Title is required.", tooLongMessage: "Title is too long." }),
  twitterUrl: optionalHttpUrlSchema,
  style: singleLineTextSchema({ min: 1, max: 80, requiredMessage: "Style is required.", tooLongMessage: "Style is too long." }),
  voice: singleLineTextSchema({ min: 1, max: 80, requiredMessage: "Voice is required.", tooLongMessage: "Voice is too long." })
}).strict();
const maxLegacyJobRequestBytes = 128 * 1024;

export async function POST(request: Request) {
  if (requestExceedsBytes(request, maxLegacyJobRequestBytes)) {
    return NextResponse.json({ error: "Job payload is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const unexpectedFields = getUnexpectedFormFields(formData, ["mode", "title", "twitterUrl", "style", "voice"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.json({ error: "Unexpected fields were submitted." }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse({
    mode: formData.get("mode"),
    title: formData.get("title"),
    twitterUrl: formData.get("twitterUrl")?.toString(),
    style: formData.get("style"),
    voice: formData.get("voice")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job payload", details: parsed.error.flatten() }, { status: 400 });
  }

  let jobId = `job_${Date.now()}`;
  let userId = "demo-user";
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  if (isSupabaseConfigured()) {
    supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userId = user.id;

    const { data, error } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        mode: parsed.data.mode,
        title: parsed.data.title,
        twitter_url: parsed.data.twitterUrl,
        style: parsed.data.style,
        voice: parsed.data.voice,
        status: "queued",
        progress: 0,
        credits_reserved: 1
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    jobId = data.id;

    try {
      const admin = createSupabaseAdminClient();
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("id,credits_used,credits_total")
        .eq("user_id", user.id)
        .maybeSingle();

      if (subscription) {
        await admin
          .from("subscriptions")
          .update({
            credits_used: Math.min((subscription.credits_used ?? 0) + 1, subscription.credits_total ?? 1),
            updated_at: new Date().toISOString()
          })
          .eq("id", subscription.id);
      }
    } catch {
      // Job creation should not fail just because usage accounting needs attention.
    }
  }

  const workflowResult = await triggerVideoWorkflow({
    jobId,
    userId,
    ...parsed.data,
    url: parsed.data.twitterUrl,
    videoUrl: parsed.data.twitterUrl,
    callbackUrl: `${getAppUrl()}/api/webhooks/n8n`
  });

  if (!workflowResult.ok && supabase) {
    await supabase
      .from("video_jobs")
      .update({
        status: "failed",
        progress: 0,
        error_message: workflowResult.reason ?? "The video workflow could not be started.",
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId)
      .eq("user_id", userId);
  }

  if (workflowResult.ok && supabase) {
    await supabase
      .from("video_jobs")
      .update({
        status: "processing",
        progress: 10,
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId)
      .eq("user_id", userId);
  }

  redirect(`/jobs/${jobId}${workflowResult.ok ? "" : "?workflow=failed"}`);
}
