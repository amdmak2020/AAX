import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Supabase service role environment variables are not configured.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
