import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import { hardenSupabaseCookieOptions } from "@/lib/supabase/cookies";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, hardenSupabaseCookieOptions(options)));
      }
    }
  });
}
