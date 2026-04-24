import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? "Could not start Google sign in." }, { status: 400 });
  }

  return NextResponse.redirect(data.url, { status: 303 });
}
