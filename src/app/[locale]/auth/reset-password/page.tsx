import { redirect } from "next/navigation";
import { getDictionary, getLocaleOrDefault, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { ResetPasswordClient } from "@/components/auth/reset-password-client";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = (dict.auth || {}) as any;

  return (
    <ResetPasswordClient
      locale={currentLocale}
      token={token}
      email={email}
      copy={{
        title: a.resetPasswordTitle || "Set new password",
        password: a.password || "Password",
        confirmPassword: a.confirmPassword || "Confirm password",
        submit: a.resetPasswordSubmit || "Set password",
        submitLoading: a.processing || "Processing...",
        backToLogin: a.forgotPasswordBackToLogin || "Back to login",
        successMessage: a.resetPasswordSuccess || "Your password has been reset successfully.",
        errorMessage: a.resetPasswordError || "Something went wrong. Please try again.",
        mismatchMessage: a.passwordsDontMatch || "Passwords do not match.",
        heroTitle: a.resetPasswordHeroTitle || a.loginHeroTitle || "Choose a new password",
        heroSubtitle: a.resetPasswordHeroSubtitle || a.loginHeroSubtitle || "Pick a strong password to keep your account secure.",
        memberSupport: a.memberSupport || "Support",
        supportAddressLine1: a.supportAddressLine1 || "Parkhaven 3",
        supportAddressLine2: a.supportAddressLine2 || "8242 PE Lelystad",
        supportEmail: a.supportEmail || "lelystad@schepenkring.nl",
        supportPhone: a.supportPhone || "+31 (0)320 711340",
      }}
    />
  );
}
