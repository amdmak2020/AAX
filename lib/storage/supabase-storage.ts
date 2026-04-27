import { buildRandomStorageName, detectVideoFileType } from "@/lib/file-security";
import { sanitizeSingleLineText } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SOURCE_VIDEOS_BUCKET = "source-videos";
const sourceVideoUrlTtlSeconds = 7 * 24 * 60 * 60;

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
