"use client";

import { VideoPreview } from "@/components/app/video-preview";
import type { BoostJobStatus } from "@/lib/boost-jobs";

export function VideoPreviewCard({
  jobId,
  videoUrl,
  status
}: {
  jobId?: string;
  title?: string;
  videoUrl?: string | null;
  posterUrl?: string | null;
  status?: BoostJobStatus;
}) {
  return (
    <div className="phone-frame mx-auto max-w-[320px] overflow-hidden bg-black">
      <VideoPreview jobId={jobId} outputUrl={videoUrl ?? undefined} status={status} />
    </div>
  );
}
