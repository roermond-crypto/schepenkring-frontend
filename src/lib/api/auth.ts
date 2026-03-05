import { apiRequest } from "@/lib/api/http";
import type { UserRole } from "@/lib/auth/roles";

export type SessionResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
};

export async function login(payload: { email: string; password: string }) {
  return apiRequest<{ user: SessionResponse["user"] }>({
    url: "/api/auth/login",
    method: "POST",
    data: payload,
  });
}

export async function signup(payload: { name: string; email: string; password: string }) {
  return apiRequest<{ user: SessionResponse["user"] }>({
    url: "/api/auth/signup",
    method: "POST",
    data: payload,
  });
}

export async function logout() {
  return apiRequest<{ success: true }>({
    url: "/api/auth/logout",
    method: "POST",
  });
}

export async function getSession() {
  return apiRequest<SessionResponse>({
    url: "/api/auth/session",
    method: "GET",
  });
}
