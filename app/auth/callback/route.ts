import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";
import { logServerError } from "@/lib/secure-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeRedirectPath(url.searchParams.get("next"), "/app");

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in could not be completed. Please try again.")}`, url.origin), {
      status: 303
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logServerError("Google auth callback failed", { error });
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Google sign-in could not be completed. Please try again.")}`, url.origin),
      { status: 303 }
    );
  }

  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
