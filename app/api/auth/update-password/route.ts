import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!password || !confirmPassword) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Both password fields are required.")}`, request.url));
  }

  if (password.length < 8) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Password must be at least 8 characters.")}`, request.url));
  }

  if (password !== confirmPassword) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent("Passwords do not match.")}`, request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.redirect(new URL(`/update-password?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL("/login?reset=success", request.url));
}
