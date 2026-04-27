import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getAppUrl } from "@/lib/env";
import { secureCompare } from "@/lib/security";

export const csrfCookieName = "__Host-aax-csrf";

export function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
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

  if (!cookieToken || !requestToken || !secureCompare(cookieToken, requestToken)) {
    return { ok: false as const, error: "CSRF validation failed." };
  }

  return { ok: true as const };
}
