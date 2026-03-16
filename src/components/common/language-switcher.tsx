"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import enFlag from "../../../public/flags/en.svg";
import nlFlag from "../../../public/flags/nl.svg";
import deFlag from "../../../public/flags/de.svg";
import frFlag from "../../../public/flags/fr.svg";
import type { StaticImageData } from "next/image";

type LanguageSwitcherProps = {
  locale: AppLocale;
};

declare global {
  interface Window {
    __flushYachtDraftNow?: () => Promise<void> | void;
  }
}

const META: Record<AppLocale, { name: string; icon: StaticImageData }> = {
  en: { name: "English", icon: enFlag },
  nl: { name: "Nederlands", icon: nlFlag },
  de: { name: "Deutsch", icon: deFlag },
  fr: { name: "Français", icon: frFlag },
};

const COPY: Record<
  AppLocale,
  {
    currentLanguageAria: string;
    unsavedTitle: string;
    unsavedDescription: string;
    stay: string;
    switchLanguage: string;
  }
> = {
  en: {
    currentLanguageAria: "Language: {language}",
    unsavedTitle: "Unsaved boat progress",
    unsavedDescription:
      "You have unsaved boat draft progress. Switching language may interrupt your current editing flow.",
    stay: "Stay",
    switchLanguage: "Switch language",
  },
  nl: {
    currentLanguageAria: "Taal: {language}",
    unsavedTitle: "Niet-opgeslagen bootvoortgang",
    unsavedDescription:
      "Je hebt niet-opgeslagen voortgang in het bootconcept. Van taal wisselen kan je huidige bewerkflow onderbreken.",
    stay: "Blijven",
    switchLanguage: "Taal wisselen",
  },
  de: {
    currentLanguageAria: "Sprache: {language}",
    unsavedTitle: "Ungespeicherter Bootsfortschritt",
    unsavedDescription:
      "Sie haben ungespeicherten Fortschritt im Bootsentwurf. Ein Sprachwechsel kann Ihren aktuellen Bearbeitungsablauf unterbrechen.",
    stay: "Bleiben",
    switchLanguage: "Sprache wechseln",
  },
  fr: {
    currentLanguageAria: "Langue : {language}",
    unsavedTitle: "Progression du bateau non enregistree",
    unsavedDescription:
      "Vous avez une progression non enregistree dans le brouillon du bateau. Changer de langue peut interrompre votre flux de modification actuel.",
    stay: "Rester",
    switchLanguage: "Changer de langue",
  },
};

function hasUnsavedYachtDraftProgress(pathname: string): boolean {
  if (typeof window === "undefined") return false;

  // Protect any yacht creation/edit flow from accidental language switches
  if (
    pathname.includes("/yachts/add") ||
    pathname.match(/\/yachts\/(new|\d+)(?:\/|$)/)
  ) {
    return true; // Always warn if actively in the form view
  }

  if (!pathname.includes("/yachts")) return false;

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("yacht_draft_")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        pendingSync?: boolean;
        data?: Record<string, Record<string, unknown>>;
      };

      if (parsed.pendingSync) return true;

      const hasStepData = Object.values(parsed.data || {}).some(
        (step) => step && Object.keys(step).length > 0,
      );
      if (hasStepData) return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copy = COPY[locale] ?? COPY.en;

  const flushDraftBeforeNavigate = async () => {
    if (typeof window === "undefined") return;
    const flushFn = window.__flushYachtDraftNow;
    if (typeof flushFn !== "function") return;

    // Keep language switch responsive even if flush work stalls.
    await Promise.race([
      Promise.resolve(flushFn()),
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);
  };

  const navigateToLocale = async (nextLocale: AppLocale) => {
    await flushDraftBeforeNavigate();
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    const query = searchParams.toString();
    const nextPath = `/${nextLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}${query ? `?${query}` : ""}`;
    router.push(nextPath);
    setIsOpen(false);
  };

  const changeLanguage = (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      setIsOpen(false);
      return;
    }

    if (hasUnsavedYachtDraftProgress(pathname)) {
      setPendingLocale(nextLocale);
      setConfirmOpen(true);
      setIsOpen(false);
      return;
    }

    void navigateToLocale(nextLocale);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        aria-label={copy.currentLanguageAria.replace(
          "{language}",
          META[locale].name,
        )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#003566] dark:text-slate-100">
              {copy.unsavedTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              {copy.unsavedDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingLocale(null);
                setConfirmOpen(false);
              }}
            >
              {copy.stay}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLocale) {
                  void navigateToLocale(pendingLocale);
                }
                setPendingLocale(null);
                setConfirmOpen(false);
              }}
            >
              {copy.switchLanguage}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
