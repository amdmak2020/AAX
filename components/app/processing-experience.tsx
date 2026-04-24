"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Sparkles, Zap } from "lucide-react";
import { ScrambledText } from "@/components/effects/scrambled-text";
import { ShapeBlur } from "@/components/effects/shape-blur";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/jobs";

const beats = [
  "Pulling the source clip",
  "Checking the best split layout",
  "Finding caption timing",
  "Packing the retention layer",
  "Rendering the short",
  "Preparing the export"
];

export function ProcessingExperience({
  status,
  progress,
  createdAt
}: {
  status: JobStatus;
  progress: number;
  createdAt: string;
}) {
  const [seconds, setSeconds] = useState(0);
  const [visualProgress, setVisualProgress] = useState(() => Math.max(progress, 12));

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    setSeconds(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)));
    const interval = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [createdAt, status]);

  useEffect(() => {
    if (status === "completed" || status === "failed") {
      setVisualProgress(100);
      return;
    }

    setVisualProgress((current) => Math.max(current, progress, 12));
    const interval = window.setInterval(() => {
      setVisualProgress((current) => {
        const ceiling = status === "rendering" ? 96 : 88;
        if (current >= ceiling) return current;
        const next = current + (status === "rendering" ? 1.2 : 0.7);
        return Math.min(ceiling, next);
      });
    }, 1400);

    return () => window.clearInterval(interval);
  }, [progress, status]);

  const activeBeat = useMemo(() => beats[Math.floor(seconds / 7) % beats.length], [seconds]);
  const overTime = seconds >= 240 && status !== "completed" && status !== "failed";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (status === "completed" || status === "failed") {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-mint/20 bg-pearl/[0.055] p-5">
      <div className="absolute inset-0 opacity-80">
        <ShapeBlur variation={1} shapeSize={1} roundness={0.5} borderSize={0.05} circleSize={0.25} circleEdge={1} />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <p className="inline-flex items-center gap-2 rounded bg-mint px-2 py-1 text-xs font-black uppercase text-ink">
            <Zap className="h-3.5 w-3.5" />
            Render room
          </p>
          <p className="text-sm font-bold text-pearl/62">
            {minutes}:{remainingSeconds.toString().padStart(2, "0")}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <h2 className="text-3xl font-black leading-tight">
            <ScrambledText radius={100} duration={1.2} speed={0.5} scrambleChars=".:">
              {activeBeat}
            </ScrambledText>
          </h2>
          <p className="text-sm leading-6 text-pearl/66">
            Keep this tab open. The page checks for updates automatically while n8n finishes the short.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {beats.slice(0, 3).map((beat, index) => (
            <div className="rounded-lg bg-ink/62 p-3" key={beat}>
              <Sparkles className="h-4 w-4 text-lemon" />
              <p className="mt-2 text-xs font-bold leading-5 text-pearl/64">{beats[(index + Math.floor(seconds / 9)) % beats.length]}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded bg-pearl/10">
          <div
            className="render-pulse-bar h-full rounded bg-mint transition-all duration-700"
            style={{ width: `${visualProgress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-pearl/48">
          <span>Live render pulse</span>
          <span>{Math.round(visualProgress)}%</span>
        </div>

        {overTime ? (
          <div className="mt-5 rounded-lg border border-coral/35 bg-coral/10 p-4">
            <p className="font-black text-coral">This one is taking too long.</p>
            <p className="mt-2 text-sm leading-6 text-pearl/70">
              If it has been more than 4 minutes, the source may be blocked or the render got stuck. Try recreating it with the same link.
            </p>
            <Button className="mt-4" href="/create" variant="danger">
              <RotateCcw className="mr-2 h-4 w-4" />
              Redo this video
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
