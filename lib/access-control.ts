export type AppRole = "owner" | "admin" | "member" | "viewer";
export type LegacyAppRole = AppRole | "user" | null | undefined;

const roleRank: Record<AppRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4
};

export function normalizeRole(role: LegacyAppRole): AppRole {
  switch (role) {
    case "owner":
    case "admin":
    case "member":
    case "viewer":
      return role;
    case "user":
    default:
      return "owner";
  }
}

export function hasRole(actorRole: LegacyAppRole, minimumRole: AppRole) {
  return roleRank[normalizeRole(actorRole)] >= roleRank[minimumRole];
}

export function canAccessUserResource(input: {
  actorUserId: string;
  ownerUserId: string;
  actorRole: LegacyAppRole;
}) {
  if (input.actorUserId === input.ownerUserId) {
    return true;
  }

  return normalizeRole(input.actorRole) === "admin";
}

export function isEmailVerified(user: { email_confirmed_at?: string | null } | null | undefined) {
  return Boolean(user?.email_confirmed_at);
}

export function isRecentlyAuthenticated(user: { last_sign_in_at?: string | null } | null | undefined, maxAgeHours = 12) {
  if (!user?.last_sign_in_at) {
    return false;
  }

  const signedInAt = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(signedInAt)) {
    return false;
  }

  return Date.now() - signedInAt <= maxAgeHours * 60 * 60 * 1000;
}
