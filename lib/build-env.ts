const sharedRequiredEnv = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PROCESSOR_PROVIDER"
] as const;

export function validateProductionBuildEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!(process.env.VERCEL === "1" || process.env.CI === "true" || process.env.ENFORCE_PRODUCTION_ENV === "true")) {
    return;
  }

  const required = new Set<string>([...sharedRequiredEnv]);
  const hasProcessorSecret = Boolean(process.env.N8N_PROCESSOR_SECRET?.trim() || process.env.N8N_WEBHOOK_SECRET?.trim());

  if ((process.env.PROCESSOR_PROVIDER ?? "mock") === "n8n") {
    required.add("N8N_PROCESSOR_ENDPOINT");
  }

  const missing = [...required].filter((name) => !process.env[name]?.trim());
  if ((process.env.PROCESSOR_PROVIDER ?? "mock") === "n8n" && !hasProcessorSecret) {
    missing.push("N8N_PROCESSOR_SECRET (or legacy N8N_WEBHOOK_SECRET)");
  }
  if (missing.length > 0) {
    throw new Error(`Production build is missing required environment variables: ${missing.join(", ")}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!appUrl.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use https:// in production.");
  }

  if (/localhost|127\.0\.0\.1/i.test(appUrl)) {
    throw new Error("NEXT_PUBLIC_APP_URL cannot point at localhost in production.");
  }
}
