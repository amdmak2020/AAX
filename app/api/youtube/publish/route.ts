import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCsrfRequest } from "@/lib/csrf";
import { reserveIdempotencyKey } from "@/lib/idempotency";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { enforceRateLimit, applyRateLimitHeaders } from "@/lib/request-security";
import { createSignedOutputVideoUrl } from "@/lib/storage/supabase-storage";
import { getUnexpectedFormFields, multilineTextSchema, requestExceedsBytes, sanitizeSingleLineText, singleLineTextSchema } from "@/lib/validation";
import {
  YouTubeConnectionRecord,
  getAccessTokenFromConnection,
  getRefreshTokenFromConnection,
  hasYouTubeConfig,
  refreshYouTubeAccessToken,
  uploadVideoToYouTube
} from "@/lib/youtube";
import { encryptSecret } from "@/lib/secrets";
import { logServerError } from "@/lib/secure-log";

const publishMaxRequestBytes = 32 * 1024;

const publishSchema = z
  .object({
    jobId: z.string().uuid("Refresh and try again."),
    idempotencyKey: z.string().trim().uuid("Refresh and try again."),
    title: singleLineTextSchema({ min: 3, max: 100, requiredMessage: "Add a title before posting." }),
    description: multilineTextSchema({ max: 5000 }),
    tags: z
      .string()
      .trim()
      .max(500, "Keep tags shorter.")
      .transform((value) =>
        value
          .split(",")
          .map((entry) => sanitizeSingleLineText(entry))
          .filter(Boolean)
          .slice(0, 20)
      ),
    privacyStatus: z.enum(["private", "unlisted", "public"]),
    publishMode: z.enum(["now", "schedule"]),
    scheduleAt: z.string().trim().optional(),
    timezoneOffsetMinutes: z
      .string()
      .trim()
      .regex(/^-?\d+$/)
      .transform((value) => Number(value))
  })
  .strict();

function buildReturnUrl(request: Request, jobId: string, notice: string) {
  const url = new URL(`/app/jobs/${jobId}`, request.url);
  url.searchParams.set("notice", notice);
  return url;
}

function parseScheduledAt(localValue: string | undefined, timezoneOffsetMinutes: number) {
  if (!localValue) {
    return null;
  }

  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) + timezoneOffsetMinutes * 60_000;
  return new Date(timestamp);
}

async function getFreshYouTubeAccessToken(connection: YouTubeConnectionRecord) {
  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  const now = Date.now();
  if (expiresAt - now > 60_000) {
    return getAccessTokenFromConnection(connection);
  }

  const refreshToken = getRefreshTokenFromConnection(connection);
  if (!refreshToken) {
    throw new Error("No refresh token is available for this YouTube connection.");
  }

  const refreshed = await refreshYouTubeAccessToken({ appUrl: "", refreshToken });

  const admin = createSupabaseAdminClient();
  await admin
    .from("youtube_connections")
    .update({
      encrypted_access_token: encryptSecret(refreshed.access_token),
      scope: refreshed.scope ?? connection.scope,
      access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString()
    })
    .eq("user_id", connection.user_id);

  return refreshed.access_token;
}

