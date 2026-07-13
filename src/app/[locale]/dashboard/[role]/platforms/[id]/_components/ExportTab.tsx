"use client";

import { useTranslations } from "next-intl";
import { Rss, Code2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PlatformTabProps } from "../_types";
import { FormSection, Field } from "./shared";

const EXPORT_METHODS = [
  { value: "openmarine", labelKey: "methodOpenmarine", icon: <Rss size={14} /> },
  { value: "xml", labelKey: "methodXml", icon: <Rss size={14} /> },
  { value: "api", labelKey: "methodApi", icon: <Code2 size={14} /> },
  { value: "manual", labelKey: "methodManual", icon: <Package size={14} /> },
] as const;

export function ExportTab({ form, set }: PlatformTabProps) {
  const t = useTranslations("Platforms");

  return (
    <FormSection title={t("tabs.export")}>
      <Field label={t("export.methodLabel")} field="export_method">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPORT_METHODS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("export_method", opt.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                form.export_method === opt.value
                  ? "border-[#003566] bg-blue-50 text-[#003566]"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className={cn("shrink-0", form.export_method === opt.value ? "text-blue-600" : "text-slate-400")}>
                {opt.icon}
              </div>
              <span className="text-sm font-semibold">{t(`export.${opt.labelKey}`)}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("export.feedUrlLabel")} hint={t("export.feedUrlHint")} field="feed_url">
        <Input
          value={form.feed_url}
          onChange={(e) => set("feed_url", e.target.value)}
          placeholder="https://..."
          type="url"
          className="text-sm"
        />
      </Field>
    </FormSection>
  );
}
