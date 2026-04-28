import { buildRandomStorageName, detectVideoFileType } from "@/lib/file-security";
import { parseSafeRemoteUrl } from "@/lib/network-security";
import { sanitizeSingleLineText } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SOURCE_VIDEOS_BUCKET = "source-videos";
const OUTPUT_VIDEOS_BUCKET = "output-videos";
const sourceVideoUrlTtlSeconds = 7 * 24 * 60 * 60;
const outputVideoUrlTtlSeconds = 7 * 24 * 60 * 60;
const maxOutputVideoBytes = 250 * 1024 * 1024;
const allowedRemoteOutputHosts = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com",
  "storage.googleapis.com",
  "ptlpjrkyuztofbsfefzk.supabase.co"
]);

async function ensureSourceVideosBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Could not inspect storage buckets: ${listError.message}`);
  }

  const exists = buckets?.some((bucket) => bucket.name === SOURCE_VIDEOS_BUCKET || bucket.id === SOURCE_VIDEOS_BUCKET);
  if (exists) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(SOURCE_VIDEOS_BUCKET, {
    public: false,
    fileSizeLimit: "20MB"
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Could not create the source video bucket: ${createError.message}`);
  }
}

async function ensureOutputVideosBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Could not inspect storage buckets: ${listError.message}`);
  }

  const exists = buckets?.some((bucket) => bucket.name === OUTPUT_VIDEOS_BUCKET || bucket.id === OUTPUT_VIDEOS_BUCKET);
  if (exists) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(OUTPUT_VIDEOS_BUCKET, {
    public: false,
    fileSizeLimit: "250MB"
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Could not create the output video bucket: ${createError.message}`);
  }
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function getGoogleDriveFileId(url: URL) {
  return url.searchParams.get("id") ?? url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? null;
}

function toFetchableRemoteVideoUrl(input: string) {
  const parsed = parseSafeRemoteUrl(input, { allowHosts: allowedRemoteOutputHosts });
  const host = parsed.hostname.toLowerCase();
  if (host === "drive.google.com" || host === "docs.google.com") {
    const fileId = getGoogleDriveFileId(parsed);
    if (fileId) {
      return new URL(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`);
    }
  }

  return parsed;
}

function inferVideoMimeFromHeader(contentType: string | null) {
  const normalized = (contentType ?? "").toLowerCase();
  if (normalized.includes("video/mp4")) return { mime: "video/mp4", extension: "mp4" };
  if (normalized.includes("video/webm")) return { mime: "video/webm", extension: "webm" };
  if (normalized.includes("video/quicktime")) return { mime: "video/quicktime", extension: "mov" };
  if (normalized.includes("video/x-m4v")) return { mime: "video/x-m4v", extension: "m4v" };
  return null;
}

export async function createSignedOutputVideoUrl(path: string) {
  const supabase = createSupabaseAdminClient();
  const signedUrlResult = await supabase.storage.from(OUTPUT_VIDEOS_BUCKET).createSignedUrl(path, outputVideoUrlTtlSeconds);
  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    throw new Error(signedUrlResult.error?.message ?? "Could not generate a temporary output video URL.");
  }

  return signedUrlResult.data.signedUrl;
}

export async function materializeRemoteOutputVideo(params: {
  userId: string;
  jobId: string;
  remoteUrl: string;
}) {
  const supabase = createSupabaseAdminClient();
  const fetchableUrl = toFetchableRemoteVideoUrl(params.remoteUrl);
  const response = await fetch(fetchableUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "user-agent": "AutoAgentXOutputImporter/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch rendered video (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxOutputVideoBytes) {
    throw new Error("Rendered video is too large to ingest.");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxOutputVideoBytes) {
    throw new Error("Rendered video is too large to ingest.");
  }

  const bytes = new Uint8Array(arrayBuffer);
  const detectedType = detectVideoFileType(bytes) ?? inferVideoMimeFromHeader(response.headers.get("content-type"));
  if (!detectedType) {
    throw new Error("Rendered output is not a supported video file.");
  }

  const filePath = `${params.userId}/${params.jobId}/${buildRandomStorageName(detectedType.extension)}`;

  let { error } = await supabase.storage.from(OUTPUT_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
    contentType: detectedType.mime,
    upsert: false
  });

  if (error?.message === "Bucket not found") {
    await ensureOutputVideosBucket();
    ({ error } = await supabase.storage.from(OUTPUT_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
      contentType: detectedType.mime,
      upsert: false
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: filePath,
    signedUrl: await createSignedOutputVideoUrl(filePath)
  };
}

export async function resolveStoredOutputVideoUrl(storedValue: string | null | undefined) {
  if (!storedValue) {
    return null;
  }

  if (isAbsoluteHttpUrl(storedValue)) {
    return storedValue;
  }

  return createSignedOutputVideoUrl(storedValue);
}

export async function uploadSourceVideo(params: {
  userId: string;
  jobId: string;
  file: File;
}) {
  const supabase = createSupabaseAdminClient();
  const arrayBuffer = await params.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detectedType = detectVideoFileType(bytes);

  if (!detectedType) {
    throw new Error("Unsupported or invalid video file.");
  }

  const filePath = `${params.userId}/${params.jobId}/${buildRandomStorageName(detectedType.extension)}`;

  let { error } = await supabase.storage.from(SOURCE_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
    contentType: detectedType.mime,
    upsert: false
  });

  if (error?.message === "Bucket not found") {
    await ensureSourceVideosBucket();
    ({ error } = await supabase.storage.from(SOURCE_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
      contentType: detectedType.mime,
      upsert: false
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  const signedUrlResult = await supabase.storage.from(SOURCE_VIDEOS_BUCKET).createSignedUrl(filePath, sourceVideoUrlTtlSeconds);
  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    throw new Error(signedUrlResult.error?.message ?? "Could not generate a temporary source video URL.");
  }

  return {
    path: filePath,
    publicUrl: signedUrlResult.data.signedUrl,
    fileName: sanitizeSingleLineText(params.file.name).slice(0, 255),
    detectedMime: detectedType.mime
  };
}
