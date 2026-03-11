import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isUserRole } from "@/lib/auth/roles";
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

  const realSession = await getServerSession();

  // TODO: Remove this dev bypass before production
  const session = realSession ?? {
    token: "dev-bypass",
    user: { id: "dev", name: "Developer", email: "dev@test.com", role },
  };

  // if (!session) {
  //   redirect(`/${locale}/login`);
  // }

  if (realSession && realSession.user.role !== role) {
    redirect(`/${locale}/dashboard/${realSession.user.role}`);
  }

  const currentLocale = getLocaleOrDefault(locale);
  const userAvatar = normalizeAvatarUrl(session.user.avatar);

  return (
    <DashboardShell
      locale={currentLocale}
      role={session.user.role}
      userName={session.user.name}
      userEmail={session.user.email}
      userAvatar={userAvatar}
    >
      {children}
    </DashboardShell>
  );
}
