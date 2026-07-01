"use client";

import { FormEvent, type ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  Globe2, 
  Anchor, 
  ShoppingBag, 
  LineChart, 
  FileText,
  Eye,
  EyeOff
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  getPublicLocations,
  login,
  resendVerification,
  type PublicLocation,
  signup,
  verifyStepUp,
  type StepUpChallengeResponse,
} from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import { normalizeRole, type UserRole } from "@/lib/auth/roles";
import { type AppLocale } from "@/lib/i18n";
import { PublicHeader } from "@/components/common/PublicHeader";
import boatsHeroImage from "../../../public/boatslogo.jpg";

type AuthMode = "login" | "register";
type SignupRole = "buyer" | "seller";
type BenefitItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";

type HeroSectionProps = {
  locale: AppLocale;
  initialMode: AuthMode;
  copy: {
    heroTitle: string;
    heroSubtitle: string;
    welcomeBack: string;
    createAccount: string;
    loginDescription: string;
    registerDescription: string;
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    verificationCode: string;
    rememberTerminal: string;
    forgotPassword: string;
    verifyEmail: string;
    login: string;
    register: string;
    processing: string;
    validating: string;
    verifyAndContinue: string;
    noAccountSignup: string;
    alreadyHaveAccount: string;
    clientSignup: string;
    termsLabel: string;
    termsRequired: string;
    selectLocation: string;
    noLocationYet: string;
    phone: string;
    confirmPasswordRequired: string;
    passwordsDontMatch: string;
    enterVerificationCode: string;
    verificationCodeSent: string;
    invalidLoginResponse: string;
    authFailed: string;
    termsLabelBeforeLink: string;
    termsLinkLabel: string;
    termsLabelAfterLink: string;
    secureAccess: string;
    buyerSignup: string;
    sellerSignup: string;
    intakeCtaLabel: string;
    intakeCtaSubtext: string;
    loginHeroTitle: string;
    buyerHeroTitle: string;
    sellerHeroTitle: string;
    loginHeroSubtitle: string;
    memberSupport: string;
    supportAddressLine1: string;
    supportAddressLine2: string;
    supportEmail: string;
    supportPhone: string;
    resendVerificationLink: string;
    verifyEmailPrompt: string;
    offices: string;
    buyer: string;
    seller: string;
    benefits: {
      buyer: {
        watchlist: { title: string; desc: string };
        verified: { title: string; desc: string };
        deals: { title: string; desc: string };
      };
      seller: {
        onboarding: { title: string; desc: string };
        preparation: { title: string; desc: string };
        support: { title: string; desc: string };
      };
    };
  };
};

const getBenefits = (copy: HeroSectionProps['copy']) => {
  const buyerBenefits = copy?.benefits?.buyer || {
    watchlist: { title: "", desc: "" },
    verified: { title: "", desc: "" },
    deals: { title: "", desc: "" },
  };
  const sellerBenefits = copy?.benefits?.seller || {
    onboarding: { title: "", desc: "" },
    preparation: { title: "", desc: "" },
    support: { title: "", desc: "" },
  };

  return {
    buyer: [
      {
        icon: ShoppingBag,
        title: buyerBenefits.watchlist?.title || "",
        desc: buyerBenefits.watchlist?.desc || ""
      },
      {
        icon: ShieldCheck,
        title: buyerBenefits.verified?.title || "",
        desc: buyerBenefits.verified?.desc || ""
      },
      {
        icon: LineChart,
        title: buyerBenefits.deals?.title || "",
        desc: buyerBenefits.deals?.desc || ""
      }
    ],
    seller: [
      {
        icon: Anchor,
        title: sellerBenefits.onboarding?.title || "",
        desc: sellerBenefits.onboarding?.desc || ""
      },
      {
        icon: FileText,
        title: sellerBenefits.preparation?.title || "",
        desc: sellerBenefits.preparation?.desc || ""
      },
      {
        icon: Globe2,
        title: sellerBenefits.support?.title || "",
        desc: sellerBenefits.support?.desc || ""
      }
    ]
  };
};

