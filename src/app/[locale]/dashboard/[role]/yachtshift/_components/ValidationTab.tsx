"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt } from "../_types";
import type { CompatibilityDrillDownYacht, CompatibilityRow, InspectResult, RegressionRun, TestYacht } from "../_types";

const CATEGORY_MAP_PATTERN = /^No category mapping for boat type '([^']+)' on this platform\.$/;
const MISSING_FIELD_PATTERN = /^Required field missing: (.+)$/;

export function ValidationTab({ onNavigateToMapping }: { onNavigateToMapping: () => void }) {
  const t = useTranslations("IntegrationCenter.validation");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const root = `/${locale}/dashboard/${role}`;

  const [testYachts, setTestYachts] = useState<TestYacht[]>([]);
  const [selectedYachtId, setSelectedYachtId] = useState("");
  const [manualYachtId, setManualYachtId] = useState("");
  const [checking, setChecking] = useState(false);
  const [inspect, setInspect] = useState<InspectResult | null>(null);

  const [compat, setCompat] = useState<CompatibilityRow[]>([]);
  const [compatLoading, setCompatLoading] = useState(true);
  const [drillPlatform, setDrillPlatform] = useState<{ id: number; name: string; bucket: string } | null>(null);
  const [drillData, setDrillData] = useState<CompatibilityDrillDownYacht[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const [runs, setRuns] = useState<RegressionRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [runDetail, setRunDetail] = useState<RegressionRun | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ data: TestYacht[] }>("/admin/test-yachts");
        setTestYachts(res.data.data ?? []);
      } catch {
        // Non-critical — manual yacht-id input still works.
      }
    })();
  }, []);

  const loadCompat = useCallback(async () => {
    setCompatLoading(true);
    try {
      const res = await api.get<{ data: CompatibilityRow[] }>("/admin/openmarine/compatibility");
      setCompat(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setCompatLoading(false);
    }
  }, [t]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await api.get<{ data: RegressionRun[] }>("/admin/openmarine/regression/runs");
      setRuns(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setRunsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCompat();
    void loadRuns();
  }, [loadCompat, loadRuns]);

  const handleCheck = async () => {
    const yachtId = selectedYachtId || manualYachtId;
    if (!yachtId) return;
    setChecking(true);
    setInspect(null);
    try {
      const res = await api.get<{ data: InspectResult }>(`/admin/openmarine/mappings/inspect/${yachtId}`);
      setInspect(res.data.data);
    } catch {
      toast.error(t("checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const openDrillDown = async (row: CompatibilityRow, bucket: "supported" | "missing" | "errors") => {
    setDrillPlatform({ id: row.platform_id, name: row.platform_name, bucket });
    setDrillLoading(true);
    try {
      const res = await api.get<{ data: CompatibilityDrillDownYacht[] }>(`/admin/openmarine/compatibility/${row.platform_id}`, {
        params: { bucket },
      });
      setDrillData(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setDrillLoading(false);
    }
  };

  const runRegression = async () => {
    setRunning(true);
    try {
      await api.post("/admin/openmarine/regression/run");
      void loadRuns();
    } catch {
      toast.error(t("runFailed"));
    } finally {
      setRunning(false);
    }
  };

  const toggleRun = async (run: RegressionRun) => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      setRunDetail(null);
      return;
    }
    setExpandedRunId(run.id);
    try {
      const res = await api.get<RegressionRun>(`/admin/openmarine/regression/runs/${run.id}`);
      setRunDetail(res.data);
    } catch {
      toast.error(t("loadFailed"));
    }
  };

  // ── Troubleshooting: derived from whatever's already loaded above ──
  const troubleshootItems: { key: string; label: string; action: string; onAction: () => void }[] = [];

  if (inspect) {
    for (const err of inspect.errors) {
      const m = err.match(MISSING_FIELD_PATTERN);
      if (m) {
        troubleshootItems.push({
          key: `field-${m[1]}`,
          label: t("fixMissingField", { value: m[1] }),
          action: t("fixMissingFieldAction"),
          onAction: onNavigateToMapping,
        });
      }
    }
  }

  if (drillPlatform && drillData.length > 0) {
    const seen = new Set<string>();
    for (const y of drillData) {
      for (const reason of y.reasons) {
        const m = reason.match(CATEGORY_MAP_PATTERN);
        if (m && !seen.has(m[1])) {
          seen.add(m[1]);
          troubleshootItems.push({
            key: `category-${m[1]}`,
            label: t("fixCategoryMap", { value: m[1], platform: drillPlatform.name }),
            action: t("fixCategoryMapAction"),
            onAction: () => window.open(`${root}/platforms/${drillPlatform.id}?tab=openmarine`, "_blank"),
          });
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Validation engine ─────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <ShieldCheck size={13} /> {t("engineTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYachtId}
            onChange={(e) => {
              setSelectedYachtId(e.target.value);
              if (e.target.value) setManualYachtId("");
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">{t("selectTestYacht")}</option>
            {testYachts.map((y) => (
              <option key={y.id} value={y.id}>
                #{y.id} {y.boat_name ?? y.model ?? y.boat_type ?? ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{t("orYachtId")}</span>
          <input
            type="number"
            value={manualYachtId}
            onChange={(e) => {
              setManualYachtId(e.target.value);
              if (e.target.value) setSelectedYachtId("");
            }}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <Button
            size="sm"
            disabled={checking || (!selectedYachtId && !manualYachtId)}
            onClick={() => void handleCheck()}
            className="gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]"
          >
            {checking ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            {checking ? t("checking") : t("check")}
          </Button>
        </div>

        {inspect && (
          <div className="mt-4 space-y-3">
            {inspect.errors.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 size={14} /> {t("noErrors")}
              </p>
            ) : (
              <div>
                <p className="text-[11px] font-black uppercase text-red-500">{t("errorsTitle")}</p>
                <ul className="mt-1 space-y-1">
                  {inspect.errors.map((e) => (
                    <li key={e} className="flex items-start gap-1.5 text-sm text-red-600">
                      <XCircle size={14} className="mt-0.5 shrink-0" /> {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inspect.warnings.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase text-amber-500">{t("warningsTitle")}</p>
                <ul className="mt-1 space-y-1">
                  {inspect.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-1.5 text-sm text-amber-600">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400">{t("fieldsTitle")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {inspect.fields.map((f) => (
                  <span
                    key={f.schepenkring_field || f.openmarine_xml_path}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      f.populated
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : f.is_required
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    )}
                    title={f.populated ? t("populated") : t("missingField")}
                  >
                    {f.schepenkring_field || f.openmarine_xml_path}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Platform compatibility ─────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("compatibilityTitle")}</p>
        {compatLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-1.5 pr-3">{t("platform")}</th>
                  <th className="py-1.5 pr-3">{t("supported")}</th>
                  <th className="py-1.5 pr-3">{t("missingCol")}</th>
                  <th className="py-1.5 pr-3">{t("errorsCol")}</th>
                </tr>
              </thead>
              <tbody>
                {compat.map((row) => (
                  <tr key={row.platform_id} className="border-t border-slate-50 dark:border-slate-800/60">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700 dark:text-slate-200">{row.platform_name}</td>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => void openDrillDown(row, "supported")} className="text-emerald-600 hover:underline">
                        {row.supported}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => void openDrillDown(row, "missing")} className="text-amber-600 hover:underline">
                        {row.missing}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => void openDrillDown(row, "errors")} className="text-red-600 hover:underline">
                        {row.errors}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {drillPlatform && (
          <div className="mt-4 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("drillTitle")}: {drillPlatform.name} — {drillPlatform.bucket}
            </p>
            {drillLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
              </div>
            ) : drillData.length === 0 ? (
              <p className="text-xs text-slate-400">{t("noYachts")}</p>
            ) : (
              <div className="space-y-1.5">
                {drillData.map((y) => (
                  <div key={y.yacht_id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{y.boat_name ?? `#${y.yacht_id}`}</span>
                    {y.reasons.length > 0 && <span className="text-slate-400"> — {y.reasons.join(" · ")}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Regression testing ────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t("regressionTitle")}</p>
          <Button size="sm" disabled={running} onClick={() => void runRegression()} className="gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]">
            {running ? <Loader2 size={13} className="animate-spin" /> : null}
            {running ? t("running") : t("runButton")}
          </Button>
        </div>
        {runsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : runs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("runsEmpty")}</p>
        ) : (
          <div className="space-y-1.5">
            {runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(run.created_at)}</span>{" "}
                    <span className="text-slate-400">
                      · {t("totalYachts")}: {run.total_yachts} · <span className="text-emerald-600">{t("passed")}: {run.passed_count}</span> ·{" "}
                      <span className="text-red-600">{t("failed")}: {run.failed_count}</span>
                    </span>
                  </div>
                  {run.failed_count > 0 && (
                    <Button size="sm" variant="outline" onClick={() => void toggleRun(run)} className="gap-1 rounded-lg text-xs">
                      {expandedRunId === run.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expandedRunId === run.id ? t("hideFailures") : t("viewFailures")}
                    </Button>
                  )}
                </div>
                {expandedRunId === run.id && (
                  <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                    {runDetail?.id === run.id && runDetail.results ? (
                      <div className="space-y-1">
                        {runDetail.results.filter((r) => !r.passed).map((r) => (
                          <div key={r.yacht_id} className="text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{r.yacht?.boat_name ?? `#${r.yacht_id}`}</span>
                            <span className="text-red-600"> — {r.errors.join(" · ")}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── One-click troubleshooting ──────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <Wrench size={13} /> {t("troubleshootingTitle")}
        </p>
        <p className="mb-3 text-xs text-slate-400">{t("troubleshootingBody")}</p>
        {troubleshootItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t("troubleshootingEmpty")}</p>
        ) : (
          <div className="space-y-1.5">
            {troubleshootItems.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 dark:border-blue-900/30 dark:bg-blue-950/20">
                <span className="text-xs text-slate-700 dark:text-slate-200">{item.label}</span>
                <Button size="sm" onClick={item.onAction} className="rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]">
                  {item.action}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
