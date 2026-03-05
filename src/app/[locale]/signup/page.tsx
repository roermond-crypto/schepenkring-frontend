import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { DEFAULT_LOCALE, getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

type SignupPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignupPage({ params }: SignupPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/signup`);
  }

  const session = await getServerSession();
  const currentLocale = getLocaleOrDefault(locale);

  if (session) {
    redirect(`/${currentLocale}/dashboard/${session.user.role}`);
  }

  return <main className="min-h-screen" />;
}
