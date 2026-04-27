type Jsonish = string | number | boolean | null | Jsonish[] | { [key: string]: Jsonish };

const sensitiveKeyPattern = /(secret|token|cookie|authorization|password|signature|webhook|apikey|api_key|service_role|bearer)/i;
const sensitiveValuePattern = /(sb_(publishable|secret)_[a-z0-9_]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+|Bearer\s+[A-Za-z0-9._-]+)/i;

function redactString(value: string) {
  return sensitiveValuePattern.test(value) ? "[REDACTED]" : value.slice(0, 1000);
}

function sanitizeValue(value: unknown): Jsonish {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message)
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeValue(entryValue)])
    );
  }

  return String(value);
}

export function logServerError(message: string, details?: Record<string, unknown>) {
  console.error(message, details ? sanitizeValue(details) : undefined);
}
