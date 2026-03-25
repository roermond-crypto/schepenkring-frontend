import { redirect } from "next/navigation";
import { getDictionary, getLocaleOrDefault, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { ForgotPasswordClient } from "@/components/auth/forgot-password-client";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/auth/forgot-password`);
  }
  
  const currentLocale = getLocaleOrDefault(locale);
  const dict = getDictionary(currentLocale);

  return (
    <ForgotPasswordClient
      locale={currentLocale}
      copy={{
        title: dict.auth?.forgotPassword || "Wachtwoord vergeten?",
        email: dict.auth?.email || "E-mail",
        submit: dict.auth?.processing ? "Verstuur bericht" : "Verstuur bericht",
        backToLogin: dict.auth?.loginTitle || "Terug naar inloggen",
        successMessage: "Als uw e-mailadres in ons systeem staat, ontvangt u een link om uw wachtwoord opnieuw in te stellen.",
        errorMessage: "Er is een fout opgetreden. Probeer het later opnieuw."
      }}
    />
  );
}
