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
        title: dict.auth?.forgotPassword || "Forgot password?",
        email: dict.auth?.email || "Email",
        submit: dict.auth?.forgotPasswordSubmit || "Send reset link",
        submitLoading: dict.auth?.processing || "Processing...",
        backToLogin: dict.auth?.forgotPasswordBackToLogin || "Back to login",
        successMessage:
          dict.auth?.forgotPasswordSuccess ||
          "If your email address exists in our system, you will receive a password reset link shortly.",
        errorMessage:
          dict.auth?.forgotPasswordError ||
          "Something went wrong. Please try again later.",
      }}
    />
  );
}
