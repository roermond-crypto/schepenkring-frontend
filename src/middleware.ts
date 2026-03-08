import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/roles";
import { AUTH_SESSION_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/auth/session";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n";

function getRoleFromSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  try {
    const base64 = cookieValue.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { role?: string };
    return normalizeRole(decoded.role);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const encodedSession = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const cookieRole = getRoleFromSessionCookie(encodedSession) ?? "admin";

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

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}/dashboard/${cookieRole}`, request.url),
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0];

  if (!locale || !isSupportedLocale(locale)) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}${search}`, request.url));
  }

  const subPath = `/${segments.slice(1).join("/")}`;
  const isLocaleDashboardRoot =
    subPath === "/dashboard" || subPath === "/dashboard/";

  if (isLocaleDashboardRoot) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/${cookieRole}`, request.url),
    );
  }

  const isLoginRoute = subPath === "/login" || subPath.startsWith("/login/");
  const isSignupRoute = subPath === "/signup";
  const isAuthRoute = subPath === "/auth" || subPath.startsWith("/auth/");

  const isPublicRoute = isLoginRoute || isSignupRoute || isAuthRoute;

  const hasToken = Boolean(request.cookies.get(AUTH_TOKEN_COOKIE)?.value);
  const isAuthed = hasToken && Boolean(encodedSession);

  if (!isAuthed && !isPublicRoute) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (isAuthed && isPublicRoute) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/${cookieRole}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, icons, and other public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|manifest.json).*)",
  ],
};
