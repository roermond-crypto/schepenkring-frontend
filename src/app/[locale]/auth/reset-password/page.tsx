import { redirect } from "next/navigation";
import { getDictionary, getLocaleOrDefault, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { ResetPasswordClient } from "@/components/auth/reset-password-client";

export default async function ResetPasswordPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ locale: string }>,
  searchParams: Promise<{ token?: string, email?: string }>
}) {
  const { locale } = await params;
  const { token, email } = await searchParams;
  
  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/auth/reset-password?token=${token}&email=${email}`);
  }
  
  if (!token || !email) {
    redirect(`/${locale}/auth?mode=login`);
  }
  
  const currentLocale = getLocaleOrDefault(locale);
  const dict = getDictionary(currentLocale);

  return (
    <ResetPasswordClient
      locale={currentLocale}
      token={token}
      email={email}
      copy={{
        title: "Wachtwoord herstellen",
        password: dict.auth?.password || "Wachtwoord",
        confirmPassword: dict.auth?.confirmPassword || "Bevestig wachtwoord",
        submit: dict.auth?.processing ? "Verstuur" : "Verstuur",
        backToLogin: dict.auth?.loginTitle || "Terug naar inloggen",
        successMessage: "Uw wachtwoord is succesvol hersteld.",
        errorMessage: "Er is een fout opgetreden. Probeer het later opnieuw."
      }}
    />
  );
}
