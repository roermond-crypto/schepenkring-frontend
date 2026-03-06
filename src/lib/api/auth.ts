import { apiRequest } from "@/lib/api/http";
import type { UserRole } from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export async function login(payload: {
  email: string;
  password: string;
  remember_terminal?: boolean;
}) {
  return apiRequest<LoginResponse>({
    baseURL: "/api/auth",
    url: "/login",
    method: "POST",
    data: payload,
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
        baseURL: "/api/auth",
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

export async function signup(payload: { name: string; email: string; password: string }) {
  return apiRequest<SignupResponse>({
    baseURL: "/api/auth",
    url: "/signup",
    method: "POST",
    data: {
      ...payload,
      password_confirmation: payload.password,
      accept_terms: true,
      role: "client",
    },
  });
}

export async function verifyEmail(payload: { email: string; code: string }) {
  return apiRequest<{ verified: boolean; token?: string; user?: SessionUser }>({
    baseURL: "/api/auth",
    url: "/verify-email",
    method: "POST",
    data: payload,
  });
}

export async function resendVerification(payload: { email: string }) {
  return apiRequest<{ sent: true; message?: string }>({
    baseURL: "/api/auth",
    url: "/resend-verification",
    method: "POST",
    data: payload,
  });
}

export async function logout() {
  return apiRequest<{ success?: true; message?: string }>({
    baseURL: "/api/auth",
    url: "/logout",
    method: "POST",
  });
}

export async function getSession() {
  return apiRequest<SessionResponse>({
    baseURL: "/api/auth",
    url: "/session",
    method: "GET",
  });
}
