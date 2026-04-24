import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();

  if (!email) {
    return NextResponse.redirect(new URL(`/forgot-password?error=${encodeURIComponent("Email is required.")}`, request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/update-password`
  });

  if (error) {
    return NextResponse.redirect(new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`, request.url), { status: 303 });
}
