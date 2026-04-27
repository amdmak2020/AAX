import { getEnv } from "@/lib/env";
import { parseSafeRemoteUrl } from "@/lib/network-security";
import type { ProcessorProvider, ProcessorWebhookResult, ProcessorSubmitInput, ProcessorSubmitResult } from "@/lib/processor/types";

const processorSubmitTimeoutMs = 15_000;
const maxProcessorErrorText = 500;

export const n8nProcessorProvider: ProcessorProvider = {
  key: "n8n",
  async submitJob(input: ProcessorSubmitInput): Promise<ProcessorSubmitResult> {
    const endpoint = getEnv("N8N_PROCESSOR_ENDPOINT") ?? getEnv("N8N_WEBHOOK_URL");
    const secret = getEnv("N8N_PROCESSOR_SECRET");

    if (!endpoint) {
      return {
        accepted: false,
        status: "failed",
        message: "N8N processor endpoint is not configured."
      };
    }

    let safeEndpoint: URL;
    try {
      safeEndpoint = parseSafeRemoteUrl(endpoint);
    } catch {
      return {
        accepted: false,
        status: "failed",
        message: "Processor endpoint configuration is invalid."
      };
    }

    let response: Response;
    try {
      response = await fetch(safeEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-processor-secret": secret } : {})
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(processorSubmitTimeoutMs)
      });
    } catch (error) {
      return {
        accepted: false,
        status: "failed",
        message: error instanceof Error && error.name === "TimeoutError" ? "Processor timed out before accepting the job." : "Processor was unavailable."
      };
    }

    if (!response.ok) {
      const message = await response
        .text()
        .then((text) => text.slice(0, maxProcessorErrorText))
        .catch(() => `Processor returned ${response.status}.`);
      return {
        accepted: false,
        status: "failed",
        message
      };
    }

    const json = (await response.json().catch(() => null)) as { externalJobId?: string; jobId?: string } | null;

    return {
      accepted: true,
      externalJobId: json?.externalJobId ?? json?.jobId ?? null,
      status: "queued",
      message: "External processor accepted the job."
    };
  },
  async getJobStatus() {
    return null;
  },
  async parseWebhook(payload: unknown): Promise<ProcessorWebhookResult | null> {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const status = body.status;
    if (typeof status !== "string") return null;

    return {
      jobId: typeof body.jobId === "string" ? body.jobId : null,
      externalJobId:
        typeof body.externalJobId === "string"
          ? body.externalJobId
          : typeof body.n8n_execution_id === "string"
            ? body.n8n_execution_id
            : typeof body.executionId === "string"
              ? body.executionId
              : null,
      status: status as ProcessorWebhookResult["status"],
      progress: typeof body.progress === "number" ? body.progress : null,
      outputVideoUrl:
        typeof body.outputVideoUrl === "string"
          ? body.outputVideoUrl
          : typeof body.output_url === "string"
            ? body.output_url
            : typeof body.output_asset_path === "string"
              ? body.output_asset_path
              : typeof body.outputUrl === "string"
                ? body.outputUrl
                : null,
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : typeof body.error === "string" ? body.error : null
    };
  }
};
