export const USER_ROLES = ["client", "employee", "location", "admin", "buyer", "seller"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function normalizeRole(value: string | undefined | null): UserRole | null {
  if (!value) return null;
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === "customer" || lowerValue === "seller" || lowerValue === "buyer") {
    return "client";
  }
  if (lowerValue === "harbor" || lowerValue === "harbour") {
    return "location";
  }
  return isUserRole(lowerValue) ? lowerValue : null;
}

export function rolesAreEquivalent(currentRole: UserRole, routeRole: UserRole) {
  if (currentRole === routeRole) return true;
  return (
    (currentRole === "location" && routeRole === "partner") ||
    (currentRole === "partner" && routeRole === "location")
  );
}

export function isPartnerLikeRole(role: UserRole) {
  return role === "location" || role === "partner";
}
