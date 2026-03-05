import { notFound, redirect } from "next/navigation";
import { isUserRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { isSupportedLocale } from "@/lib/i18n";

type LocalizedDashboardPageProps = {
  params: Promise<{
    locale: string;
    role: string;
  }>;
};

export default async function LocalizedDashboardRolePage({ params }: LocalizedDashboardPageProps) {
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

  return <main className="min-h-screen" />;
}
