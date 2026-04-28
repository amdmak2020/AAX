"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function getGoogleDriveId(url: string) {
  return url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/\/file\/d\/([^/]+)/)?.[1] ?? null;
}

function getGoogleDriveDirectDownloadUrl(url: string) {
  const id = getGoogleDriveId(url);
  if (!id) return null;
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
}

function getProxyUrl(url: string) {
  return `/api/video/proxy?url=${encodeURIComponent(url)}`;
}

function getJobPlaybackUrl(jobId: string) {
  return `/api/video/proxy?jobId=${encodeURIComponent(jobId)}`;
}

export function VideoPreview({ outputUrl, jobId }: { outputUrl?: string; jobId?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const candidateSources = useMemo(() => {
    if (!outputUrl && !jobId) return [];

    const candidates: string[] = [];

    if (jobId) {
      candidates.push(getJobPlaybackUrl(jobId));
    }

    if (outputUrl) {
      if (!candidates.includes(outputUrl)) {
        candidates.push(outputUrl);
      }

      const driveDirect = getGoogleDriveDirectDownloadUrl(outputUrl);
      if (driveDirect && !candidates.includes(driveDirect)) {
        candidates.push(driveDirect);
      }

      const proxyUrl = getProxyUrl(outputUrl);
      if (!candidates.includes(proxyUrl)) {
        candidates.push(proxyUrl);
      }
    }

    return candidates;
  }, [jobId, outputUrl]);
  const activeSource = candidateSources[sourceIndex] ?? null;

  useEffect(() => {
    setSourceIndex(0);
    setIsLoading(true);
    setPreviewFailed(false);
  }, [jobId, outputUrl]);

  if (!outputUrl && !jobId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <p className="text-2xl font-black">Render preview</p>
        <p className="mt-3 text-sm leading-6 text-pearl/58">
          Finished half-screen shorts appear here with playback, download, and export metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 bg-black">
        {activeSource && !previewFailed ? (
          <div className="relative h-full">
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex h-full flex-col items-center justify-center bg-black/90 p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-mint" />
                <p className="mt-4 text-xl font-black">Loading your boosted clip</p>
                <p className="mt-2 text-sm leading-6 text-pearl/62">This should open right here as soon as the stream responds.</p>
              </div>
            ) : null}
            <video
              autoPlay
              key={activeSource}
              className="h-full w-full object-contain"
              controls
              playsInline
              src={activeSource}
              onCanPlay={() => setIsLoading(false)}
              onLoadedData={() => setIsLoading(false)}
              onError={() => {
                if (sourceIndex < candidateSources.length - 1) {
                  setSourceIndex((current) => current + 1);
                  setIsLoading(true);
                  return;
                }

                setIsLoading(false);
                setPreviewFailed(true);
              }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-2xl font-black">Preview unavailable</p>
            <p className="mt-3 text-sm leading-6 text-pearl/58">
              The video finished, but the in-app player could not open it here. You can still download the file below.
            </p>
          </div>
        )}
      </div>
      <div className="grid gap-2 border-t border-pearl/10 bg-ink p-3">
        <Button className="w-full" href={outputUrl}>
          <Download className="mr-2 h-4 w-4" />
          Download video
        </Button>
      </div>
    </div>
  );
}