export function HeroSection({ locale, initialMode, copy }: HeroSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [signupRole, setSignupRole] = useState<SignupRole>("buyer");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpChallenge, setStepUpChallenge] =
    useState<StepUpChallengeResponse | null>(null);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerifyActions, setShowVerifyActions] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location_id: "",
    website: "",
    password: "",
    confirmPassword: "",
  });

  const normalizedFormEmail = formData.email.trim();
  const nextPath = searchParams.get("next");
  const safeNextPath =
    nextPath?.startsWith(`/${locale}/dashboard/`) && !nextPath.startsWith("//")
      ? nextPath
      : null;
  const verifyEmailHref = normalizedFormEmail
    ? `/${locale}/auth/verify-email?email=${encodeURIComponent(normalizedFormEmail)}`
    : `/${locale}/auth/verify-email`;

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    setMode(modeParam === "register" ? "register" : "login");
  }, [searchParams]);

  useEffect(() => {
    if (mode !== "register") return;
    let mounted = true;

    async function loadLocations() {
      setLoadingLocations(true);
      try {
        const next = await getPublicLocations();
        if (!mounted) return;
        setLocations(Array.isArray(next) ? next : []);
      } catch {
        if (mounted) setLocations([]);
      } finally {
        if (mounted) setLoadingLocations(false);
      }
    }

    void loadLocations();
    return () => { mounted = false; };
  }, [mode]);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        const response = await login({
          email: formData.email,
          password: formData.password,
          remember_terminal: rememberMe,
        });

        if (response && "token" in response) {
          setClientSession(response.token!, response.user);
          router.push(safeNextPath ?? `/${locale}/dashboard/${response.user.role}`);
          router.refresh();
        }
      } else {
        if (!acceptedTerms) throw new Error(copy.termsRequired);
        if (formData.password !== formData.confirmPassword) throw new Error(copy.passwordsDontMatch);

        const response = await signup({
          ...formData,
          locale,
          role: signupRole,
          location_id: formData.location_id ? Number(formData.location_id) : undefined,
          terms_accepted: acceptedTerms,
        });

        if (response && "verification_required" in response) {
          setSuccess(response.message || "Registration successful.");
          setTimeout(() => router.push(verifyEmailHref), 1000);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : copy.authFailed;
      setError(message);
      const needsVerification =
        /verif/i.test(message) ||
        /email.*(not|un)/i.test(message) ||
        /geactiveerd/i.test(message);
      setShowVerifyActions(mode === "login" && needsVerification);
    } finally {
      setIsLoading(false);
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#edf3f7] dark:bg-slate-950 font-sans">

      {/* ── White top header ── */}
      <PublicHeader
        locale={locale}
        authMode={mode}
        onSwitchMode={switchMode}
        labels={{
          login: copy.login || "Inloggen",
          register: copy.register || "Registreren",
          bootAanmelden: copy.intakeCtaLabel || "Boot aanmelden",
        }}
        showBootAanmelden
      />

      {/* ── Auth card ── */}
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900 lg:flex-row"
        >
          {/* Left Side: Brand Imagery (no logo — it's in the header now) */}
          <div className="relative lg:w-2/5 min-h-[220px] lg:min-h-0 flex flex-col items-center justify-center p-8 lg:p-10 overflow-hidden">
            <Image
              alt=""
              src={boatsHeroImage}
              fill
              className="object-cover opacity-30"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#003566]/85 via-[#003566]/92 to-[#001d3d]" />

            <div className="relative z-10 flex flex-col items-center text-center w-full">
              {mode === "register" ? (
                <div key={signupRole} className="text-left w-full max-w-xs">
                  <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200 border border-white/15 mb-4">
                    {signupRole === "buyer" ? (copy.buyerSignup || "Buyer signup") : (copy.sellerSignup || "Seller signup")}
                  </span>
                  <h2 className="text-2xl font-bold text-white leading-snug mb-6">
                    {signupRole === "buyer" ? copy.buyerHeroTitle : copy.sellerHeroTitle}
                  </h2>
                  <div className="space-y-5">
                    {getBenefits(copy)[signupRole].map((benefit: BenefitItem, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-200">
                          <benefit.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{benefit.title}</p>
                          <p className="text-xs text-white/60 leading-relaxed mt-0.5">{benefit.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-xs">
                  <h2 className="text-xl font-bold text-white mb-2">{copy.loginHeroTitle}</h2>
                  <p className="text-sm text-white/70 leading-relaxed">{copy.loginHeroSubtitle}</p>
                </div>
              )}
            </div>

            <div className="relative z-10 mt-10 pt-6 border-t border-white/10 w-full hidden lg:block text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-1">{copy.memberSupport}</p>
              <p className="text-xs text-white/70 font-semibold">{copy.supportAddressLine1}</p>
              <p className="text-xs text-white/70 font-semibold mb-1">{copy.supportAddressLine2}</p>
              <p className="text-xs text-white/60">
                <a href={`mailto:${copy.supportEmail}`} className="hover:text-white">{copy.supportEmail}</a>
                {" · "}
                <a href={`tel:${copy.supportPhone.replace(/\s/g, "")}`} className="hover:text-white">{copy.supportPhone}</a>
              </p>
            </div>
          </div>

          {/* Right Side: Auth Form */}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14 lg:w-3/5 bg-white dark:bg-slate-900">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-1">
              {mode === "login" ? copy.welcomeBack : copy.createAccount}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {mode === "login" ? copy.loginDescription : copy.registerDescription}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-3 text-[13px] text-red-700 font-medium"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{error}</p>
                    {showVerifyActions ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={verifyEmailHref}
                          className="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                        >
                          {copy.verifyEmail}
                        </Link>
                        <button
                          type="button"
                          disabled={resendingVerification || !normalizedFormEmail}
                          onClick={async () => {
                            if (!normalizedFormEmail) return;
                            setResendingVerification(true);
                            try {
                              await resendVerification({ email: normalizedFormEmail, locale });
                              setSuccess(copy.verificationCodeSent);
                            } catch (resendErr: unknown) {
                              setError(
                                resendErr instanceof Error
                                  ? resendErr.message
                                  : copy.authFailed,
                              );
                            } finally {
                              setResendingVerification(false);
                            }
                          }}
                          className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {resendingVerification ? copy.processing : copy.resendVerificationLink}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-3 text-[13px] text-green-700 font-medium"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "register" && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSignupRole("buyer")}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-colors ${signupRole === "buyer" ? "bg-white shadow-sm text-[#003566] dark:bg-slate-700 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <ShoppingBag size={14} />
                  {copy.buyer}
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRole("seller")}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-colors ${signupRole === "seller" ? "bg-white shadow-sm text-[#003566] dark:bg-slate-700 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Anchor size={14} />
                  {copy.seller}
                </button>
              </div>
            )}

            <div className="space-y-4">
              {mode !== "login" && (
                <UnderlineInput
                  name="name"
                  placeholder={copy.fullName}
                  value={formData.name}
                  onChange={onInputChange}
                  required
                />
              )}

              {mode !== "login" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UnderlineInput
                    name="phone"
                    type="tel"
                    placeholder={copy.phone}
                    value={formData.phone}
                    onChange={onInputChange}
                  />
                  <select
                    name="location_id"
                    value={formData.location_id}
                    onChange={onInputChange}
                    required
                    className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
                  >
                    <option value="">{copy.selectLocation}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <UnderlineInput
                name="email"
                type="email"
                placeholder={copy.email}
                value={formData.email}
                onChange={onInputChange}
                required
              />

              <UnderlineInput
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={copy.password}
                value={formData.password}
                onChange={onInputChange}
                required
                showToggle
                onToggle={() => setShowPassword(!showPassword)}
                isToggled={showPassword}
              />

              {mode !== "login" && (
                <UnderlineInput
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={copy.confirmPassword}
                  value={formData.confirmPassword}
                  onChange={onInputChange}
                  required
                  showToggle
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  isToggled={showConfirmPassword}
                />
              )}
            </div>

            {mode === "login" && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#003566] focus:ring-[#003566]"
                  />
                  <span className="text-sm text-gray-500">{copy.rememberTerminal}</span>
                </label>
                <Link href={`/${locale}/auth/forgot-password`} className="text-sm font-semibold text-[#003566] hover:underline dark:text-sky-300">
                  {copy.forgotPassword}
                </Link>
              </div>
            )}

            {mode !== "login" && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-[#003566] transition-colors dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#003566] focus:ring-[#003566]"
                  required
                />
                <span className="text-xs leading-5 text-gray-500">
                  {copy.termsLabelBeforeLink}{" "}
                  <a
                    href="https://www.schepenkring.nl/privacy-cookies/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[#003566] underline"
                  >
                    {copy.termsLinkLabel}
                  </a>
                  {" "}{copy.termsLabelAfterLink}
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#003566] py-3 text-sm font-semibold text-white transition-all hover:bg-[#001d3d] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "login" ? copy.login : copy.register}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const nextMode = mode === "login" ? "register" : "login";
                  setMode(nextMode);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("mode", nextMode);
                  router.push(`${pathname}?${params.toString()}`);
                }}
                className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-[#003566] transition-colors"
              >
                {mode === "login" ? copy.noAccountSignup : copy.alreadyHaveAccount}
              </button>
            </div>

            {/* Boot aanmelden CTA — shown in mobile only (desktop has it in the nav) */}
            <div className="sm:hidden pt-5 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
              <Link
                href={`/${locale}/boot-aanmelden`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#C8102E] text-white text-xs font-bold hover:bg-[#a50d25] transition-colors"
              >
                {copy.intakeCtaLabel} →
              </Link>
            </div>
          </form>
        </div>
        </motion.div>
      </div>
    </div>
  );
}

type UnderlineInputProps = {
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
  isToggled?: boolean;
};

function UnderlineInput({
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  showToggle,
  onToggle,
  isToggled,
}: UnderlineInputProps) {
  return (
    <div className="relative">
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 pr-8 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#003566] transition-colors"
        >
          {isToggled ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  );
}
