"use client";

import { VideoPreview } from "@/components/app/video-preview";

export function VideoPreviewCard({
  videoUrl
}: {
  title?: string;
  videoUrl?: string | null;
  posterUrl?: string | null;
}) {
  return (
    <div className="phone-frame mx-auto max-w-[320px] overflow-hidden bg-black">
      <VideoPreview outputUrl={videoUrl ?? undefined} />
    </div>
  );
}
