import { NextRequest, NextResponse } from "next/server";
import { isUserRole } from "@/lib/auth/roles";
import { AUTH_SESSION_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/auth/session";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n";

function getRoleFromSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  try {
    const base64 = cookieValue.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { role?: string };
    return decoded.role && isUserRole(decoded.role) ? decoded.role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
  }

  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0];

  if (!locale || !isSupportedLocale(locale)) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}${search}`, request.url));
  }

  const hasToken = Boolean(request.cookies.get(AUTH_TOKEN_COOKIE)?.value);
  const encodedSession = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const isAuthed = hasToken && Boolean(encodedSession);

  const subPath = `/${segments.slice(1).join("/")}`;
  const isLoginRoute = subPath === "/login";
  const isSignupRoute = subPath === "/signup";
  const isDashboardRoute = subPath.startsWith("/dashboard");

  if (!isAuthed && isDashboardRoute) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (isAuthed && (isLoginRoute || isSignupRoute)) {
    const role = getRoleFromSessionCookie(encodedSession) ?? "admin";
    return NextResponse.redirect(new URL(`/${locale}/dashboard/${role}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
