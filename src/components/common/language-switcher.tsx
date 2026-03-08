"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import enFlag from "../../../public/flags/en.svg";
import nlFlag from "../../../public/flags/nl.svg";
import deFlag from "../../../public/flags/de.svg";
import frFlag from "../../../public/flags/fr.svg";
import type { StaticImageData } from "next/image";

type LanguageSwitcherProps = {
  locale: AppLocale;
};

const META: Record<AppLocale, { name: string; icon: StaticImageData }> = {
  en: { name: "English", icon: enFlag },
  nl: { name: "Nederlands", icon: nlFlag },
  de: { name: "Deutsch", icon: deFlag },
  fr: { name: "Français", icon: frFlag },
};

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const changeLanguage = (nextLocale: AppLocale) => {
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    const query = searchParams.toString();
    const nextPath = `/${nextLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}${query ? `?${query}` : ""}`;
    router.push(nextPath);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        aria-label={`Language: ${META[locale].name}`}
      >
        <Image
          src={META[locale].icon}
          width={20}
          height={14}
          alt={META[locale].name}
          className="rounded-sm border border-black/10"
        />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-border bg-white shadow-lg dark:bg-slate-900">
          {SUPPORTED_LOCALES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeLanguage(item)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <Image
                  src={META[item].icon}
                  width={20}
                  height={14}
                  alt={META[item].name}
                  className="rounded-sm border border-black/10"
                />
                <span>{META[item].name}</span>
              </span>
              <span className="text-[10px] uppercase text-muted-foreground">{item}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
