"use client";

import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getIntegrationTooltip, type IntegrationFieldKey } from "@/lib/integration-center-tooltips-i18n";
import { getLocaleOrDefault } from "@/lib/i18n";

export function IntegrationTooltip({ field }: { field: IntegrationFieldKey }) {
  const locale = getLocaleOrDefault(useLocale());
  const t = useTranslations("IntegrationCenter.tooltip");
  const copy = getIntegrationTooltip(field, locale);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-blue-600"
          aria-label={t("ariaLabel")}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="space-y-2.5 text-left">
        <p className="text-[13px] leading-5 text-slate-700">{copy.explanation}</p>
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("example")}</p>
          <p className="text-[12px] font-mono text-slate-600">{copy.example}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{t("commonMistakes")}</p>
          <p className="text-[12px] leading-5 text-slate-600">{copy.commonMistakes}</p>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <span
            className={
              copy.required
                ? "text-[10px] font-bold uppercase tracking-wide text-red-600"
                : "text-[10px] font-bold uppercase tracking-wide text-slate-400"
            }
          >
            {copy.required ? t("required") : t("optional")}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
