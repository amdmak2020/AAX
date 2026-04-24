export type JobMode = "twitter";
export type JobStatus = "queued" | "processing" | "rendering" | "completed" | "failed";

export type VideoJob = {
  id: string;
  title: string;
  mode: JobMode;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: number;
  style: string;
  voice: string;
  credits: number;
  outputUrl?: string;
  error?: string;
};

export const modeLabels: Record<JobMode, string> = {
  twitter: "Twitter/X to Half-Screen Short"
};

export const statusLabels: Record<JobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  rendering: "Rendering",
  completed: "Completed",
  failed: "Failed"
};

export const statusTone: Record<JobStatus, string> = {
  queued: "bg-lemon/15 text-lemon",
  processing: "bg-mint/15 text-mint",
  rendering: "bg-violet/18 text-violet",
  completed: "bg-mint text-ink",
  failed: "bg-coral text-ink"
};

export const creationModes = [
  {
    id: "twitter" as const,
    title: "Twitter/X URL to Half-Screen Short",
    description: "Paste a Twitter or X video URL and generate a vertical split-style short.",
    prompt: "Paste the Twitter/X video URL"
  }
];

export const stylePresets = ["Clean Split", "Gameplay Bottom", "Subway Surfers", "ASMR Background", "Minimal Captions"];
export const voicePresets = ["Original audio", "Caption only"];

export const mockJobs: VideoJob[] = [
  {
    id: "job_1024",
    title: "5 creator habits that compound",
    mode: "twitter",
    status: "completed",
    createdAt: "2026-04-19T12:20:00Z",
    updatedAt: "2026-04-19T12:29:00Z",
    progress: 100,
    style: "Clean Creator",
    voice: "Warm Narrator",
    credits: 3,
    outputUrl: "#"
  },
  {
    id: "job_1023",
    title: "My roommate hid my packages",
    mode: "twitter",
    status: "rendering",
    createdAt: "2026-04-20T08:10:00Z",
    updatedAt: "2026-04-20T08:14:00Z",
    progress: 72,
    style: "Gameplay Bottom",
    voice: "Calm Storyteller",
    credits: 4
  },
  {
    id: "job_1022",
    title: "Podcast clip about audience trust",
    mode: "twitter",
    status: "processing",
    createdAt: "2026-04-20T09:05:00Z",
    updatedAt: "2026-04-20T09:06:00Z",
    progress: 38,
    style: "Podcast Split",
    voice: "Original audio",
    credits: 5
  }
];

export function getJob(id: string) {
  const existingJob = mockJobs.find((job) => job.id === id);
  if (existingJob) {
    return existingJob;
  }

  if (id.startsWith("job_")) {
    return {
      id,
      title: "New video render",
      mode: "twitter",
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 8,
      style: "Clean Creator",
      voice: "Warm Narrator",
      credits: 3
    } satisfies VideoJob;
  }

  return undefined;
}
