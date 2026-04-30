"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Waves, Zap } from "lucide-react";
import { statusTimeline, type BoostJobStatus } from "@/lib/boost-jobs";

const order: BoostJobStatus[] = ["draft", "queued", "processing", "rendering", "completed", "failed"];
const liveBeats = [
  "Checking the source and wake-up path",
  "Reshaping pacing and subtitle rhythm",
  "Packing the render and export layer",
  "Waiting for the final file to land"
];

export function JobStatusTimeline({ status }: { status: BoostJobStatus }) {
  const statusIndex = order.indexOf(status);
  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const interval = window.setInterval(() => {
      setBeatIndex((current) => (current + 1) % liveBeats.length);
    }, 1700);

    return () => window.clearInterval(interval);
  }, [status]);

  const currentStep = useMemo(() => {
    if (status === "failed") return "render stalled";
    if (status === "completed") return "final file landed";
    return liveBeats[beatIndex];
  }, [beatIndex, status]);

  return (
    <div className="grid gap-4">
      <div className="job-status-live-shell">
        <div className="job-status-live-header">
          <div className="job-status-live-chip">
            <span className="job-status-live-dot" />
            {status === "completed" ? "ready" : status === "failed" ? "needs attention" : "live"}
          </div>
          <div className="job-status-live-icon">
            {status === "queued" ? <Waves className="h-4 w-4" /> : status === "rendering" ? <Sparkles className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          </div>
        </div>
        <p className="mt-4 text-base font-black text-pearl">{currentStep}</p>
        <div className="job-status-live-track mt-4">
          <span />
        </div>
      </div>

      {statusTimeline.map((step, index) => {
        const active = index <= Math.max(0, statusIndex - 1) || step.key === status;
        const current = step.key === status;
        return (
          <div className={`job-status-step ${active ? "job-status-step-active" : ""} ${current ? "job-status-step-current" : ""}`} key={step.key}>
            <div className={`job-status-step-dot ${active ? "job-status-step-dot-active" : ""} ${current ? "job-status-step-dot-current" : ""}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className={`font-black ${active ? "text-pearl" : "text-pearl/44"}`}>{step.label}</p>
                {current ? <span className="job-status-inline-chip">happening now</span> : null}
              </div>
              <p className="mt-1 text-sm leading-6 text-pearl/62">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
