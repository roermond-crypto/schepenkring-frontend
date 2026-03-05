"use client";

import Cookies from "js-cookie";
import type { SessionUser } from "@/lib/auth/session";

export const AUTH_TOKEN_COOKIE = "schepenkring_auth_token";
export const AUTH_SESSION_COOKIE = "schepenkring_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function toBase64Url(value: string) {
  const utf8 = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
    String.fromCharCode(Number.parseInt(p1, 16)),
  );

  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function setClientSession(token: string, user: SessionUser) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const options = {
    expires: MAX_AGE / (60 * 60 * 24),
    sameSite: "lax" as const,
    secure,
  };

  Cookies.set(AUTH_TOKEN_COOKIE, token, options);
  Cookies.set(AUTH_SESSION_COOKIE, toBase64Url(JSON.stringify(user)), options);
}

export function clearClientSession() {
  Cookies.remove(AUTH_TOKEN_COOKIE);
  Cookies.remove(AUTH_SESSION_COOKIE);
}

export function getClientToken() {
  // Check cookie first, then fall back to localStorage
  const cookieToken = Cookies.get(AUTH_TOKEN_COOKIE);
  if (cookieToken) return cookieToken;

  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token") ?? null;
  }

  return null;
}
