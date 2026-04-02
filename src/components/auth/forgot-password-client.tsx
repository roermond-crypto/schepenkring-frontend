"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api/auth";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { AppLocale } from "@/lib/i18n";
import Image from "next/image";
import boatsHeroImage from "../../../public/boatslogo.jpg";
import schepenkringLogo from "../../../public/schepenkring-logo.png";

export function ForgotPasswordClient({
  locale,
  copy
}: {
  locale: AppLocale;
  copy: {
    title: string;
    email: string;
    submit: string;
    backToLogin: string;
    successMessage: string;
    errorMessage: string;
  }
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher locale={locale} />
      </div>

      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-slate-900 lg:flex-row">
        <div className="relative lg:w-1/2 h-48 lg:h-auto flex items-center justify-center p-8 overflow-hidden">
          <Image
            alt=""
            src={boatsHeroImage}
            fill
            className="object-cover"
            priority
          />
          <div className="relative z-10">
            <Image
              src={schepenkringLogo}
              alt=""
              width={240}
              height={68}
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 lg:w-1/2 lg:p-10">
          <div className="mb-4">
            <h2 className="mb-1 text-xl font-bold text-gray-800 dark:text-slate-100">
              {copy.title}
            </h2>
          </div>

          {status === "success" ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-4 text-[13px] font-medium text-green-700">
              {message}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {status === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
                  {message}
                </div>
              )}

              <input
                name="email"
                type="email"
                required
                placeholder={copy.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2 text-sm text-gray-700 transition-colors focus:border-[#003566] focus:outline-none dark:border-slate-600 dark:text-slate-200"
              />

              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-2 w-full rounded-lg bg-[#003566] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#001d3d] disabled:opacity-60"
              >
                {status === "loading" ? "..." : copy.submit}
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-xs text-gray-600 dark:text-slate-400">
            <Link
              href={`/${locale}/auth?mode=login`}
              className="font-bold text-[#003566] hover:underline dark:text-sky-300"
            >
              {copy.backToLogin}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
