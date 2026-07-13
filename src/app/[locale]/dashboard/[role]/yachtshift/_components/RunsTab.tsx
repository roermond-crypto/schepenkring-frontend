"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { translateAuditEventLabel } from "@/lib/audit-i18n";
import { getLocaleOrDefault } from "@/lib/i18n";
import { useLocale } from "next-intl";
import { fmt, type Paginated, type SyncRun } from "../_types";

export function RunsTab() {
  const t = useTranslations("IntegrationCenter.runs");
  const locale = getLocaleOrDefault(useLocale());
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<SyncRun>>("/admin/yachtshift/runs");
      setRuns(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : runs.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{t("empty")}</p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((r) => {
            const failed = r.result?.toLowerCase() === "fail";
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 text-sm last:border-0 dark:border-slate-800">
                {failed ? (
                  <XCircle size={14} className="shrink-0 text-red-500" />
                ) : (
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                )}
                <span className="w-40 shrink-0 text-xs tabular-nums text-slate-400">{fmt(r.created_at)}</span>
                <span className="text-slate-700 dark:text-slate-200">{translateAuditEventLabel(r.action, locale)}</span>
                {r.meta && typeof r.meta === "object" && "summary" in r.meta && (
                  <span className="truncate text-xs text-slate-400">
                    {JSON.stringify((r.meta as Record<string, unknown>).summary)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