export async function POST(request: Request) {
  if (requestExceedsBytes(request, publishMaxRequestBytes)) {
    return NextResponse.redirect(new URL("/app/jobs?notice=publish_failed", request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL("/app/settings?notice=csrf_failed", request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, [
    "jobId",
    "idempotencyKey",
    "csrfToken",
    "title",
    "description",
    "tags",
    "privacyStatus",
    "publishMode",
    "scheduleAt",
    "timezoneOffsetMinutes"
  ]);
  if (unexpectedFields.length > 0) {
    const jobId = formData.get("jobId")?.toString() ?? "";
    return NextResponse.redirect(buildReturnUrl(request, jobId, "publish_failed"), { status: 303 });
  }

  const parsed = publishSchema.safeParse({
    jobId: formData.get("jobId")?.toString(),
    idempotencyKey: formData.get("idempotencyKey")?.toString(),
    title: formData.get("title")?.toString(),
    description: formData.get("description")?.toString() ?? "",
    tags: formData.get("tags")?.toString() ?? "",
    privacyStatus: formData.get("privacyStatus")?.toString(),
    publishMode: formData.get("publishMode")?.toString(),
    scheduleAt: formData.get("scheduleAt")?.toString() ?? "",
    timezoneOffsetMinutes: formData.get("timezoneOffsetMinutes")?.toString() ?? "0"
  });

  if (!parsed.success) {
    const fallbackId = formData.get("jobId")?.toString() ?? "";
    return NextResponse.redirect(buildReturnUrl(request, fallbackId, "publish_invalid"), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/app/jobs/${parsed.data.jobId}`, request.url), { status: 303 });
  }

  if (!hasYouTubeConfig()) {
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "youtube_config_missing"), { status: 303 });
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "youtube:publish",
    key: user.id,
    limit: 8,
    windowMs: 30 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "publish_rate_limited"), { status: 303 }), {
      limit: 8,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  const reservation = await reserveIdempotencyKey({
    scope: `youtube-publish:${user.id}:${parsed.data.jobId}`,
    key: parsed.data.idempotencyKey,
    ttlSeconds: 60 * 60
  });
  if (!reservation.reserved) {
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "publish_duplicate"), { status: 303 });
  }

  const scheduleDate =
    parsed.data.publishMode === "schedule" ? parseScheduledAt(parsed.data.scheduleAt, parsed.data.timezoneOffsetMinutes) : null;
  if (parsed.data.publishMode === "schedule" && (!scheduleDate || scheduleDate.getTime() < Date.now() + 5 * 60_000)) {
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "publish_schedule_invalid"), { status: 303 });
  }

  const admin = createSupabaseAdminClient();
  const [jobResult, connectionResult] = await Promise.all([
    admin.from("video_jobs").select("id,user_id,title,status,output_asset_path").eq("id", parsed.data.jobId).maybeSingle(),
    admin.from("youtube_connections").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  const job = jobResult.data as { id: string; user_id: string; title: string | null; status: string; output_asset_path: string | null } | null;
  const connection = connectionResult.data as YouTubeConnectionRecord | null;

  if (!job || job.user_id !== user.id || job.status !== "completed" || !job.output_asset_path) {
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "publish_missing_output"), { status: 303 });
  }

  if (!connection) {
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "youtube_not_connected"), { status: 303 });
  }

  try {
    const accessToken = await getFreshYouTubeAccessToken(connection);
    const outputUrl = /^https?:\/\//i.test(job.output_asset_path) ? job.output_asset_path : await createSignedOutputVideoUrl(job.output_asset_path);
    const videoResponse = await fetch(outputUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000)
    });

    if (!videoResponse.ok) {
      throw new Error(`Output fetch failed (${videoResponse.status}).`);
    }

    const mimeType = videoResponse.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
    const videoBytes = new Uint8Array(await videoResponse.arrayBuffer());
    const upload = await uploadVideoToYouTube({
      accessToken,
      videoBytes,
      mimeType,
      metadata: {
        title: parsed.data.title,
        description: parsed.data.description,
        tags: parsed.data.tags,
        privacyStatus: parsed.data.privacyStatus,
        publishAt: scheduleDate ? scheduleDate.toISOString() : null
      }
    });

    await admin.from("youtube_publications").insert({
      user_id: user.id,
      job_id: job.id,
      youtube_video_id: upload.id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      tags: parsed.data.tags,
      privacy_status: scheduleDate ? "private" : parsed.data.privacyStatus,
      publish_at: scheduleDate ? scheduleDate.toISOString() : null,
      status: scheduleDate ? "scheduled" : "uploaded",
      metadata: {
        channel_id: connection.channel_id,
        channel_title: connection.channel_title
      }
    });

    await logAuditEvent({
      actorUserId: user.id,
      targetType: "youtube_publication",
      targetId: upload.id ?? job.id,
      action: scheduleDate ? "youtube.schedule" : "youtube.publish",
      metadata: buildRequestAuditMetadata(request, {
        job_id: job.id,
        channel_id: connection.channel_id,
        youtube_video_id: upload.id ?? null
      })
    });

    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, scheduleDate ? "publish_scheduled" : "publish_success"), { status: 303 });
  } catch (error) {
    logServerError("YouTube publish failed", { error, userId: user.id, jobId: parsed.data.jobId });
    await admin.from("youtube_publications").insert({
      user_id: user.id,
      job_id: parsed.data.jobId,
      youtube_video_id: null,
      title: parsed.data.title,
      description: parsed.data.description,
      tags: parsed.data.tags,
      privacy_status: scheduleDate ? "private" : parsed.data.privacyStatus,
      publish_at: scheduleDate ? scheduleDate.toISOString() : null,
      status: "failed",
      error_message: error instanceof Error ? error.message.slice(0, 1000) : "Upload failed"
    });
    return NextResponse.redirect(buildReturnUrl(request, parsed.data.jobId, "publish_failed"), { status: 303 });
  }
}
