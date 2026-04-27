import { cookies } from "next/headers";
import { getAppUrl } from "@/lib/env";

export const csrfCookieName = "__Host-aax-csrf";

export function createCsrfToken() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getAllowedOrigin() {
  return new URL(getAppUrl()).origin;
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowedOrigin = getAllowedOrigin();

  if (origin) {
    return origin === allowedOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === allowedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

function secureCompareCsrf(secret: string, incoming: string) {
  if (secret.length !== incoming.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < secret.length; index += 1) {
    mismatch |= secret.charCodeAt(index) ^ incoming.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function getCsrfTokenForRender() {
  const cookieStore = await cookies();
  return cookieStore.get(csrfCookieName)?.value ?? "";
}

export async function verifyCsrfRequest(request: Request, explicitToken?: string | null) {
  if (!isSameOriginRequest(request)) {
    return { ok: false as const, error: "Invalid request origin." };
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(csrfCookieName)?.value ?? "";
  const requestToken = explicitToken ?? request.headers.get("x-csrf-token") ?? "";

  if (!cookieToken || !requestToken || !secureCompareCsrf(cookieToken, requestToken)) {
    return { ok: false as const, error: "CSRF validation failed." };
  }

  return { ok: true as const };
}
