import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { getSafeRedirectPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = formData.get("name")?.toString();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const next = getSafeRedirectPath(formData.get("next")?.toString(), "/app");

  if (!name || !email || !password) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent("Name, email, and password are required.")}`, request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(email)}`, request.url), { status: 303 });
}
