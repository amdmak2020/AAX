import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Email and password are required.")}`, request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
