"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, ShieldAlert, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocaleOrDefault } from "@/lib/i18n";
import { translateAuditEventLabel, translateAuditStatus } from "@/lib/audit-i18n";
import { getMyAuditLog, type MyAuditLogEntry } from "@/lib/api/account";

type RangeFilter = "today" | "7d" | "30d" | null;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function AccountAuditTab() {
  const t = useTranslations("DashboardAccount.audit");
  const locale = getLocaleOrDefault(useLocale());

  const [entries, setEntries] = useState<MyAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [range, setRange] = useState<RangeFilter>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const dateFrom = useMemo(() => {
    if (range === "today") return startOfTodayIso();
    if (range === "7d") return daysAgoIso(7);
    if (range === "30d") return daysAgoIso(30);
    return undefined;
  }, [range]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setErrored(false);
      try {
        const res = await getMyAuditLog({ date_from: dateFrom, errors_only: errorsOnly || undefined, per_page: 100 });
        if (active) setEntries(res.data ?? []);
      } catch {
        if (active) setErrored(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [dateFrom, errorsOnly]);

  const rangeOptions: Array<{ id: RangeFilter; label: string }> = [
    { id: null, label: t("filters.all") },
    { id: "today", label: t("filters.today") },
    { id: "7d", label: t("filters.last7") },
    { id: "30d", label: t("filters.last30") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {rangeOptions.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => setRange(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              range === opt.id
                ? "border-[#003566] bg-[#003566] text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setErrorsOnly((prev) => !prev)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
            errorsOnly
              ? "border-red-500 bg-red-500 text-white"
              : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
          )}
        >
          <ShieldAlert size={12} />
          {t("filters.errorsOnly")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : errored ? (
        <p className="text-sm text-rose-600">{t("loadFailed")}</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <History size={28} className="opacity-40" />
          <p className="text-sm">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 text-left">{t("columns.time")}</th>
                <th className="px-4 py-3 text-left">{t("columns.action")}</th>
                <th className="px-4 py-3 text-left">{t("columns.endpoint")}</th>
                <th className="px-4 py-3 text-left">{t("columns.status")}</th>
                <th className="px-4 py-3 text-left">{t("columns.ip")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry) => {
                const status = translateAuditStatus(entry.result, locale);
                const statusTone =
                  status.tone === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : status.tone === "fail"
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-500 dark:text-slate-400";

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(entry.created_at).toLocaleString(locale, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {translateAuditEventLabel(entry.action, locale)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {entry.method && (
                        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {entry.method}
                        </span>
                      )}
                      {entry.endpoint || "—"}
                    </td>
                    <td className={cn("px-4 py-3 text-xs font-semibold", statusTone)}>{status.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{entry.ip_address || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
