import en from "@/locales/en.json";
import de from "@/locales/de.json";
import nl from "@/locales/nl.json";
import fr from "@/locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "de", "nl", "fr"] as const;
export const DEFAULT_LOCALE = "nl";

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
const dictionaries = {
  en,
  de,
  nl,
  fr,
} as const;

export type Dictionary = (typeof dictionaries)[AppLocale];

export function isSupportedLocale(locale: string): locale is AppLocale {
  return SUPPORTED_LOCALES.includes(locale as AppLocale);
}

export function getLocaleOrDefault(locale: string | undefined): AppLocale {
  if (!locale) return DEFAULT_LOCALE;
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function getDictionary(locale: string | undefined): Dictionary {
  return dictionaries[getLocaleOrDefault(locale)];
}
