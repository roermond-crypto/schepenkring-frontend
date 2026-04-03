import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { DEFAULT_LOCALE, getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";
import { redirect } from "next/navigation";

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; code?: string }>;
};

export default async function VerifyEmailPage({ params, searchParams }: VerifyEmailPageProps) {
  const { locale } = await params;
  const { email, code } = await searchParams;

  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/auth/verify-email`);
  }

  const currentLocale = getLocaleOrDefault(locale);

  return (
    <main className="min-h-screen bg-gray-50 p-4 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <VerifyEmailForm locale={currentLocale} email={email ?? ""} code={code ?? ""} />
      </div>
    </main>
  );
}
