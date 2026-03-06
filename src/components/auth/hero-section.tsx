"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  login,
  signup,
  verifyStepUp,
  type StepUpChallengeResponse,
} from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import { normalizeRole, type UserRole } from "@/lib/auth/roles";
import { type AppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/common/language-switcher";

type AuthMode = "login" | "register";

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
    verifyEmail: string;
    login: string;
    register: string;
    processing: string;
    validating: string;
    verifyAndContinue: string;
    noAccountSignup: string;
    alreadyHaveAccount: string;
    clientSignup: string;
    confirmPasswordRequired: string;
    passwordsDontMatch: string;
    enterVerificationCode: string;
    verificationCodeSent: string;
    invalidLoginResponse: string;
    authFailed: string;
  };
};

type StepUpChallenge = {
  email: string;
  otp_challenge_id: string;
  otp_ttl_minutes?: number;
  device_id?: string;
  reasons?: string[];
};

type AuthPayload = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

export function HeroSection({ locale, initialMode, copy }: HeroSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpChallenge, setStepUpChallenge] = useState<StepUpChallenge | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    setMode(modeParam === "register" ? "register" : "login");
  }, [searchParams]);

  useEffect(() => {
    const stored = sessionStorage.getItem("pending_step_up_challenge");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as StepUpChallenge;
      if (parsed?.otp_challenge_id) {
        setStepUpChallenge(parsed);
      }
    } catch {
      sessionStorage.removeItem("pending_step_up_challenge");
    }
  }, []);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function persistStepUp(challenge: StepUpChallengeResponse) {
    const nextChallenge: StepUpChallenge = {
      email: formData.email,
      otp_challenge_id: challenge.otp_challenge_id,
      otp_ttl_minutes: challenge.otp_ttl_minutes,
      device_id: challenge.device_id,
      reasons: challenge.reasons,
    };

    setStepUpChallenge(nextChallenge);
    sessionStorage.setItem("pending_step_up_challenge", JSON.stringify(nextChallenge));
  }

  function resolveAuthPayload(response: unknown): AuthPayload | null {
    if (!response || typeof response !== "object") return null;
    const data = response as Record<string, unknown>;

    const token = typeof data.token === "string" ? data.token : null;
    const nestedUser =
      data.user && typeof data.user === "object"
        ? (data.user as Record<string, unknown>)
        : null;

    const role =
      normalizeRole((nestedUser?.role as string | undefined) ?? (data.userType as string | undefined) ?? (data.role as string | undefined) ?? null);
    const id = (nestedUser?.id as string | number | undefined) ?? (data.id as string | number | undefined);
    const name = (nestedUser?.name as string | undefined) ?? (data.name as string | undefined);
    const email = (nestedUser?.email as string | undefined) ?? (data.email as string | undefined);

    if (!token || !role || id === undefined || !name || !email) return null;

    return {
      token,
      user: {
        id: String(id),
        name,
        email,
        role,
      },
    };
  }

  async function handleVerifyStepUp() {
    if (!stepUpChallenge) return;
    if (!stepUpCode.trim()) {
      setError(copy.enterVerificationCode);
      return;
    }

    const response = await verifyStepUp({
      email: stepUpChallenge.email,
      code: stepUpCode.trim(),
      otp_challenge_id: stepUpChallenge.otp_challenge_id,
      device_id: stepUpChallenge.device_id,
    });

    sessionStorage.removeItem("pending_step_up_challenge");
    setStepUpChallenge(null);
    setStepUpCode("");
    const payload = resolveAuthPayload(response);
    if (!payload) throw new Error(copy.invalidLoginResponse);
    setClientSession(payload.token, payload.user);

    router.push(`/${locale}/dashboard/${payload.user.role}`);
    router.refresh();
  }

  async function executeAuth() {
    if (mode === "register") {
      if (!formData.confirmPassword) {
        setError(copy.confirmPasswordRequired);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError(copy.passwordsDontMatch);
        return;
      }
    }

    if (mode === "login") {
      const response = await login({
        email: formData.email,
        password: formData.password,
        remember_terminal: rememberMe,
      });

      if ("step_up_required" in response && response.step_up_required) {
        persistStepUp(response);
        setSuccess(response.message ?? copy.verificationCodeSent);
        return;
      }

      const payload = resolveAuthPayload(response);
      if (!payload) throw new Error(copy.invalidLoginResponse);
      setClientSession(payload.token, payload.user);

      router.push(`/${locale}/dashboard/${payload.user.role}`);
      router.refresh();
      return;
    }

    const response = await signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
    });

    if ("verification_required" in response && response.verification_required) {
      setSuccess(response.message ?? copy.verificationCodeSent);
      setTimeout(() => {
        router.push(`/${locale}/auth/verify-email?email=${encodeURIComponent(response.email)}`);
      }, 600);
      return;
    }

    const payload = resolveAuthPayload(response);
    if (payload) {
      setClientSession(payload.token, payload.user);
      router.push(`/${locale}/dashboard/${payload.user.role}`);
      router.refresh();
      return;
    }

    router.push(`/${locale}/dashboard/client`);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (mode === "login" && stepUpChallenge) {
        await handleVerifyStepUp();
      } else {
        await executeAuth();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.authFailed;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function setModeOnRoute(nextMode: AuthMode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", nextMode);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher locale={locale} />
      </div>

      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-slate-900 lg:flex-row">
        <div className="relative flex h-48 items-center justify-center overflow-hidden p-8 lg:h-auto lg:w-1/2">
          <Image
            src="/hero-image-two.jpg"
            alt="Schepenkring Hero"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#001d3d]/65" />
          <div className="relative z-10 text-center text-white">
            <p className="text-xs tracking-[0.25em] uppercase opacity-80">Schepenkring</p>
            <h1 className="mt-3 text-3xl font-bold">CRM</h1>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] opacity-80">{copy.heroTitle}</p>
            <p className="mt-3 text-sm opacity-80">{copy.heroSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 lg:w-1/2 lg:p-10">
          <div className="mb-4">
            {mode !== "login" ? (
              <div className="mb-4 flex rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setModeOnRoute("register")}
                  className="flex-1 rounded-md bg-white py-1.5 text-[11px] font-bold text-[#003566] shadow dark:bg-slate-700 dark:text-white"
                >
                  {copy.clientSignup}
                </button>
              </div>
            ) : null}

            <h2 className="mb-1 text-xl font-bold text-gray-800 dark:text-slate-100">
              {mode === "login" ? copy.welcomeBack : copy.createAccount}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {mode === "login"
                ? copy.loginDescription
                : copy.registerDescription}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-600">
                {success}
              </div>
            ) : null}

            {mode !== "login" ? (
              <input
                name="name"
                type="text"
                required
                placeholder={copy.fullName}
                value={formData.name}
                onChange={onInputChange}
                className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
              />
            ) : null}

            <input
              name="email"
              type="email"
              required
              placeholder={copy.email}
              value={formData.email}
              onChange={onInputChange}
              className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
            />

            <input
              name="password"
              type="password"
              required
              placeholder={copy.password}
              value={formData.password}
              onChange={onInputChange}
              className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
            />

            {mode === "login" && stepUpChallenge ? (
              <input
                name="stepUpCode"
                type="text"
                required
                placeholder={copy.verificationCode}
                value={stepUpCode}
                onChange={(event) => setStepUpCode(event.target.value)}
                className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
              />
            ) : null}

            {mode !== "login" ? (
              <input
                name="confirmPassword"
                type="password"
                required
                placeholder={copy.confirmPassword}
                value={formData.confirmPassword}
                onChange={onInputChange}
                className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
              />
            ) : null}

            {mode === "login" ? (
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs text-gray-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-[#003566] focus:ring-[#003566]"
                />
                  <span>{copy.rememberTerminal}</span>
                </label>

                <Link href={`/${locale}/auth/verify-email`} className="text-xs text-gray-600 hover:text-[#003566] dark:text-slate-300">
                  {copy.verifyEmail}
                </Link>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-lg bg-[#003566] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#001d3d] disabled:opacity-60"
            >
              {isLoading
                ? mode === "login" && stepUpChallenge
                  ? copy.validating
                  : copy.processing
                : mode === "login" && stepUpChallenge
                  ? copy.verifyAndContinue
                  : mode === "login"
                    ? copy.login
                    : copy.register}
            </button>

            <div className="mt-4 text-center text-xs text-gray-600 dark:text-slate-400">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setModeOnRoute("register");
                    setStepUpChallenge(null);
                    setStepUpCode("");
                    setError("");
                    setSuccess("");
                  }}
                  className="font-bold text-[#003566] hover:underline dark:text-sky-300"
                >
                  {copy.noAccountSignup}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModeOnRoute("login");
                    setError("");
                    setSuccess("");
                  }}
                  className="font-bold text-[#003566] hover:underline dark:text-sky-300"
                >
                  {copy.alreadyHaveAccount}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
