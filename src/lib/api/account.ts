import { api } from "@/lib/api";

export type MeUserType = "ADMIN" | "EMPLOYEE" | "CLIENT";
export type MeUserStatus = "ACTIVE" | "DISABLED" | "BLOCKED";

export type MeUser = {
  id: number;
  type: MeUserType;
  role: string;
  status: MeUserStatus;
  name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  email: string;
  avatar: string | null;
  phone: string | null;
  location_id: number | null;
  location_role: string | null;
  client_location_id: number | null;
  has_location_assignment: boolean;
  can_access_board: boolean;
  location: {
    id: number;
    name: string;
    code?: string | null;
    role?: string | null;
  } | null;
  client_location: {
    id: number;
    name: string;
    code?: string | null;
  } | null;
  locations: Array<{
    id: number;
    name: string;
    code?: string | null;
    role?: string | null;
  }>;
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

export type CreateScopedClientUserPayload = {
  dashboardRole: string | undefined;
  locationId: number;
  name: string;
  email: string;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateTemporaryPassword() {
  const seed =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(36).slice(2, 12)}`;

  return `Ns!${seed.slice(0, 12)}9a`;
}

export async function getMe() {
  const { data } = await api.get<{ data: MeUser; impersonation?: unknown | null }>("/me");
  return data;
}

export async function getAdminUser(userId: number | string) {
  const { data } = await api.get<{ data: MeUser }>(`/admin/users/${userId}`);
  return data;
}

export async function getScopedClientUser(
  dashboardRole: string | undefined,
  userId: number | string,
) {
  const endpoint =
    dashboardRole === "employee"
      ? `/employee/clients/${userId}`
      : `/admin/users/${userId}`;
  const { data } = await api.get<{ data: MeUser }>(endpoint);
  return data;
}

export async function listScopedClientUsers(params: {
  dashboardRole: string | undefined;
  locationId?: number | null;
  search?: string;
  perPage?: number;
}) {
  const { dashboardRole, locationId, search, perPage = 100 } = params;

  const endpoint =
    dashboardRole === "employee" ? "/employee/clients" : "/admin/users";

  const query =
    dashboardRole === "employee"
      ? {
          per_page: perPage,
          search,
        }
      : {
          type: "CLIENT",
          location_id: locationId ?? undefined,
          per_page: perPage,
          search,
        };

  const { data } = await api.get<{ data: MeUser[] }>(endpoint, {
    params: query,
  });

  return data.data ?? [];
}

export async function createScopedClientUser(
  payload: CreateScopedClientUserPayload,
) {
  if (payload.dashboardRole === "employee") {
    throw new Error("Client creation from this step is only available to admins.");
  }

  const temporaryPassword = generateTemporaryPassword();

  const requestPayload = {
    type: "CLIENT" as const,
    name: payload.name,
    email: payload.email,
    phone: payload.phone ?? null,
    password: temporaryPassword,
    status: "ACTIVE" as const,
    location_id: payload.locationId,
    address_line1: payload.addressLine1 ?? null,
    address_line2: payload.addressLine2 ?? null,
    city: payload.city ?? null,
    state: payload.state ?? null,
    postal_code: payload.postalCode ?? null,
    country: payload.country ?? null,
  };

  const { data } = await api.post<{ data: MeUser }>("/admin/users", requestPayload, {
    headers: { "Idempotency-Key": idempotencyKey() },
  });

  return {
    user: data.data,
    temporaryPassword,
  };
}

export async function updateAdminUser(
  userId: number | string,
  payload: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    status?: MeUserStatus;
    location_id?: number | null;
    location_role?: string | null;
  },
) {
  const { data } = await api.patch<{ data: MeUser }>(
    `/admin/users/${userId}`,
    payload,
    {
      headers: { "Idempotency-Key": idempotencyKey() },
    },
  );
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

export async function updateAvatar(formData: FormData) {
  const { data } = await api.post<{ data: MeUser }>("/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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
