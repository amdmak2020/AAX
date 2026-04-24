import { redirect } from "next/navigation";
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
    role: data?.role ?? "user"
  };
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    redirect("/app");
  }
  return profile;
}
