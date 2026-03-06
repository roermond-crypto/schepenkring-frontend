import { api } from "@/lib/api";

export type MeUserType = "ADMIN" | "EMPLOYEE" | "CLIENT";
export type MeUserStatus = "ACTIVE" | "DISABLED" | "BLOCKED";

export type MeUser = {
  id: number;
  type: MeUserType;
  status: MeUserStatus;
  name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  email: string;
  phone: string | null;
  client_location_id: number | null;
  timezone: string | null;
  locale: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  two_factor_enabled: boolean;
  two_factor_confirmed_at: string | null;
  email_changed_at: string | null;
  phone_changed_at: string | null;
  password_changed_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getMe() {
  const { data } = await api.get<{ data: MeUser; impersonation?: unknown | null }>("/me");
  return data;
}

export async function updateMeProfile(payload: {
  name: string;
  timezone?: string | null;
  locale?: string | null;
}) {
  const { data } = await api.patch<{ data: MeUser }>("/me/profile", payload);
  return data;
}

export async function updateMePersonal(payload: {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
}) {
  const { data } = await api.patch<{ data: MeUser }>("/me/personal", payload, {
    headers: { "Idempotency-Key": idempotencyKey() },
  });
  return data;
}

export async function updateMeAddress(payload: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}) {
  const { data } = await api.patch<{ data: MeUser }>("/me/address", payload);
  return data;
}

export async function updateMeSecurity(payload: {
  two_factor_enabled: boolean;
  otp_secret?: string;
  otp_code?: string;
}) {
  const { data } = await api.patch<{ data: MeUser }>("/me/security", payload, {
    headers: { "Idempotency-Key": idempotencyKey() },
  });
  return data;
}

export async function updateMePassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  const { data } = await api.patch<{ data: MeUser }>("/me/password", payload, {
    headers: { "Idempotency-Key": idempotencyKey() },
  });
  return data;
}

export async function stopImpersonation() {
  const { data } = await api.post<{
    token: string;
    impersonator: { id: number; type?: MeUserType; name: string; email: string };
  }>(
    "/admin/impersonate/stop",
    {},
    {
      headers: { "Idempotency-Key": idempotencyKey() },
    },
  );
  return data;
}
