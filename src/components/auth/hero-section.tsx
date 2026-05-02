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
  type PublicLocation,
  signup,
  verifyStepUp,
  type StepUpChallengeResponse,
} from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import { normalizeRole, type UserRole } from "@/lib/auth/roles";
import { type AppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import boatsHeroImage from "../../../public/boatslogo.jpg";
import schepenkringLogo from "../../../public/schepenkring-logo.png";

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
    loginHeroTitle: string;
    buyerHeroTitle: string;
    sellerHeroTitle: string;
    loginHeroSubtitle: string;
    memberSupport: string;
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
      setError(err instanceof Error ? err.message : copy.authFailed);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] dark:bg-[#020617] p-2 sm:p-4 font-sans overflow-hidden">
      <div className="fixed right-6 top-6 z-50">
        <LanguageSwitcher locale={locale} />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex w-full max-w-5xl flex-col lg:flex-row overflow-hidden rounded-[40px] bg-white shadow-[0_40px_100px_-20px_rgba(11,31,58,0.15)] dark:bg-slate-900 dark:shadow-none border border-slate-100 dark:border-slate-800"
      >
        {/* Left Side: Brand Imagery */}
        <div className="relative lg:w-[45%] bg-[#0B1F3A] p-10 lg:p-14 flex flex-col justify-between overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <Image
              alt=""
              src={boatsHeroImage}
              fill
              className="object-cover opacity-40 mix-blend-overlay"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#0B1F3A] via-[#0B1F3A]/95 to-[#050f1d]"></div>
          </div>

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-16"
            >
              <div className="bg-white rounded-full px-8 py-5 inline-block border border-white/10 shadow-2xl">
                <Image
                  src={schepenkringLogo}
                  alt="Schepenkring"
                  width={180}
                  height={50}
                  className="object-contain"
                />
              </div>
            </motion.div>

            <div className="mt-8">
              <div 
                key={mode === 'register' ? signupRole : 'login'}
                className="transition-all duration-500"
              >
                <div className="inline-flex rounded-full bg-sky-400/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-sky-400 border border-sky-400/20 mb-6">
                  {mode === 'login' 
                    ? (copy.secureAccess || "Secure Access") 
                    : (signupRole === 'buyer' ? (copy.buyerSignup || "Buyer Signup") : (copy.sellerSignup || "Seller Signup"))
                  }
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-white leading-[1.15] mb-6 tracking-tight">
                  {mode === 'login' 
                    ? copy.loginHeroTitle
                    : signupRole === 'buyer' 
                      ? copy.buyerHeroTitle
                      : copy.sellerHeroTitle
                  }
                </h1>
                
                <div className="h-1 w-20 bg-sky-500/50 rounded-full mb-8" />
                
                {mode === 'register' ? (
                  <div className="space-y-6">
                    {getBenefits(copy)[signupRole].map((benefit: BenefitItem, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-5"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sky-300 border border-white/5 shadow-inner">
                          <benefit.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-white">{benefit.title}</p>
                          <p className="text-sm text-white/50 leading-relaxed mt-0.5">{benefit.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xl text-white/60 leading-relaxed font-medium">
                    {copy.loginHeroSubtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-10 mt-12 border-t border-white/5 hidden lg:block">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 p-0.5 shadow-lg">
                <div className="h-full w-full rounded-full bg-[#0B1F3A] flex items-center justify-center">
                  <span className="text-xs font-black text-white">SK</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black leading-none">{copy.memberSupport}</p>
                <p className="text-sm text-white/70 font-semibold mt-1">{copy.offices}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex flex-col justify-center p-8 lg:p-20 lg:w-[55%] bg-white dark:bg-slate-900 relative">
          <div className="max-w-md mx-auto w-full">
            
            <div className="mb-12 text-center lg:text-left">
              <h2 className="text-3xl font-black text-[#0B1F3A] dark:text-white mb-3 tracking-tight">
                {mode === "login" ? copy.welcomeBack : copy.createAccount}
              </h2>
              <p className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {mode === "login" ? copy.loginDescription : copy.registerDescription}
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-2xl border border-red-100 bg-red-50 p-4 flex gap-4 text-sm text-red-700 font-bold dark:bg-red-900/10 dark:border-red-900/20 shadow-sm"
                  >
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex gap-4 text-sm text-emerald-700 font-bold dark:bg-emerald-900/10 dark:border-emerald-900/20 shadow-sm"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <p>{success}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 rounded-2xl dark:bg-slate-800/80 mb-8 border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSignupRole('buyer')}
                    className={`flex items-center justify-center gap-2 py-3 text-sm font-black rounded-xl transition-all duration-300 ${signupRole === 'buyer' ? 'bg-white shadow-md text-[#0B1F3A] dark:bg-slate-700 dark:text-white transform scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <ShoppingBag size={16} />
                    {copy.buyer}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole('seller')}
                    className={`flex items-center justify-center gap-2 py-3 text-sm font-black rounded-xl transition-all duration-300 ${signupRole === 'seller' ? 'bg-white shadow-md text-[#0B1F3A] dark:bg-slate-700 dark:text-white transform scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Anchor size={16} />
                    {copy.seller}
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {mode !== "login" && (
                  <InputGroup
                    name="name"
                    icon={FileText}
                    placeholder={copy.fullName}
                    value={formData.name}
                    onChange={onInputChange}
                    required
                  />
                )}

                {mode !== "login" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputGroup
                      name="phone"
                      type="tel"
                      icon={LineChart}
                      placeholder={copy.phone}
                      value={formData.phone}
                      onChange={onInputChange}
                    />
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0B1F3A] transition-colors pointer-events-none">
                        <Anchor size={18} />
                      </div>
                      <select
                        name="location_id"
                        value={formData.location_id}
                        onChange={onInputChange}
                        required
                        className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 text-sm font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-sky-500/10 focus:border-[#0B1F3A] outline-none transition-all appearance-none dark:bg-slate-800/50 dark:border-slate-700 dark:text-white shadow-sm"
                      >
                        <option value="" className="font-sans">{copy.selectLocation}</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <InputGroup
                  name="email"
                  type="email"
                  icon={Globe2}
                  placeholder={copy.email}
                  value={formData.email}
                  onChange={onInputChange}
                  required
                />

                <InputGroup
                  name="password"
                  type={showPassword ? "text" : "password"}
                  icon={ShieldCheck}
                  placeholder={copy.password}
                  value={formData.password}
                  onChange={onInputChange}
                  required
                  showToggle
                  onToggle={() => setShowPassword(!showPassword)}
                  isToggled={showPassword}
                />

                {mode !== "login" && (
                  <InputGroup
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    icon={ShieldCheck}
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
                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`h-5 w-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-[#0B1F3A] border-[#0B1F3A] shadow-md' : 'border-slate-200 bg-white group-hover:border-[#0B1F3A]'}`}>
                      {rememberMe && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 className="h-3.5 w-3.5 text-white" /></motion.div>}
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                    </div>
                    <span className="text-sm text-slate-500 font-bold group-hover:text-[#0B1F3A] transition-colors">{copy.rememberTerminal}</span>
                  </label>
                  <Link href={`/${locale}/auth/forgot-password`} className="text-sm font-black text-[#0B1F3A] hover:text-sky-600 transition-colors dark:text-sky-300">
                    {copy.forgotPassword}
                  </Link>
                </div>
              )}

              {mode !== "login" && (
                <label className="flex items-start gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:border-[#0B1F3A] transition-all group dark:bg-slate-800/30 dark:border-slate-700 shadow-sm">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded-lg border-slate-300 text-[#0B1F3A] focus:ring-[#0B1F3A]"
                    required
                  />
                  <span className="text-xs leading-5 text-slate-500 font-medium group-hover:text-slate-800 transition-colors">
                    {copy.termsLabelBeforeLink} <Link href="/" className="font-black text-[#0B1F3A] underline decoration-sky-300 decoration-4 underline-offset-4 dark:text-sky-400">{copy.termsLinkLabel}</Link> {copy.termsLabelAfterLink}
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-16 bg-[#0B1F3A] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-[#051121] active:scale-[0.97] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-10 shadow-[0_20px_40px_-10px_rgba(11,31,58,0.35)] lg:shadow-[0_20px_40px_-10px_rgba(11,31,58,0.25)] ring-offset-2 focus:ring-4 focus:ring-[#0B1F3A]/20"
              >
                {isLoading ? (
                  <div className="h-6 w-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {mode === 'login' ? copy.login : copy.register}
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div className="text-center mt-10">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = mode === 'login' ? 'register' : 'login';
                    setMode(nextMode);
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("mode", nextMode);
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  className="group relative inline-flex items-center gap-2 py-2 px-4 rounded-xl hover:bg-slate-50 transition-all dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 transition-colors group-hover:text-[#0B1F3A]">
                    {mode === 'login' ? copy.noAccountSignup : copy.alreadyHaveAccount}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

type InputGroupProps = {
  name: string;
  type?: string;
  icon: LucideIcon;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
  isToggled?: boolean;
};

function InputGroup({
  name, 
  type = "text", 
  icon: Icon, 
  placeholder, 
  value, 
  onChange, 
  required,
  showToggle,
  onToggle,
  isToggled 
}: InputGroupProps) {
  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0B1F3A] transition-colors pointer-events-none">
        <Icon size={18} />
      </div>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 text-sm font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-sky-500/10 focus:border-[#0B1F3A] outline-none transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:text-white shadow-sm"
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1F3A] transition-colors"
        >
          {isToggled ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
}
