"use client";

import { useTranslations } from "next-intl";
import { Rss } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PlatformTabProps } from "../_types";
import { FormSection, Field } from "./shared";

export function OpenMarineTab({ form, set }: PlatformTabProps) {
  const t = useTranslations("Platforms");

  return (
    <FormSection title={t("tabs.openmarine")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set("is_openmarine_enabled", !form.is_openmarine_enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            form.is_openmarine_enabled ? "bg-indigo-500" : "bg-slate-200"
          )}
        >
          <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", form.is_openmarine_enabled ? "translate-x-6" : "translate-x-1")} />
        </button>
        <span className="text-sm text-slate-700 font-medium">{t("openmarine.enabledLabel")}</span>
        <Rss size={14} className={form.is_openmarine_enabled ? "text-indigo-500" : "text-slate-300"} />
      </div>

      {form.is_openmarine_enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <Field label={t("openmarine.versionLabel")}>
            <select
              value={form.openmarine_version}
              onChange={(e) => set("openmarine_version", e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="2.0">{t("openmarine.version2")}</option>
              <option value="1.0">{t("openmarine.version1")}</option>
            </select>
          </Field>
          <Field label={t("openmarine.dealerIdLabel")} hint={t("openmarine.dealerIdHint")}>
            <Input
              value={form.openmarine_dealer_id}
              onChange={(e) => set("openmarine_dealer_id", e.target.value)}
              className="text-sm font-mono"
            />
          </Field>
          <Field label={t("openmarine.categoryMapLabel")} hint={t("openmarine.categoryMapHint")} className="sm:col-span-2">
            <textarea
              value={form.openmarine_category_map}
              onChange={(e) => set("openmarine_category_map", e.target.value)}
              placeholder='{"motorboat": "MB", "sailboat": "SB", "catamaran": "CAT"}'
              rows={3}
              className="w-full text-xs font-mono rounded-md border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
          </Field>
        </div>
      )}
    </FormSection>
  );
}
