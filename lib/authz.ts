import { redirect } from "next/navigation";
import { areSubmissionsLocked, hasRole, isAccountSuspended, isBillingLocked, isEmailVerified, isRecentlyAuthenticated, normalizeRole, type AppRole } from "@/lib/access-control";
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
  const { data } = await supabase.from("profiles").select("id,email,full_name,role,is_suspended,submissions_locked,billing_locked,abuse_flags,suspended_reason").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.user_metadata.full_name ?? "",
    role: normalizeRole(data?.role as AppRole | "user" | undefined),
    is_suspended: data?.is_suspended ?? false,
    submissions_locked: data?.submissions_locked ?? false,
    billing_locked: data?.billing_locked ?? false,
    abuse_flags: data?.abuse_flags ?? 0,
    suspended_reason: data?.suspended_reason ?? null
  };
}

export async function getCurrentProfileOptional() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_suspended,submissions_locked,billing_locked,abuse_flags,suspended_reason")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.user_metadata.full_name ?? "",
    role: normalizeRole(data?.role as AppRole | "user" | undefined),
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    is_suspended: data?.is_suspended ?? false,
    submissions_locked: data?.submissions_locked ?? false,
    billing_locked: data?.billing_locked ?? false,
    abuse_flags: data?.abuse_flags ?? 0,
    suspended_reason: data?.suspended_reason ?? null
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

export function getProfileGuardNotice(profile: {
  is_suspended?: boolean | null;
  submissions_locked?: boolean | null;
  billing_locked?: boolean | null;
  suspended_reason?: string | null;
}) {
  if (isAccountSuspended(profile)) {
    return profile.suspended_reason?.trim() || "Your account is temporarily suspended. Contact support if this looks wrong.";
  }

  if (areSubmissionsLocked(profile)) {
    return "Uploads and new boost submissions are currently locked on this account.";
  }

  if (isBillingLocked(profile)) {
    return "Billing actions are currently locked on this account.";
  }

  return null;
}
