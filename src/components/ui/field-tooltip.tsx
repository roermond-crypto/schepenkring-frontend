"use client";

import { Info, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPlatformFieldTooltip, type PlatformFieldKey } from "@/lib/platform-tooltips-i18n";
import { getLocaleOrDefault } from "@/lib/i18n";

export function FieldTooltip({ field }: { field: PlatformFieldKey }) {
  const locale = getLocaleOrDefault(useLocale());
  const t = useTranslations("Platforms.tooltip");
  const copy = getPlatformFieldTooltip(field, locale);

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
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span
            className={
              copy.required
                ? "text-[10px] font-bold uppercase tracking-wide text-red-600"
                : "text-[10px] font-bold uppercase tracking-wide text-slate-400"
            }
          >
            {copy.required ? t("required") : t("optional")}
          </span>
          {copy.docLink && (
            <a
              href={copy.docLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
            >
              {t("docs")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
