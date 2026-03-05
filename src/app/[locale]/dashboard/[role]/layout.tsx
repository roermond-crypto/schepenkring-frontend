import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isUserRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

type DashboardRoleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; role: string }>;
};

export default async function DashboardRoleLayout({ children, params }: DashboardRoleLayoutProps) {
  const { locale, role } = await params;

  if (!isSupportedLocale(locale) || !isUserRole(role)) {
    notFound();
  }

  const session = await getServerSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.user.role !== role) {
    redirect(`/${locale}/dashboard/${session.user.role}`);
  }

  const currentLocale = getLocaleOrDefault(locale);

  return (
    <DashboardShell
      locale={currentLocale}
      role={session.user.role}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </DashboardShell>
  );
}
