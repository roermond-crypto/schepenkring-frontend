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
  const a = dict.auth || {};

  return (
    <ForgotPasswordClient
      locale={currentLocale}
      copy={{
        title: a.forgotPassword || "Forgot password?",
        email: a.email || "Email",
        submit: a.forgotPasswordSubmit || "Send reset link",
        submitLoading: a.processing || "Processing...",
        backToLogin: a.forgotPasswordBackToLogin || "Back to login",
        successMessage: a.forgotPasswordSuccess || "If your email exists in our system, you will receive a reset link shortly.",
        errorMessage: a.forgotPasswordError || "Something went wrong. Please try again later.",
        heroTitle: a.forgotPasswordHeroTitle || a.loginHeroTitle || "Secure access",
        heroSubtitle: a.forgotPasswordHeroSubtitle || a.loginHeroSubtitle || "Enter your email address and we will send you a link to reset your password.",
        memberSupport: a.memberSupport || "Support",
        supportAddressLine1: a.supportAddressLine1 || "Parkhaven 3",
        supportAddressLine2: a.supportAddressLine2 || "8242 PE Lelystad",
        supportEmail: a.supportEmail || "lelystad@schepenkring.nl",
        supportPhone: a.supportPhone || "+31 (0)320 711340",
      }}
    />
  );
}
