import { z } from "zod";

const disallowedControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeSingleLineText(input: string) {
  return input.replace(disallowedControlChars, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeMultilineText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(disallowedControlChars, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeHttpUrl(input: string) {
  const url = new URL(input.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  url.username = "";
  url.password = "";
  url.hash = "";

  return url.toString();
}

export function getUnexpectedFormFields(formData: FormData, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys);
  const unexpected = new Set<string>();

  for (const key of formData.keys()) {
    if (!allowed.has(key)) {
      unexpected.add(key);
    }
  }

  return [...unexpected];
}

export function requestExceedsBytes(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) {
    return false;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return true;
  }

  return parsed > maxBytes;
}

export const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long.")
  .transform((value, ctx) => {
    if (!value) {
      return "";
    }

    try {
      return normalizeHttpUrl(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid HTTP or HTTPS URL." });
      return z.NEVER;
    }
  });

export const strictUuidSchema = z.string().uuid();

export function singleLineTextSchema(options: { min?: number; max: number; requiredMessage?: string; tooLongMessage?: string }) {
  return z.preprocess(
    (value) => (typeof value === "string" ? sanitizeSingleLineText(value) : value),
    z
      .string()
      .min(options.min ?? 0, options.requiredMessage ?? "Invalid text.")
      .max(options.max, options.tooLongMessage ?? `Keep this under ${options.max} characters.`)
  );
}

export function multilineTextSchema(options: { min?: number; max: number; requiredMessage?: string; tooLongMessage?: string }) {
  return z.preprocess(
    (value) => (typeof value === "string" ? sanitizeMultilineText(value) : value),
    z
      .string()
      .min(options.min ?? 0, options.requiredMessage ?? "Invalid text.")
      .max(options.max, options.tooLongMessage ?? `Keep this under ${options.max} characters.`)
  );
}
