import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { PublicHeader } from "@/components/common/PublicHeader";
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
    <div className="min-h-screen flex flex-col bg-[#edf3f7] dark:bg-slate-950">
      <PublicHeader locale={currentLocale} showBootAanmelden />
      <div className="flex-1 flex items-center justify-center p-4">
        <VerifyEmailForm locale={currentLocale} email={email ?? ""} code={code ?? ""} />
      </div>
    </div>
  );
}
