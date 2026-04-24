"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function getGoogleDriveId(url: string) {
  return url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/\/file\/d\/([^/]+)/)?.[1] ?? null;
}

function getGoogleDrivePreviewUrl(url: string) {
  const id = getGoogleDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function getProxyUrl(url: string) {
  return `/api/video/proxy?url=${encodeURIComponent(url)}`;
}

export function VideoPreview({ outputUrl }: { outputUrl?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);
  const drivePreviewUrl = useMemo(() => (outputUrl ? getGoogleDrivePreviewUrl(outputUrl) : null), [outputUrl]);
  const proxyUrl = useMemo(() => (outputUrl ? getProxyUrl(outputUrl) : null), [outputUrl]);

  useEffect(() => {
    if (!proxyUrl) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    async function loadVideo() {
      setPreviewFailed(false);
      setBlobUrl(null);
      setLoadingPercent(1);

      try {
        const response = await fetch(proxyUrl!, { cache: "no-store" });
        if (!response.ok || !response.body) {
          throw new Error("Preview fetch failed.");
        }

        const total = Number(response.headers.get("content-length") ?? 0);
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            setLoadingPercent(Math.max(1, Math.min(99, Math.round((received / total) * 100))));
          } else {
            setLoadingPercent((current) => Math.min(95, current + 4));
          }
        }

        const blobParts = chunks.map((chunk) => {
          const copy = new Uint8Array(chunk.byteLength);
          copy.set(chunk);
          return copy.buffer;
        });
        const blob = new Blob(blobParts, { type: response.headers.get("content-type") ?? "video/mp4" });
        createdUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setBlobUrl(createdUrl);
          setLoadingPercent(100);
        } else {
          URL.revokeObjectURL(createdUrl);
        }
      } catch {
        if (!cancelled) {
          setPreviewFailed(true);
        }
      }
    }

    loadVideo();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [proxyUrl]);

  if (!outputUrl) {
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
        {blobUrl ? (
          <video autoPlay className="h-full w-full object-contain" controls playsInline src={blobUrl} />
        ) : previewFailed && drivePreviewUrl ? (
          <iframe allow="autoplay; fullscreen" className="h-full w-full" src={drivePreviewUrl} title="Generated video preview" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-mint" />
            <p className="mt-4 text-xl font-black">Loading video into your browser</p>
            <p className="mt-2 text-sm leading-6 text-pearl/62">
              This avoids the slow Google Drive preview player.
            </p>
            <div className="mt-5 h-3 w-full max-w-[220px] overflow-hidden rounded bg-pearl/10">
              <div className="render-pulse-bar h-full rounded bg-mint" style={{ width: `${Math.max(loadingPercent, 8)}%` }} />
            </div>
            <p className="mt-2 text-xs font-bold text-pearl/48">{loadingPercent}%</p>
          </div>
        )}
      </div>
      <div className="grid gap-2 border-t border-pearl/10 bg-ink p-3">
        {drivePreviewUrl ? (
          <Button className="w-full" href={drivePreviewUrl} variant="secondary">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Drive preview
          </Button>
        ) : null}
        <Button className="w-full" href={outputUrl}>
          <Download className="mr-2 h-4 w-4" />
          Download video
        </Button>
      </div>
    </div>
  );
}
