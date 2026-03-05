import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { DEFAULT_LOCALE, getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/login`);
  }

  const session = await getServerSession();
  const currentLocale = getLocaleOrDefault(locale);

  if (session) {
    redirect(`/${currentLocale}/dashboard/${session.user.role}`);
  }

  return <main className="min-h-screen" />;
}
