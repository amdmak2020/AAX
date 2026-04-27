import type { CookieOptions } from "@supabase/ssr";

export function hardenSupabaseCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: options.sameSite ?? "lax",
    path: options.path ?? "/"
  };
}
