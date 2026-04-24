import type { BoostPresetKey, TargetPlatformKey } from "@/lib/app-config";
import type { BoostJobStatus } from "@/lib/boost-jobs";

export type ProcessorSubmitInput = {
  jobId: string;
  userId: string;
  projectName: string;
  preset: BoostPresetKey;
  targetPlatform: TargetPlatformKey;
  description?: string | null;
  sourceType: "upload" | "external-url";
  sourceVideoUrl: string;
  sourceFileName?: string | null;
  callbackUrl?: string | null;
  advanced?: {
    subtitleStyle?: string | null;
    addOpeningText?: boolean;
    cropMode?: string | null;
    extraNotes?: string | null;
  };
};

export type ProcessorSubmitResult = {
  accepted: boolean;
  externalJobId?: string | null;
  status: BoostJobStatus;
  message?: string | null;
};

export type ProcessorStatusResult = {
  externalJobId: string;
  status: BoostJobStatus;
  progress?: number | null;
  outputVideoUrl?: string | null;
  errorMessage?: string | null;
};

export type ProcessorWebhookResult = {
  externalJobId?: string | null;
  jobId?: string | null;
  status: BoostJobStatus;
  progress?: number | null;
  outputVideoUrl?: string | null;
  errorMessage?: string | null;
};

export interface ProcessorProvider {
  key: string;
  submitJob(input: ProcessorSubmitInput): Promise<ProcessorSubmitResult>;
  getJobStatus(externalJobId: string): Promise<ProcessorStatusResult | null>;
  cancelJob?(externalJobId: string): Promise<void>;
  parseWebhook?(payload: unknown): Promise<ProcessorWebhookResult | null>;
}
