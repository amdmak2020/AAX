import { sanitizeMultilineText } from "@/lib/validation";

function parsePossibleJsonError(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function toUserFacingJobErrorMessage(rawError: string | null | undefined) {
  if (!rawError) {
    return null;
  }

  const normalized = sanitizeMultilineText(rawError).trim().slice(0, 600);
  if (!normalized) {
    return null;
  }

  const parsed = parsePossibleJsonError(normalized);
  const parsedMessage = typeof parsed?.message === "string" ? parsed.message : null;
  const parsedHint = typeof parsed?.hint === "string" ? parsed.hint : null;
  const combined = `${normalized}\n${parsedMessage ?? ""}\n${parsedHint ?? ""}`.toLowerCase();

  if (
    combined.includes("webhook") &&
    (combined.includes("not registered") || combined.includes("test workflow") || combined.includes("click the 'test workflow' button"))
  ) {
    return "The editing pipeline was not ready to accept this clip yet. Nothing was lost. Give it another try in a moment.";
  }

  if (combined.includes("timed out") || combined.includes("timeout")) {
    return "The editor took too long to respond. Your clip did not go through, so you can safely try again.";
  }

  if (combined.includes("unavailable") || combined.includes("not available")) {
    return "The editor was temporarily unavailable. Your clip did not go through. Please try again shortly.";
  }

  if (combined.includes("signature") || combined.includes("unauthorized") || combined.includes("forbidden")) {
    return "The processing service rejected this request. Your clip did not go through. Please try again in a moment.";
  }

  if (combined.includes("too large") || combined.includes("file too large")) {
    return "That clip was too large for the current processing limits. Try a smaller export and send it again.";
  }

  if (combined.includes("unsupported") || combined.includes("invalid video")) {
    return "That clip format could not be processed. Try exporting it as a standard MP4 and send it again.";
  }

  return "This clip could not be processed. Nothing was lost, and you can safely try again.";
}
