"use client";

import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import type { AppLocale } from "@/lib/i18n";
import schepenkringLogo from "../../../public/schepenkring-logo.png";

interface PublicHeaderProps {
  locale: AppLocale;
  labels?: {
    supply?: string;
    locations?: string;
    about?: string;
    login?: string;
    register?: string;
    bootAanmelden?: string;
  };
  authMode?: "login" | "register";
  onSwitchMode?: (mode: "login" | "register") => void;
  showBootAanmelden?: boolean;
}

export function PublicHeader({
  locale,
  labels = {},
  authMode,
  onSwitchMode,
  showBootAanmelden = true,
}: PublicHeaderProps) {
  const supply = labels.supply ?? "Aanbod";
  const locations = labels.locations ?? "Vestigingen";
  const about = labels.about ?? "Over ons";
  const login = labels.login ?? "Inloggen";
  const register = labels.register ?? "Registreren";
  const bootAanmelden = labels.bootAanmelden ?? "Boot aanmelden";

  const navLinks = [
    { label: supply, href: "https://www.schepenkring.nl/aanbod-boten/" },
    { label: locations, href: "https://www.schepenkring.nl/vestigingen/" },
    { label: about, href: "https://www.schepenkring.nl/boot-verkopen/schip-verkopen/" },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">

        {/* Logo */}
        <Link href={`/${locale}/boot-aanmelden`} className="flex items-center shrink-0">
          <Image
            src={schepenkringLogo}
            alt="Schepenkring"
            width={150}
            height={42}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          {/* Nav links */}
          <div className="flex items-center gap-6 text-sm font-medium">
            {navLinks.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-slate-600 hover:text-[#003566] transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          {/* Auth toggles + CTA + language */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onSwitchMode ? (
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => onSwitchMode("login")}
                  className={[
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                    authMode === "login"
                      ? "bg-white text-[#003566] shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                >
                  {login}
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchMode("register")}
                  className={[
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                    authMode === "register"
                      ? "bg-white text-[#003566] shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                >
                  {register}
                </button>
              </div>
            ) : (
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <Link
                  href={`/${locale}/auth?mode=login`}
                  className="px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-white"
                >
                  {login}
                </Link>
                <Link
                  href={`/${locale}/auth?mode=register`}
                  className="px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 hover:text-slate-700 hover:bg-white"
                >
                  {register}
                </Link>
              </div>
            )}

            {showBootAanmelden && (
              <Link
                href={`/${locale}/boot-aanmelden`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#C8102E] hover:bg-[#a50d25] text-white text-xs font-bold transition-colors"
              >
                {bootAanmelden}
              </Link>
            )}

            <LanguageSwitcher locale={locale} />
          </div>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitcher locale={locale} />
          {onSwitchMode ? (
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => onSwitchMode("login")}
                className={[
                  "px-2.5 py-1.5 rounded-md text-xs font-bold transition-all",
                  authMode === "login"
                    ? "bg-white text-[#003566] shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {login}
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode("register")}
                className={[
                  "px-2.5 py-1.5 rounded-md text-xs font-bold transition-all",
                  authMode === "register"
                    ? "bg-white text-[#003566] shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {register}
              </button>
            </div>
          ) : (
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <Link
                href={`/${locale}/auth?mode=login`}
                className="px-2.5 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 hover:text-slate-700"
              >
                {login}
              </Link>
              <Link
                href={`/${locale}/auth?mode=register`}
                className="px-2.5 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 hover:text-slate-700"
              >
                {register}
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}
