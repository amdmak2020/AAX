import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import { getSafeRedirectPath } from "@/lib/security";
import { logServerError } from "@/lib/secure-log";
import { hardenSupabaseCookieOptions } from "@/lib/supabase/cookies";

function createCallbackSupabaseClient(request: Request, pendingCookies: { name: string; value: string; options: CookieOptions }[]) {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.headers.get("cookie")
          ? request.headers
              .get("cookie")!
              .split(/;\s*/)
              .filter(Boolean)
              .map((pair) => {
                const index = pair.indexOf("=");
                return {
                  name: index >= 0 ? pair.slice(0, index) : pair,
                  value: index >= 0 ? pair.slice(index + 1) : ""
                };
              })
          : [];
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        pendingCookies.push(...cookiesToSet.map((cookie) => ({ ...cookie, options: hardenSupabaseCookieOptions(cookie.options) })));
      }
    }
  });
}

function attachPendingCookies(response: NextResponse, pendingCookies: { name: string; value: string; options: CookieOptions }[]) {
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeRedirectPath(url.searchParams.get("next"), "/app");
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  if (!code) {
    return attachPendingCookies(
      NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in could not be completed. Please try again.")}`, url.origin), {
        status: 303
      }),
      pendingCookies
    );
  }

  const supabase = createCallbackSupabaseClient(request, pendingCookies);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logServerError("Google auth callback failed", { error });
    return attachPendingCookies(
      NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Google sign-in could not be completed. Please try again.")}`, url.origin),
        { status: 303 }
      ),
      pendingCookies
    );
  }

  return attachPendingCookies(NextResponse.redirect(new URL(next, url.origin), { status: 303 }), pendingCookies);
}
