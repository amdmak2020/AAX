import type { BoostPresetKey, TargetPlatformKey } from "@/lib/app-config";

export type BoostJobStatus = "draft" | "queued" | "processing" | "rendering" | "completed" | "failed";

export type BoostJob = {
  id: string;
  userId: string;
  projectName: string;
  status: BoostJobStatus;
  preset: BoostPresetKey;
  targetPlatform: TargetPlatformKey;
  description?: string | null;
  processorProvider: string;
  externalJobId?: string | null;
  sourceVideoUrl: string;
  sourceFileName?: string | null;
  outputVideoUrl?: string | null;
  outputPosterUrl?: string | null;
  errorMessage?: string | null;
  progress?: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export const boostStatusTone: Record<BoostJobStatus, string> = {
  draft: "bg-pearl/10 text-pearl",
  queued: "bg-lemon/15 text-lemon",
  processing: "bg-mint/15 text-mint",
  rendering: "bg-violet/20 text-violet",
  completed: "bg-mint text-ink",
  failed: "bg-coral text-ink"
};

export const boostStatusLabel: Record<BoostJobStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  processing: "Processing",
  rendering: "Rendering",
  completed: "Completed",
  failed: "Failed"
};

export const statusTimeline = [
  { key: "queued", label: "Queued", description: "The clip is waiting to be picked up." },
  { key: "processing", label: "Processing", description: "Hook, captions, and structure are being improved." },
  { key: "rendering", label: "Rendering", description: "The final boosted version is being exported." },
  { key: "completed", label: "Completed", description: "Your improved clip is ready to preview and download." }
] as const;
