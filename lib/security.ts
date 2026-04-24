import { timingSafeEqual } from "crypto";

const defaultProtectedPath = "/app";

export function getSafeRedirectPath(input: string | null | undefined, fallback = defaultProtectedPath) {
  if (!input) {
    return fallback;
  }

  const value = input.trim();
  if (!value.startsWith("/")) {
    return fallback;
  }

  if (value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("\r") || value.includes("\n")) {
    return fallback;
  }

  return value;
}

export function redirectWithPath(requestUrl: string, path: string, status = 303) {
  return Response.redirect(new URL(path, requestUrl), status);
}

export function secureCompare(secret: string | null | undefined, incoming: string | null | undefined) {
  if (!secret) {
    return true;
  }

  if (!incoming) {
    return false;
  }

  const secretBuffer = Buffer.from(secret);
  const incomingBuffer = Buffer.from(incoming);

  if (secretBuffer.length !== incomingBuffer.length) {
    return false;
  }

  return timingSafeEqual(secretBuffer, incomingBuffer);
}
