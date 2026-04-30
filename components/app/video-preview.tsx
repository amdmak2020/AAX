"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Sparkles, Waves, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoostJobStatus } from "@/lib/boost-jobs";

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

const processingBeats = [
  "Pulling frames into place",
  "Cleaning the hook timing",
  "Locking subtitle rhythm",
  "Packing the final export"
];

function ProcessingPlaceholder({ status }: { status: BoostJobStatus }) {
  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBeatIndex((current) => (current + 1) % processingBeats.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  const label =
    status === "queued"
      ? "Queued and warming up"
      : status === "rendering"
        ? "Rendering the final cut"
        : "Processing your boosted clip";

  return (
    <div className="preview-processing-shell flex h-full flex-col justify-between px-5 py-6 text-left">
      <div className="preview-processing-grid" />
      <div className="preview-processing-orb preview-processing-orb-one" />
      <div className="preview-processing-orb preview-processing-orb-two" />

      <div className="relative z-10 flex items-center justify-between">
        <div className="preview-processing-chip">
          <span className="preview-processing-chip-dot" />
          live render
        </div>
        <div className="preview-processing-chip">{status}</div>
      </div>

      <div className="relative z-10 mt-8 space-y-4">
        <div className="flex items-center gap-3 text-mint">
          <div className="preview-processing-icon">
            {status === "queued" ? <Waves className="h-5 w-5" /> : status === "rendering" ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </div>
          <span className="text-xs font-black uppercase tracking-[0.35em] text-mint/82">Boost room</span>
        </div>

        <div>
          <p className="text-3xl font-black leading-[1.02] text-pearl">{label}</p>
          <p className="mt-3 text-sm leading-6 text-pearl/70">{processingBeats[beatIndex]}</p>
        </div>

        <div className="preview-processing-bars">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="relative z-10 mt-6 space-y-3">
        <div className="preview-processing-subtitle">
          <span className="preview-processing-pulse" />
          smarter cuts, cleaner captions, stronger pacing
        </div>
        <div className="preview-processing-subtitle preview-processing-subtitle-alt">
          <span className="preview-processing-pulse" />
          this panel will swap into playback the moment the file lands
        </div>
      </div>
    </div>
  );
}

export function VideoPreview({ outputUrl, jobId, status = "completed" }: { outputUrl?: string; jobId?: string; status?: BoostJobStatus }) {
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

  if ((status === "queued" || status === "processing" || status === "rendering" || status === "draft") && !outputUrl) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 bg-black">
          <ProcessingPlaceholder status={status} />
        </div>
      </div>
    );
  }

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
              <div className="absolute inset-0 z-10 flex h-full flex-col items-center justify-center bg-black/72 p-6 text-center backdrop-blur-sm">
                <div className="preview-loading-shell">
                  <div className="preview-loading-spinner">
                    <Loader2 className="h-8 w-8 animate-spin text-mint" />
                  </div>
                  <p className="mt-5 text-xl font-black">Loading your boosted clip</p>
                  <p className="mt-2 text-sm leading-6 text-pearl/62">The player is waking up and grabbing the stream.</p>
                  <div className="preview-loading-bars mt-5">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
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
          <div className="preview-processing-shell flex h-full flex-col justify-between px-5 py-6 text-left">
            <div className="preview-processing-grid" />
            <div className="preview-processing-orb preview-processing-orb-one" />
            <div className="preview-processing-orb preview-processing-orb-two" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="preview-processing-chip">
                <span className="preview-processing-chip-dot" />
                preview miss
              </div>
              <div className="preview-processing-chip">fallback</div>
            </div>
            <div className="relative z-10 mt-8">
              <p className="text-3xl font-black leading-[1.02] text-pearl">Preview unavailable</p>
              <p className="mt-3 text-sm leading-6 text-pearl/70">
                The clip finished, but the in-app player could not open it here. Download still works below.
              </p>
            </div>
            <div className="relative z-10 mt-6 preview-processing-subtitle">
              <span className="preview-processing-pulse" />
              playback missed, file still intact
            </div>
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
