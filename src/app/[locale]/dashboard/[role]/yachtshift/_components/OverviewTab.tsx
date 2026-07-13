"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Clock, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { fmt, type ExportStatistics, type SyncStatus } from "../_types";

export function OverviewTab({ status, onSynced }: { status: SyncStatus | null; onSynced: () => void }) {
  const t = useTranslations("IntegrationCenter.overview");
  const [direction, setDirection] = useState<"import" | "export" | "both">("both");
  const [dryRun, setDryRun] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<unknown>(null);

  const [stats, setStats] = useState<ExportStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setStatsLoading(true);
      try {
        const res = await api.get<ExportStatistics>("/admin/openmarine/export-statistics");
        setStats(res.data);
      } catch {
        toast.error(t("widgetsLoadFailed"));
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [t]);

  const handleTrigger = async () => {
    setTriggering(true);
    setLastResult(null);
    try {
      const res = await api.post("/admin/yachtshift/sync", { direction, dry_run: dryRun });
      setLastResult(res.data);
      toast.success(dryRun ? t("syncSuccessDry") : t("syncSuccess"));
      onSynced();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("syncFailed");
      toast.error(msg);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("widgetsTitle")}</p>
        {statsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : !stats || stats.platforms.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t("widgetsEmpty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.platforms.map((p) => (
              <div key={p.platform_id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.platform_name}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{t("lastExport")}</span>
                  <span className="text-right tabular-nums">{fmt(p.last_successful_export)}</span>
                  <span>{t("successRate")}</span>
                  <span className="text-right tabular-nums">{p.success_rate_30d !== null ? `${p.success_rate_30d}%` : "—"}</span>
                  <span>{t("waitingExports")}</span>
                  <span className="text-right tabular-nums">{p.waiting_exports}</span>
                  <span>{t("failedExportsShort")}</span>
                  <span className={cn("text-right tabular-nums", p.failed_exports > 0 && "font-bold text-red-600")}>{p.failed_exports}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {stats && stats.overview.not_tracked.length > 0 && (
          <p className="mt-3 text-[10px] text-slate-400">
            {stats.overview.not_tracked.join(", ")} — {t("notTracked")}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("totalYachts"), value: status?.total_yachts ?? 0 },
          { label: t("synced"), value: status?.synced_to_yachtshift ?? 0 },
          { label: t("pendingExport"), value: status?.pending_export ?? 0 },
          { label: t("failedExports"), value: status?.failed_exports ?? 0, danger: (status?.failed_exports ?? 0) > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={cn("mt-2 text-3xl font-bold", s.danger ? "text-red-600" : "text-[#003566] dark:text-slate-100")}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Clock size={13} className="mr-1.5 inline" />
        {t("lastSync")}: <strong>{fmt(status?.last_sync_at)}</strong>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("manualSyncTitle")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
            {([
              { id: "import", label: t("directionImport"), icon: ArrowDownToLine },
              { id: "both", label: t("directionBoth"), icon: ArrowLeftRight },
              { id: "export", label: t("directionExport"), icon: ArrowUpFromLine },
            ] as const).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirection(d.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                  direction === d.id ? "bg-[#003566] text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                <d.icon size={13} /> {d.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            {t("dryRun")}
          </label>

          <Button
            type="button"
            onClick={() => void handleTrigger()}
            disabled={triggering}
            className="ml-auto gap-2 rounded-lg bg-[#003566] text-white hover:bg-[#00284f]"
          >
            {triggering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t("syncButton")}
          </Button>
        </div>

        {lastResult !== null && lastResult !== undefined ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
