import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSafeRemoteUrl } from "@/lib/network-security";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeHttpUrl } from "@/lib/validation";

const allowedHosts = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com",
  "storage.googleapis.com",
  "ptlpjrkyuztofbsfefzk.supabase.co"
]);
const maxPreviewVideoBytes = 250 * 1024 * 1024;
const maxRedirectHops = 3;
const previewFetchTimeoutMs = 15_000;
const proxyQuerySchema = z
  .object({
    url: z.string().trim().min(1).max(2048).transform((value, ctx) => {
      try {
        return normalizeHttpUrl(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid video URL." });
        return z.NEVER;
      }
    })
  })
  .strict();

function isAllowedUrl(url: URL) {
  try {
    return parseSafeRemoteUrl(url.toString(), { allowHosts: allowedHosts }).protocol === "https:";
  } catch {
    return false;
  }
}

function getGoogleDriveFileId(url: URL) {
  const queryId = url.searchParams.get("id");
  if (queryId) return queryId;

  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const ucMatch = url.pathname.match(/\/uc$/);
  if (ucMatch) {
    return url.searchParams.get("id");
  }

  return null;
}

function toStreamableVideoUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "drive.google.com" || host === "docs.google.com") {
    const fileId = getGoogleDriveFileId(url);
    if (fileId) {
      return new URL(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`);
    }
  }

  return new URL(url.toString());
}

async function userOwnsVideoUrl(userId: string, normalizedUrl: string) {
  const supabase = await createSupabaseServerClient();

  const [legacy, modern] = await Promise.all([
    supabase.from("video_jobs").select("id").eq("user_id", userId).eq("output_asset_path", normalizedUrl).limit(1).maybeSingle(),
    supabase.from("boost_jobs").select("id").eq("user_id", userId).eq("output_video_url", normalizedUrl).limit(1).maybeSingle()
  ]);

  const legacyMissing = legacy.error?.code === "42P01";
  const modernMissing = modern.error?.code === "42P01";

  if (legacy.error && !legacyMissing) {
    throw new Error(legacy.error.message);
  }

  if (modern.error && !modernMissing) {
    throw new Error(modern.error.message);
  }

  return Boolean(legacy.data?.id || modern.data?.id);
}

async function fetchWithAllowedRedirects(initialUrl: URL, range: string | null) {
  let currentUrl = toStreamableVideoUrl(initialUrl);

  for (let hop = 0; hop <= maxRedirectHops; hop += 1) {
    const upstream = await fetch(currentUrl, {
      headers: {
        ...(range ? { range } : {}),
        "user-agent": "AutoAgentXVideoProxy/1.0"
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(previewFetchTimeoutMs)
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) {
        return upstream;
      }

      const redirectedUrl = parseSafeRemoteUrl(new URL(location, currentUrl).toString(), { allowHosts: allowedHosts });
      if (redirectedUrl.protocol !== "https:") {
        throw new Error("Redirected video host is not allowed.");
      }

      currentUrl = redirectedUrl;
      continue;
    }

    return upstream;
  }

  throw new Error("Too many redirects while loading the video preview.");
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "video:proxy",
    key: user.id,
    limit: 120,
    windowMs: 10 * 60 * 1000
  });

  if (!limiter.allowed) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Too many video preview requests. Try again shortly." }, { status: 429 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      retryAfterSeconds: limiter.retryAfterSeconds,
      store: limiter.store
    });
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = proxyQuerySchema.safeParse({
    url: requestUrl.searchParams.get("url")
  });

  if (!parsedQuery.success) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Missing video URL." }, { status: 400 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  let targetUrl: URL;
  try {
    targetUrl = parseSafeRemoteUrl(parsedQuery.data.url, { allowHosts: allowedHosts });
  } catch {
    return applyRateLimitHeaders(NextResponse.json({ error: "Invalid video URL." }, { status: 400 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  if (!isAllowedUrl(targetUrl)) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Video host is not allowed." }, { status: 400 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const ownsUrl = await userOwnsVideoUrl(user.id, targetUrl.toString());
  if (!ownsUrl) {
    return applyRateLimitHeaders(NextResponse.json({ error: "You can only preview videos that belong to your account." }, { status: 403 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetchWithAllowedRedirects(targetUrl, range);
  } catch (error) {
    return applyRateLimitHeaders(
      NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the video preview." }, { status: 400 }),
      { limit: 120, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return applyRateLimitHeaders(
      NextResponse.json({ error: `Could not load video. Upstream responded with ${upstream.status}.` }, { status: upstream.status }),
      { limit: 120, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  const acceptRanges = upstream.headers.get("accept-ranges") ?? "bytes";
  const upstreamBytes = contentLength ? Number(contentLength) : null;

  if (upstreamBytes && Number.isFinite(upstreamBytes) && upstreamBytes > maxPreviewVideoBytes) {
    return applyRateLimitHeaders(NextResponse.json({ error: "The preview video is too large to stream safely." }, { status: 413 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  if (contentType.includes("text/html") || (!contentType.startsWith("video/") && contentType !== "application/octet-stream")) {
    return applyRateLimitHeaders(NextResponse.json({ error: "The upstream preview did not return a video stream." }, { status: 415 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  headers.set("content-type", contentType);
  headers.set("accept-ranges", acceptRanges);
  headers.set("cache-control", "private, max-age=300");

  if (contentLength) headers.set("content-length", contentLength);
  if (contentRange) headers.set("content-range", contentRange);

  return applyRateLimitHeaders(new Response(upstream.body, {
    status: upstream.status,
    headers
  }) as NextResponse, {
    limit: 120,
    remaining: limiter.remaining,
    resetAt: limiter.resetAt,
    store: limiter.store
  });
}
