import { apiRequest } from "@/lib/api/http";
import type { UserRole } from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  type?: "ADMIN" | "EMPLOYEE" | "CLIENT" | "LOCATION" | "PARTNER";
  status?: "ACTIVE" | "DISABLED" | "BLOCKED";
  phone?: string | null;
  location_id?: number | null;
  location_role?: string | null;
  client_location_id?: number | null;
  has_location_assignment?: boolean;
  can_access_board?: boolean;
  location?: { id: number; name?: string; code?: string; role?: string } | null;
  client_location?: { id: number; name?: string; code?: string; role?: string } | null;
  locations?: Array<{ id: number; name?: string; code?: string; role?: string }>;
};

export type SessionResponse = {
  user: SessionUser | null;
};

export type StepUpChallengeResponse = {
  step_up_required: true;
  otp_challenge_id: string;
  otp_ttl_minutes?: number;
  device_id?: string;
  reasons?: string[];
  message?: string;
};

export type LoginResponse =
  | {
    token?: string;
    user: SessionUser;
  }
  | StepUpChallengeResponse;

export type SignupResponse =
  | {
    token?: string;
    user: SessionUser;
  }
  | {
    verification_required: true;
    email: string;
    message?: string;
  };

export type PublicLocation = {
  id: number;
  name: string;
  code?: string | null;
};

export async function getPublicLocations() {
  return apiRequest<PublicLocation[]>({
    url: "/public/locations",
    method: "GET",
  });
}

export async function login(payload: {
  email: string;
  password: string;
  remember_terminal?: boolean;
  device_name?: string;
}) {
  const body = {
    email: payload.email,
    password: payload.password,
    remember_terminal: payload.remember_terminal,
    device_name: payload.device_name ?? "web",
  };

  return apiRequest<LoginResponse>({
    url: "/auth/login",
    method: "POST",
    data: body,
  });
}

export async function verifyStepUp(payload: {
  email: string;
  code: string;
  otp_challenge_id: string;
  device_id?: string;
}) {
  const endpoints = [
    "/login/verify-step-up",
    "/verify-step-up",
    "/login/verify-otp",
  ];

  for (const endpoint of endpoints) {
    try {
      return await apiRequest<{ token?: string; user: SessionUser }>({
        url: endpoint,
        method: "POST",
        data: payload,
      });
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw new Error("Verification endpoint not available");
}

export async function signup(payload: {
  name: string;
  email: string;
  locale?: string;
  role?: string;
  phone?: string;
  location_id?: number;
  website?: string;
  password: string;
  terms_accepted: boolean;
}) {
  const body = {
    name: payload.name,
    email: payload.email,
    locale: payload.locale,
    role: payload.role,
    phone: payload.phone,
    location_id: payload.location_id,
    website: payload.website ?? "",
    password: payload.password,
    password_confirmation: payload.password,
    terms_accepted: payload.terms_accepted,
  };

  return apiRequest<SignupResponse>({
    url: "/auth/register",
    method: "POST",
    data: body,
  });
}

export async function verifyEmail(payload: { email: string; code: string }) {
  return apiRequest<{ verified: boolean; token?: string; user?: SessionUser }>({
    url: "/verify-email",
    method: "POST",
    data: payload,
  });
}

export async function resendVerification(payload: { email: string; locale?: string }) {
  return apiRequest<{ sent: true; verified?: boolean; message?: string }>({
    url: "/resend-verification",
    method: "POST",
    data: payload,
  });
}

export async function logout() {
  return apiRequest<{ success?: true; message?: string }>({
    url: "/auth/logout",
    method: "POST",
  });
}

export async function getSession() {
  return apiRequest<SessionResponse>({
    url: "/session",
    method: "GET",
  });
}

export async function requestPasswordReset(payload: { email: string; locale?: string }) {
  return apiRequest<{ status?: string; message?: string }>({
    url: "/auth/forgot-password",
    method: "POST",
    data: payload,
  });
}

export async function resetPassword(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}) {
  return apiRequest<{ status?: string; message?: string }>({
    url: "/auth/reset-password",
    method: "POST",
    data: payload,
  });
}
