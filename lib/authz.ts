import { redirect } from "next/navigation";
import { hasRole, isEmailVerified, isRecentlyAuthenticated, normalizeRole, type AppRole } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getCurrentProfile() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.user_metadata.full_name ?? "",
    role: normalizeRole(data?.role as AppRole | "user" | undefined)
  };
}

export async function getCurrentProfileOptional() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", user.id).maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.user_metadata.full_name ?? "",
    role: normalizeRole(data?.role as AppRole | "user" | undefined),
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!hasRole(profile.role, "admin")) {
    redirect("/app");
  }

  if (!isEmailVerified(user)) {
    redirect("/login?error=verify_admin_email&next=/app/admin");
  }

  if (!isRecentlyAuthenticated(user)) {
    redirect("/login?error=admin_reauth_required&next=/app/admin");
  }

  return profile;
}
