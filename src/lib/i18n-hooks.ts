"use client";

import { usePathname } from "next/navigation";
import { getDictionary, getLocaleOrDefault, type AppLocale } from "@/lib/i18n";

/**
 * Client-side hook to get the current locale from the URL pathname.
 * Replaces next-intl's useLocale().
 */
export function useLocale(): AppLocale {
    const pathname = usePathname();
    const segment = pathname.split("/")[1] || "";
    return getLocaleOrDefault(segment);
}

/**
 * Client-side hook to get the full dictionary for the current locale.
 * Returns the raw JSON object so you can access nested keys directly.
 * Replaces next-intl's useTranslations().
 *
 * Usage:
 *   const dict = useTranslations();
 *   const label = dict.DashboardYachts?.pageTitle ?? "Yachts";
 */
export function useTranslations(locale?: string) {
    const autoLocale = useLocale();
    return getDictionary(locale ?? autoLocale) as Record<string, any>;
}
