import { redirect } from "next/navigation";
import { HeroSection } from "@/components/auth/hero-section";
import { getServerSession } from "@/lib/auth/session";
import {
  DEFAULT_LOCALE,
  getDictionary,
  getLocaleOrDefault,
  isSupportedLocale,
} from "@/lib/i18n";

type AuthPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function AuthPage({ params, searchParams }: AuthPageProps) {
  const { locale } = await params;
  const { mode } = await searchParams;

  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/auth`);
  }

  const currentLocale = getLocaleOrDefault(locale);
  const session = await getServerSession();

  if (session) {
    redirect(`/${currentLocale}/dashboard/${session.user.role}`);
  }

  const initialMode = mode === "register" ? "register" : "login";
  const dict = getDictionary(currentLocale);

  return (
    <HeroSection
      locale={currentLocale}
      initialMode={initialMode}
      copy={{
        heroTitle: dict.auth.heroTitle,
        heroSubtitle: dict.auth.heroSubtitle,
        welcomeBack: dict.auth.welcomeBack,
        createAccount: dict.auth.createAccount,
        loginDescription: dict.auth.loginDescription,
        registerDescription: dict.auth.registerDescription,
        fullName: dict.auth.name,
        email: dict.auth.email,
        password: dict.auth.password,
        confirmPassword: dict.auth.confirmPassword,
        verificationCode: dict.auth.verificationCode,
        rememberTerminal: dict.auth.rememberTerminal,
        forgotPassword: dict.auth.forgotPassword,
        verifyEmail: dict.auth.verifyEmail,
        login: dict.auth.submitLogin,
        register: dict.auth.registerCta,
        processing: dict.auth.processing,
        validating: dict.auth.validating,
        verifyAndContinue: dict.auth.verifyContinue,
        noAccountSignup: dict.auth.noAccountSignup,
        alreadyHaveAccount: dict.auth.alreadyHaveAccount,
        clientSignup: dict.auth.clientSignup,
        confirmPasswordRequired: dict.auth.confirmPasswordRequired,
        passwordsDontMatch: dict.auth.passwordsDontMatch,
        enterVerificationCode: dict.auth.enterVerificationCode,
        verificationCodeSent: dict.auth.verificationCodeSent,
        invalidLoginResponse: dict.auth.invalidLoginResponse,
        authFailed: dict.auth.authFailed,
        termsRequired: dict.auth.termsRequired,
        termsLabelBeforeLink: dict.auth.termsLabelBeforeLink,
        termsLinkLabel: dict.auth.termsLinkLabel,
        termsLabelAfterLink: dict.auth.termsLabelAfterLink,
      }}
    />
  );
}
