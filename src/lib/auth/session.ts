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
