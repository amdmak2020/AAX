import { NextResponse } from "next/server";
import { applyRateLimitHeaders, enforceRateLimit } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedHosts = new Set([
  "drive.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com",
  "storage.googleapis.com",
  "ptlpjrkyuztofbsfefzk.supabase.co"
]);

function isAllowedUrl(url: URL) {
  return url.protocol === "https:" && allowedHosts.has(url.hostname);
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
  const rawUrl = requestUrl.searchParams.get("url");

  if (!rawUrl) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Missing video URL." }, { status: 400 }), {
      limit: 120,
      remaining: limiter.remaining,
      resetAt: limiter.resetAt,
      store: limiter.store
    });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
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

  const range = request.headers.get("range");
  const upstream = await fetch(targetUrl, {
    headers: {
      ...(range ? { range } : {}),
      "user-agent": "ShortsMachineVideoProxy/1.0"
    },
    redirect: "follow",
    cache: "no-store"
  });

  if (!upstream.ok && upstream.status !== 206) {
    return applyRateLimitHeaders(
      NextResponse.json({ error: `Could not load video. Upstream responded with ${upstream.status}.` }, { status: upstream.status }),
      { limit: 120, remaining: limiter.remaining, resetAt: limiter.resetAt, store: limiter.store }
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") ?? "video/mp4";
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  const acceptRanges = upstream.headers.get("accept-ranges") ?? "bytes";

  headers.set("content-type", contentType.includes("text/html") ? "video/mp4" : contentType);
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
