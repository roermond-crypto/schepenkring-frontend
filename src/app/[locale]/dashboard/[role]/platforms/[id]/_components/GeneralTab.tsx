"use client";

import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { LogoUpload } from "@/components/platforms/LogoUpload";
import { getLocaleOrDefault } from "@/lib/i18n";
import { PLATFORM_COUNTRY_CODES, PLATFORM_LANGUAGE_CODES, countryDisplayName, languageDisplayName } from "@/lib/iso-codes";
import { cn } from "@/lib/utils";
import type { PlatformTabProps } from "../_types";
import { FormSection, Field } from "./shared";

const CATEGORY_VALUES = ["marketplace", "portal", "partner", "own_website"] as const;

export function GeneralTab({ form, set, platformId, isNew }: PlatformTabProps & { platformId: number | null; isNew: boolean }) {
  const t = useTranslations("Platforms");
  const locale = getLocaleOrDefault(useLocale());

  const countryOptions = PLATFORM_COUNTRY_CODES.map((code) => ({ value: code, label: countryDisplayName(code, locale) }));
  const languageOptions = PLATFORM_LANGUAGE_CODES.map((code) => ({ value: code, label: languageDisplayName(code, locale) }));

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <FormSection title={t("tabs.general")}>
      <Field label={t("general.logoLabel")} field="logo">
        {isNew || !platformId ? (
          <p className="text-xs text-slate-400 italic">{t("general.logoNewHint")}</p>
        ) : (
          <LogoUpload platformId={platformId} logoUrl={form.logo_url} onUploaded={(url) => set("logo_url", url)} />
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("general.nameLabel")} field="name">
          <Input
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (isNew || !form.slug) set("slug", generateSlug(e.target.value));
            }}
            placeholder={t("general.namePlaceholder")}
            className="text-sm"
          />
        </Field>
        <Field label={t("general.slugLabel")} hint={t("general.slugHint")} field="slug">
          <Input
            value={form.slug}
            onChange={(e) => set("slug", generateSlug(e.target.value))}
            className="text-sm font-mono"
          />
        </Field>
        <Field label={t("general.websiteLabel")} field="website_url">
          <Input
            value={form.website_url}
            onChange={(e) => set("website_url", e.target.value)}
            placeholder="https://..."
            type="url"
            className="text-sm"
          />
        </Field>
        <Field label={t("general.categoryLabel")} field="category">
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400"
          >
            {CATEGORY_VALUES.map((v) => (
              <option key={v} value={v}>{t(`category.${v}`)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={t("general.priorityLabel")} hint={t("general.priorityHint")} field="priority">
          <Input
            value={form.priority}
            onChange={(e) => set("priority", Number(e.target.value) || 10)}
            type="number"
            min={1}
            max={999}
            className="text-sm"
          />
        </Field>
        <Field label={t("general.statusLabel")} field="is_active" className="sm:col-span-2">
          <div className="flex items-center gap-3 h-9">
            <button
              type="button"
              onClick={() => set("is_active", !form.is_active)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                form.is_active ? "bg-green-500" : "bg-slate-200"
              )}
            >
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", form.is_active ? "translate-x-6" : "translate-x-1")} />
            </button>
            <span className="text-sm text-slate-700">{form.is_active ? t("general.statusActive") : t("general.statusInactive")}</span>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("general.countriesLabel")} field="supported_countries">
          <SearchableMultiSelect
            options={countryOptions}
            selected={form.supported_countries}
            onChange={(v) => set("supported_countries", v)}
            placeholder={t("general.countriesPlaceholder")}
            searchPlaceholder={t("general.countriesSearchPlaceholder")}
            emptyLabel={t("general.countriesEmpty")}
          />
        </Field>
        <Field label={t("general.languagesLabel")} field="supported_languages">
          <SearchableMultiSelect
            options={languageOptions}
            selected={form.supported_languages}
            onChange={(v) => set("supported_languages", v)}
            placeholder={t("general.languagesPlaceholder")}
            searchPlaceholder={t("general.languagesSearchPlaceholder")}
            emptyLabel={t("general.languagesEmpty")}
          />
        </Field>
      </div>
    </FormSection>
  );
}
