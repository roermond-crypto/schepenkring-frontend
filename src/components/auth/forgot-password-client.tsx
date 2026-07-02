"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, AlertCircle, ChevronRight, ShieldCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/api/auth";
import type { AppLocale } from "@/lib/i18n";
import { PublicHeader } from "@/components/common/PublicHeader";
import boatsHeroImage from "../../../public/boatslogo.jpg";

export function ForgotPasswordClient({
  locale,
  copy,
}: {
  locale: AppLocale;
  copy: {
    title: string;
    email: string;
    submit: string;
    submitLoading: string;
    backToLogin: string;
    successMessage: string;
    errorMessage: string;
    heroTitle: string;
    heroSubtitle: string;
    memberSupport: string;
    supportAddressLine1: string;
    supportAddressLine2: string;
    supportEmail: string;
    supportPhone: string;
  };
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setMessage("");
    try {
      await requestPasswordReset({ email, locale });
      setStatus("success");
      setMessage(copy.successMessage);
    } catch {
      setStatus("error");
      setMessage(copy.errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#edf3f7] dark:bg-slate-950 font-sans">

      <PublicHeader locale={locale} showBootAanmelden />

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900 lg:flex-row">

          {/* Left: brand panel */}
          <div className="relative lg:w-2/5 min-h-[220px] lg:min-h-0 flex flex-col items-center justify-center p-8 lg:p-10 overflow-hidden">
            <Image
              alt=""
              src={boatsHeroImage}
              fill
              className="object-cover opacity-30"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#003566]/85 via-[#003566]/92 to-[#001d3d]" />

            <div className="relative z-10 flex flex-col items-center text-center w-full max-w-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 mb-5">
                <ShieldCheck className="h-7 w-7 text-sky-200" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">{copy.heroTitle}</h2>
              <p className="text-sm text-white/70 leading-relaxed">{copy.heroSubtitle}</p>
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

          {/* Right: form */}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14 lg:w-3/5 bg-white dark:bg-slate-900">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-1">
                {copy.title}
              </h2>
            </div>

            {status === "success" ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-3 text-[13px] text-green-700 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                {status === "error" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-3 text-[13px] text-red-700 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{message}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder={copy.email}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full rounded-lg bg-[#003566] py-3 text-sm font-semibold text-white transition-all hover:bg-[#001d3d] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {status === "loading" ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {copy.submit}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href={`/${locale}/auth?mode=login`}
                    className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-[#003566] transition-colors"
                  >
                    {copy.backToLogin}
                  </Link>
                </div>
              </form>
            )}

            {status === "success" && (
              <div className="text-center pt-6">
                <Link
                  href={`/${locale}/auth?mode=login`}
                  className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-[#003566] transition-colors"
                >
                  {copy.backToLogin}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
