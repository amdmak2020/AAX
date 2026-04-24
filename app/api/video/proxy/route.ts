import { NextResponse } from "next/server";

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
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing video URL." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid video URL." }, { status: 400 });
  }

  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json({ error: "Video host is not allowed." }, { status: 400 });
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
    return NextResponse.json(
      { error: `Could not load video. Upstream responded with ${upstream.status}.` },
      { status: upstream.status }
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

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}
