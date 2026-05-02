import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isUserRole, rolesAreEquivalent, type UserRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

type DashboardRoleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; role: string }>;
};

function normalizeAvatarUrl(value?: string) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }

  const configured =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.BACKEND_API_URL;
  const apiBase = normalizeApiBaseUrl(configured || "https://app.schepen-kring.nl/api");
  const origin = apiBase.replace(/\/api\/?$/, "");

  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

export default async function DashboardRoleLayout({ children, params }: DashboardRoleLayoutProps) {
  const { locale, role } = await params;

  if (!isSupportedLocale(locale) || !isUserRole(role)) {
    notFound();
  }

  const routeRole = role as UserRole;

  const realSession = await getServerSession();

  const session = realSession;

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (realSession && !rolesAreEquivalent(realSession.user.role, routeRole)) {
    redirect(`/${locale}/dashboard/${realSession.user.role}`);
  }

  const currentLocale = getLocaleOrDefault(locale);
  const userAvatar = normalizeAvatarUrl(session.user.avatar);

  return (
    <DashboardShell
      locale={currentLocale}
      role={routeRole}
      userName={session.user.name}
      userEmail={session.user.email}
      userAvatar={userAvatar}
    >
      {children}
    </DashboardShell>
  );
}
