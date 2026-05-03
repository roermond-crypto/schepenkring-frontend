import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeRole, type UserRole } from "@/lib/auth/roles";

export const AUTH_TOKEN_COOKIE = "schepenkring_auth_token";
export const AUTH_SESSION_COOKIE = "schepenkring_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  type?: "ADMIN" | "EMPLOYEE" | "CLIENT" | "BUYER" | "SELLER" | "LOCATION" | "PARTNER";
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

export type SessionData = {
  token: string;
  user: SessionUser;
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function encodeSession(value: SessionUser) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeSession(value: string): SessionUser | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionUser;
    const role = normalizeRole(parsed.role);

    if (!parsed.id || !parsed.name || !parsed.email || !role) {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      avatar: parsed.avatar,
      role,
      type: parsed.type,
      status: parsed.status,
      phone: parsed.phone,
      location_id: parsed.location_id,
      location_role: parsed.location_role,
      client_location_id: parsed.client_location_id,
      has_location_assignment: parsed.has_location_assignment,
      can_access_board: parsed.can_access_board,
      location: parsed.location,
      client_location: parsed.client_location,
      locations: parsed.locations,
    };
  } catch {
    return null;
  }
}

export function setAuthCookies(response: NextResponse, data: SessionData) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };

  response.cookies.set(AUTH_TOKEN_COOKIE, data.token, cookieOptions);
  response.cookies.set(AUTH_SESSION_COOKIE, encodeSession(data.user), cookieOptions);
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
  const encodedUser = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (!token || !encodedUser) return null;

  const user = decodeSession(encodedUser);
  if (!user) return null;

  return { token, user };
}
