import { getEnv } from "@/lib/env";
import type { JobMode } from "@/lib/jobs";

export type ProcessingPayload = {
  jobId: string;
  userId: string;
  mode: JobMode;
  title: string;
  twitterUrl: string;
  url?: string;
  videoUrl?: string;
  callbackUrl?: string;
  style: string;
  voice: string;
};

export async function triggerVideoWorkflow(payload: ProcessingPayload) {
  const webhookUrl = getEnv("N8N_WEBHOOK_URL");
  const secret = getEnv("N8N_WEBHOOK_SECRET");

  if (!webhookUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "N8N_WEBHOOK_URL is not configured."
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-shorts-machine-secret": secret } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      skipped: false,
      status: response.status,
      reason: body || `n8n workflow trigger failed with ${response.status}`
    };
  }

  return { ok: true, skipped: false };
}
