import { sanitizeFileName } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SOURCE_VIDEOS_BUCKET = "source-videos";

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
    public: true,
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
  const filePath = `${params.userId}/${params.jobId}/${sanitizeFileName(params.file.name)}`;
  const arrayBuffer = await params.file.arrayBuffer();

  let { error } = await supabase.storage.from(SOURCE_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
    contentType: params.file.type,
    upsert: false
  });

  if (error?.message === "Bucket not found") {
    await ensureSourceVideosBucket();
    ({ error } = await supabase.storage.from(SOURCE_VIDEOS_BUCKET).upload(filePath, arrayBuffer, {
      contentType: params.file.type,
      upsert: false
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(SOURCE_VIDEOS_BUCKET).getPublicUrl(filePath);
  return {
    path: filePath,
    publicUrl: data.publicUrl,
    fileName: params.file.name
  };
}
