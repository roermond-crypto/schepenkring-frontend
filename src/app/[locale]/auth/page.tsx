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
  searchParams: Promise<{ mode?: string; next?: string }>;
};

export default async function AuthPage({ params, searchParams }: AuthPageProps) {
  const { locale } = await params;
  const { mode, next } = await searchParams;

  if (!isSupportedLocale(locale)) {
    redirect(`/${DEFAULT_LOCALE}/auth`);
  }

  const currentLocale = getLocaleOrDefault(locale);
  const session = await getServerSession();
  const safeNextPath =
    next?.startsWith(`/${currentLocale}/dashboard/`) && !next.startsWith("//")
      ? next
      : null;

  if (session) {
    redirect(safeNextPath ?? `/${currentLocale}/dashboard/${session.user.role}`);
  }

  const initialMode = mode === "register" ? "register" : "login";
  const dict = getDictionary(currentLocale);
  const authDict = dict.auth || {};
  const authCopy = authDict as Record<string, unknown>;
  const authString = (key: string, fallback: string) =>
    typeof authCopy[key] === "string" ? authCopy[key] : fallback;

  return (
    <HeroSection
      locale={currentLocale}
      initialMode={initialMode}
      copy={{
        heroTitle: authDict.heroTitle || "Internal CRM",
        heroSubtitle: authDict.heroSubtitle || "Operations dashboard",
        welcomeBack: authDict.welcomeBack || "Welcome back",
        createAccount: authDict.createAccount || "Create account",
        loginDescription: authDict.loginDescription || "Sign in to your account",
        registerDescription: authDict.registerDescription || "Register for an account",
        fullName: authDict.name || "Full name",
        email: authDict.email || "Email",
        password: authDict.password || "Password",
        confirmPassword: authDict.confirmPassword || "Confirm password",
        verificationCode: authDict.verificationCode || "Code",
        rememberTerminal: authDict.rememberTerminal || "Remember me",
        forgotPassword: authDict.forgotPassword || "Forgot password?",
        verifyEmail: authDict.verifyEmail || "Verify email",
        login: authDict.submitLogin || "Login",
        register: authDict.registerCta || "Register",
        processing: authDict.processing || "Processing...",
        validating: authDict.validating || "Validating...",
        verifyAndContinue: authDict.verifyContinue || "Verify",
        noAccountSignup: authDict.noAccountSignup || "No account?",
        alreadyHaveAccount: authDict.alreadyHaveAccount || "Have an account?",
        clientSignup: authDict.clientSignup || "Client Signup",
        termsLabel: authDict.termsLabel || "I agree to terms",
        termsRequired: authDict.termsRequired || "Terms required",
        selectLocation: authDict.selectLocation || "Select location",
        noLocationYet: authDict.noLocationYet || "No location",
        phone: authDict.phone || "Phone",
        confirmPasswordRequired: authDict.confirmPasswordRequired || "Required",
        passwordsDontMatch: authDict.passwordsDontMatch || "Mismatch",
        enterVerificationCode: authDict.enterVerificationCode || "Enter code",
        verificationCodeSent: authDict.verificationCodeSent || "Code sent",
        invalidLoginResponse: authDict.invalidLoginResponse || "Error",
        authFailed: authDict.authFailed || "Failed",
        termsLabelBeforeLink: authDict.termsLabelBeforeLink || "Agree to",
        termsLinkLabel: authDict.termsLinkLabel || "terms",
        termsLabelAfterLink: authDict.termsLabelAfterLink || ".",
        secureAccess: authDict.secureAccess || "Secure Access",
        buyerSignup: authDict.buyerSignup || "Buyer Signup",
        sellerSignup: authDict.sellerSignup || "Seller Signup",
        loginHeroTitle: authString("loginHeroTitle", authString("heroTitle", "Welcome to your workspace")),
        buyerHeroTitle: authString("buyerHeroTitle", authString("heroTitle", "Find your dream yacht")),
        sellerHeroTitle: authString("sellerHeroTitle", authString("heroTitle", "Sell your vessel")),
        loginHeroSubtitle: authString("loginHeroSubtitle", authString("heroSubtitle", "Access the complete maritime brokerage suite.")),
        memberSupport: authDict.memberSupport || "Support",
        offices: authDict.offices || "Global Offices",
        buyer: authDict.buyer || "Buyer",
        seller: authDict.seller || "Seller",
        benefits: authDict.benefits || {},
      }}
    />
  );
}
