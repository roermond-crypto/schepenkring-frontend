import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getLocaleOrDefault, type AppLocale } from "@/lib/i18n";

type LocaleRootPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function LocaleRootPage({ params }: LocaleRootPageProps) {
  const { locale } = await params;
  const currentLocale = getLocaleOrDefault(locale);
  const session = await getServerSession();

  if (!session) {
    redirect(`/${currentLocale}/login`);
  }

  redirect(`/${currentLocale}/dashboard/${session.user.role}`);
}
