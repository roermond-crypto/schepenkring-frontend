export const USER_ROLES = ["client", "employee", "location", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function normalizeRole(value: string | undefined | null): UserRole | null {
  if (!value) return null;
  const lowerValue = value.toLowerCase();
  return isUserRole(lowerValue) ? lowerValue : null;
}
