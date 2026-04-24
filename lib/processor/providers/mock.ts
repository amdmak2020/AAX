import { randomUUID } from "crypto";
import type { ProcessorProvider, ProcessorStatusResult, ProcessorSubmitInput, ProcessorSubmitResult } from "@/lib/processor/types";

const mockOutputUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
const mockJobs = new Map<string, { createdAt: number; input: ProcessorSubmitInput }>();

export const mockProcessorProvider: ProcessorProvider = {
  key: "mock",
  async submitJob(input: ProcessorSubmitInput): Promise<ProcessorSubmitResult> {
    const externalJobId = `mock_${randomUUID()}`;
    mockJobs.set(externalJobId, { createdAt: Date.now(), input });
    return {
      accepted: true,
      externalJobId,
      status: "queued",
      message: "Mock processor accepted the clip."
    };
  },
  async getJobStatus(externalJobId: string): Promise<ProcessorStatusResult | null> {
    const record = mockJobs.get(externalJobId);
    if (!record) return null;

    const elapsed = Date.now() - record.createdAt;
    if (elapsed < 25_000) {
      return { externalJobId, status: "queued", progress: 8 };
    }

    if (elapsed < 80_000) {
      return { externalJobId, status: "processing", progress: 42 };
    }

    if (elapsed < 130_000) {
      return { externalJobId, status: "rendering", progress: 82 };
    }

    return {
      externalJobId,
      status: "completed",
      progress: 100,
      outputVideoUrl: mockOutputUrl
    };
  }
};
