import { getAppUrl, getEnv } from "@/lib/env";
import { takeRateLimitToken } from "@/lib/rate-limit";
import { logServerError } from "@/lib/secure-log";

export type AlertSeverity = "info" | "warning" | "critical";

function getAlertWebhookUrl() {
  return getEnv("ALERT_WEBHOOK_URL");
}

export async function sendOperationalAlert(input: {
  code: string;
  severity: AlertSeverity;
  summary: string;
  details?: Record<string, unknown>;
  dedupeKey?: string | null;
}) {
  const webhookUrl = getAlertWebhookUrl();
  if (!webhookUrl) {
    return false;
  }

  const limiter = await takeRateLimitToken({
    bucket: "ops-alert",
    key: `${input.code}:${input.dedupeKey ?? "global"}`,
    limit: 1,
    windowMs: input.severity === "critical" ? 5 * 60 * 1000 : 30 * 60 * 1000
  });

  if (!limiter.allowed) {
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app: "autoagentx",
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
        severity: input.severity,
        code: input.code,
        summary: input.summary,
        appUrl: getAppUrl(),
        occurredAt: new Date().toISOString(),
        details: input.details ?? {}
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      logServerError("Operational alert delivery failed", { code: input.code, status: response.status });
      return false;
    }

    return true;
  } catch (error) {
    logServerError("Operational alert delivery failed", { code: input.code, error });
    return false;
  }
}
