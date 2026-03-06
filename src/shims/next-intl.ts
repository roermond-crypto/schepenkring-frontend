"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getDictionary, getLocaleOrDefault } from "@/lib/i18n";

type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

function getNestedValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

export function useLocale(): string {
  const params = useParams();
  const rawLocale = params?.locale;
  const locale = Array.isArray(rawLocale) ? rawLocale[0] : rawLocale;
  return getLocaleOrDefault(typeof locale === "string" ? locale : undefined);
}

export function useTranslations(namespace?: string): TranslationFn {
  const locale = useLocale();
  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  return (key: string, values?: TranslationValues) => {
    const fullPath = namespace ? `${namespace}.${key}` : key;
    const value = getNestedValue(dictionary, fullPath);

    if (typeof value === "string") {
      if (!values) return value;

      const withPlural = value.replace(
        /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
        (_full, token, one, other) => {
          const quantity = Number(values[token]);
          return quantity === 1 ? one : other;
        },
      );

      return Object.entries(values).reduce((acc, [name, entry]) => {
        const replacement = entry === null || entry === undefined ? "" : String(entry);
        return acc.replaceAll(`{${name}}`, replacement);
      }, withPlural);
    }

    return key;
  };
}
