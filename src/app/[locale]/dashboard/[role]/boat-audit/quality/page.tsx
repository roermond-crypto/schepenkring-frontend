"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, Sparkles, TrendingUp, Bot, UserCheck, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getLocaleOrDefault } from "@/lib/i18n";
import { translateChangedField } from "@/lib/audit-i18n";

interface PlatformOption {
  id: number;
  name: string;
}

interface FieldStat {
  field_name: string;
  corrections?: number;
  avg_confidence?: number;
  samples?: number;
}

interface PlatformBreakdownRow {
  platform_id: number | null;
  platform_name: string | null;
  corrections: number;
}

interface AiQualitySummary {
  avg_confidence_before: number | null;
  avg_confidence_after: number | null;
  avg_confidence_improvement: number | null;
  ai_authored_count: number;
  manual_corrections_count: number;
  most_corrected_fields: FieldStat[];
  lowest_confidence_fields: FieldStat[];
  platform_breakdown: PlatformBreakdownRow[] | null;
}

const BRAND = "#003566";

function confidenceColor(pct: number): string {
  if (pct < 60) return "#dc2626";
  if (pct < 80) return "#d97706";
  return "#059669";
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Sparkles; tone?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone ?? "bg-blue-50 text-blue-600")}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function AiQualityDashboardPage() {
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const locale = getLocaleOrDefault(useLocale());
  const role = params?.role ?? "admin";
  const t = useTranslations("AiQualityDashboard");
  const root = `/${locale}/dashboard/${role}`;

  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [platformId, setPlatformId] = useState("");
  const [summary, setSummary] = useState<AiQualitySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PlatformOption[] | { data: PlatformOption[] }>("/admin/platforms").then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setPlatforms(data);
    }).catch(() => {});
  }, []);

  const loadSummary = async (pid: string) => {
    setLoading(true);
    try {
      const query = pid ? `?platform_id=${pid}` : "";
      const res = await api.get<AiQualitySummary>(`/admin/ai-quality/summary${query}`);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary(platformId);
  }, [platformId]);

  const goToFeedback = (extra: Record<string, string>) => {
    const url = new URL(`${root}/boat-audit`, window.location.origin);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    router.push(url.pathname + url.search);
  };

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const pctDelta = (v: number | null) => {
    if (v === null) return "—";
    const rounded = Math.round(v * 100);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  };

  const mostCorrectedData = (summary?.most_corrected_fields ?? []).map((f) => ({
    name: translateChangedField(f.field_name, locale),
    corrections: f.corrections ?? 0,
  }));

  const lowestConfidenceData = (summary?.lowest_confidence_fields ?? []).map((f) => ({
    name: translateChangedField(f.field_name, locale),
    confidence: Math.round((f.avg_confidence ?? 0) * 100),
  }));

  return (
    <div className="flex-1 space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-600" />
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
          >
            <option value="">{t("allPlatforms")}</option>
            <option value="0">{t("general")}</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => router.push(`${root}/boat-audit`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("backToAudit")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-red-600">{t("loadFailed")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label={t("kpi.avgConfidenceBefore")} value={pct(summary.avg_confidence_before)} icon={Bot} tone="bg-violet-50 text-violet-600" />
            <KpiCard label={t("kpi.avgConfidenceAfter")} value={pct(summary.avg_confidence_after)} icon={UserCheck} tone="bg-emerald-50 text-emerald-600" />
            <KpiCard label={t("kpi.avgImprovement")} value={pctDelta(summary.avg_confidence_improvement)} icon={TrendingUp} />
            <KpiCard label={t("kpi.manualCorrections")} value={String(summary.manual_corrections_count)} icon={Sparkles} tone="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black text-[#003566] uppercase tracking-[0.2em]">{t("charts.mostCorrected")}</h3>
                <button
                  type="button"
                  onClick={() => goToFeedback(platformId ? { platform_id: platformId } : {})}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {t("viewInAudit")}
                </button>
              </div>
              {mostCorrectedData.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-8 text-center">{t("noData")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mostCorrectedData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Bar dataKey="corrections" fill={BRAND} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="corrections" position="right" style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black text-[#003566] uppercase tracking-[0.2em]">{t("charts.lowestConfidence")}</h3>
                <button
                  type="button"
                  onClick={() => goToFeedback(platformId ? { platform_id: platformId } : {})}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {t("viewInAudit")}
                </button>
              </div>
              {lowestConfidenceData.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-8 text-center">{t("noData")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={lowestConfidenceData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(value?: number) => [`${value ?? 0}%`, t("charts.confidence")]}
                    />
                    <Bar dataKey="confidence" radius={[0, 4, 4, 0]} barSize={16}>
                      {lowestConfidenceData.map((entry, i) => (
                        <Cell key={i} fill={confidenceColor(entry.confidence)} />
                      ))}
                      <LabelList
                        dataKey="confidence"
                        position="right"
                        formatter={(v?: React.ReactNode) => `${v ?? 0}%`}
                        style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {summary.platform_breakdown && summary.platform_breakdown.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-[11px] font-black text-[#003566] uppercase tracking-[0.2em] mb-4">{t("charts.byPlatform")}</h3>
              <div className="space-y-2">
                {summary.platform_breakdown.map((row) => (
                  <button
                    key={row.platform_id ?? "general"}
                    type="button"
                    onClick={() => setPlatformId(row.platform_id === null ? "0" : String(row.platform_id))}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-blue-200 hover:bg-blue-50/50 transition-colors"
                  >
                    <span className="font-medium text-slate-700">{row.platform_name ?? t("general")}</span>
                    <span className="font-bold text-slate-500">{row.corrections}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
