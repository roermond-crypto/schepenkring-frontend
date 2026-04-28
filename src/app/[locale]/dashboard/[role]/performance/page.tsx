"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "@/shims/next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BarChart3,
  Globe,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";

type PerformanceRow = {
  id?: number;
  location_id?: number;
  name?: string;
  code?: string;
  status?: string;
  location_name?: string;
  country?: string;
  metrics?: {
    clients_total?: number;
    staff_total?: number;
    boats_total?: number;
    yachts_total?: number;
    open_leads?: number;
    open_conversations?: number;
    open_tasks?: number;
    leads_created?: number;
    conversations_created?: number;
    tasks_created?: number;
    tasks_completed?: number;
    active_users?: number;
    sessions?: number;
  };
  location?: { name?: string; code?: string | null };
  users?: number;
  impressions?: number;
  button_impressions?: number;
  clicks?: number;
  button_clicks?: number;
  ctr?: number;
  boat_form_started?: number;
  boat_submitted?: number;
  deal_completed?: number;
  commission?: number;
  revenue?: number;
  ranking_by_commission?: number;
  rank?: number;
  benchmark?: { avg_ctr?: number };
  benchmarks?: { avg_ctr?: number };
  ranking?: { commission?: number };
  ga4?: {
    users?: number;
    funnel?: {
      location_button_impression?: number;
      location_button_click?: number;
      ctr?: number;
      boat_form_started?: number;
      boat_submitted?: number;
      deal_completed?: number;
    };
  };
  [key: string]: unknown;
};

type LocationOption = {
  id: number;
  name: string;
  code?: string | null;
};

type Filters = {
  range: "7d" | "30d" | "90d";
  location_id: string;
  country: string;
  device: string;
  source_medium: string;
};

type Totals = {
  activeUsers: number;
  leadsCreated: number;
  conversationsCreated: number;
  tasksCompleted: number;
  sessions: number;
};

function numberValue(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function percent(value: unknown) {
  return `${numberValue(value).toFixed(1)}%`;
}

function rowName(row: PerformanceRow) {
  return (
    row?.location?.name ||
    row?.location_name ||
    row?.name ||
    `Location #${row?.location_id ?? row?.id ?? "—"}`
  );
}

export default function AdminPerformancePage() {
  const t = useTranslations("DashboardAdminLocationPerformance");
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [summary, setSummary] = useState<Totals>({
    activeUsers: 0,
    leadsCreated: 0,
    conversationsCreated: 0,
    tasksCompleted: 0,
    sessions: 0,
  });
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadStateErrorText = t("states.error");
  const hasLoadedOnce = useRef(false);
  const latestRequestRef = useRef(0);
  const [filters, setFilters] = useState<Filters>({
    range: "30d",
    location_id: "",
    country: "",
    device: "",
    source_medium: "",
  });

  const loadLocations = async () => {
    try {
      const res = await api.get("/public/locations");
      const list = (
        Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : []
      ) as LocationOption[];
      setLocations(list);
    } catch {
      setLocations([]);
    }
  };

  const loadData = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    if (!hasLoadedOnce.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const params: Record<string, string> = {
        range: filters.range,
      };
      if (filters.location_id) params.location_id = filters.location_id;
      if (filters.country) params.country = filters.country;
      if (filters.device) params.device = filters.device;
      if (filters.source_medium) params.source_medium = filters.source_medium;

      const res = await api.get("/admin/locations/performance", { params });
      const payload = (res.data ?? {}) as { data?: PerformanceRow[] };
      const list = Array.isArray(payload?.data) ? payload.data : [];
      if (requestId !== latestRequestRef.current) return;

      setRows(
        filters.location_id
          ? list.filter((row) => String(row.id ?? "") === filters.location_id)
          : list,
      );

      const computedSummary = list.reduce<Totals>(
        (acc, row) => {
          acc.activeUsers += numberValue(row?.metrics?.active_users);
          acc.leadsCreated += numberValue(row?.metrics?.leads_created);
          acc.conversationsCreated += numberValue(
            row?.metrics?.conversations_created,
          );
          acc.tasksCompleted += numberValue(row?.metrics?.tasks_completed);
          acc.sessions += numberValue(row?.metrics?.sessions);
          return acc;
        },
        {
          activeUsers: 0,
          leadsCreated: 0,
          conversationsCreated: 0,
          tasksCompleted: 0,
          sessions: 0,
        },
      );

      setSummary(
        computedSummary,
      );
    } catch {
      if (requestId !== latestRequestRef.current) return;
      setError(loadStateErrorText);
      setRows([]);
      setSummary({
        activeUsers: 0,
        leadsCreated: 0,
        conversationsCreated: 0,
        tasksCompleted: 0,
        sessions: 0,
      });
    } finally {
      if (requestId !== latestRequestRef.current) return;
      setLoading(false);
      setRefreshing(false);
      hasLoadedOnce.current = true;
    }
  }, [
    filters.range,
    filters.location_id,
    filters.country,
    filters.device,
    filters.source_medium,
    loadStateErrorText,
  ]);

  useEffect(() => {
    void loadLocations();
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo<Totals>(() => {
    const fromSummary = {
      activeUsers: summary.activeUsers,
      leadsCreated: summary.leadsCreated,
      conversationsCreated: summary.conversationsCreated,
      tasksCompleted: summary.tasksCompleted,
      sessions: summary.sessions,
    };

    if (
      Object.values(fromSummary).some(
        (value) => value !== undefined && value !== null,
      )
    ) {
      return {
        activeUsers: numberValue(fromSummary.activeUsers),
        leadsCreated: numberValue(fromSummary.leadsCreated),
        conversationsCreated: numberValue(fromSummary.conversationsCreated),
        tasksCompleted: numberValue(fromSummary.tasksCompleted),
        sessions: numberValue(fromSummary.sessions),
      };
    }

    return rows.reduce<Totals>(
      (acc, row) => {
        acc.activeUsers += numberValue(row?.metrics?.active_users);
        acc.leadsCreated += numberValue(row?.metrics?.leads_created);
        acc.conversationsCreated += numberValue(
          row?.metrics?.conversations_created,
        );
        acc.tasksCompleted += numberValue(row?.metrics?.tasks_completed);
        acc.sessions += numberValue(row?.metrics?.sessions);
        return acc;
      },
      {
        activeUsers: 0,
        leadsCreated: 0,
        conversationsCreated: 0,
        tasksCompleted: 0,
        sessions: 0,
      },
    );
  }, [rows, summary]);

  const countryOptions = useMemo(
    () => [
      { value: "", label: t("filters.allCountries") },
      { value: "NL", label: t("filters.countries.nl") },
      { value: "DE", label: t("filters.countries.de") },
      { value: "BE", label: t("filters.countries.be") },
    ],
    [t],
  );

  const deviceOptions = useMemo(
    () => [
      { value: "", label: t("filters.allDevices") },
      { value: "mobile", label: t("filters.devices.mobile") },
      { value: "desktop", label: t("filters.devices.desktop") },
      { value: "tablet", label: t("filters.devices.tablet") },
    ],
    [t],
  );

  const sourceMediumOptions = useMemo(
    () => [
      { value: "", label: t("filters.allSources") },
      { value: "google / organic", label: t("filters.sources.googleOrganic") },
      { value: "google / cpc", label: t("filters.sources.googleAds") },
      { value: "facebook / paid", label: t("filters.sources.facebookPaid") },
      { value: "instagram / paid", label: t("filters.sources.instagramPaid") },
      { value: "direct / none", label: t("filters.sources.direct") },
    ],
    [t],
  );

  return (
    <div className="copied-admin-theme space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#EAF3FF] px-6 py-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-blue-600">
              {t("hero.kicker")}
            </p>
            <h1 className="mt-3 text-4xl font-serif italic text-[#003566] sm:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">
              {t("hero.description")}
            </p>
          </div>
          <Button
            type="button"
            onClick={loadData}
            disabled={loading || refreshing}
            className="h-12 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
          >
            {loading || refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("actions.refresh")}
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.users")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {totals.activeUsers.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.impressions")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {totals.leadsCreated.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.clicks")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {totals.conversationsCreated.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.deals")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {totals.tasksCompleted.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.commission")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {totals.sessions.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={filters.range}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                range: event.target.value as Filters["range"],
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
          >
            <option value="7d">{t("filters.range.7d")}</option>
            <option value="30d">{t("filters.range.30d")}</option>
            <option value="90d">{t("filters.range.90d")}</option>
          </select>
          <select
            value={filters.location_id}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                location_id: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
          >
            <option value="">{t("filters.allLocations")}</option>
            {locations.map((location) => (
              <option key={location.id} value={String(location.id)}>
                {location.name}
              </option>
            ))}
          </select>
          <select
            value={filters.country}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
          >
            {countryOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.device}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                device: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
          >
            {deviceOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.source_medium}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                source_medium: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
          >
            {sourceMediumOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#003566]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4">{t("table.location")}</th>
                  <th className="px-5 py-4">{t("table.activeUsers")}</th>
                  <th className="px-5 py-4">{t("table.leadsCreated")}</th>
                  <th className="px-5 py-4">{t("table.openConversations")}</th>
                  <th className="px-5 py-4">CTR</th>
                  <th className="px-5 py-4">{t("table.openLeads")}</th>
                  <th className="px-5 py-4">{t("table.tasksCreated")}</th>
                  <th className="px-5 py-4">{t("table.tasksCompleted")}</th>
                  <th className="px-5 py-4">{t("table.commission")}</th>
                  <th className="px-5 py-4">{t("table.benchmark")}</th>
                  <th className="px-5 py-4">{t("table.rank")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const users = numberValue(row?.metrics?.active_users);
                  const impressions = numberValue(row?.metrics?.leads_created);
                  const clicks = numberValue(
                    row?.metrics?.conversations_created,
                  );
                  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                  const forms = numberValue(row?.metrics?.open_leads);
                  const submitted = numberValue(
                    row?.metrics?.tasks_created,
                  );
                  const deals = numberValue(row?.metrics?.tasks_completed);
                  const commission = numberValue(row?.metrics?.sessions);
                  const avgCtr = 0;
                  const rank = index + 1;

                  return (
                    <tr
                      key={String(row?.location_id ?? row?.id ?? index)}
                      className="border-b border-slate-100 text-sm text-slate-600 last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[#003566]">
                            <Globe size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-[#0B1F3A]">
                              {rowName(row)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {row?.location?.code ||
                                row?.code ||
                                row?.country ||
                                "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">{users.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        {impressions.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">{clicks.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          {percent(ctr)}
                        </span>
                      </td>
                      <td className="px-5 py-4">{forms.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        {submitted.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">{deals.toLocaleString()}</td>
                      <td className="px-5 py-4 font-semibold text-[#0B1F3A]">
                        {commission.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {t("table.avgCtr", { value: percent(avgCtr) })}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          <Trophy size={12} />#{rank}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      {t("states.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2">
            <Users size={14} />
            {t("panels.reach.title")}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {t("panels.reach.description")}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2">
            <MousePointerClick size={14} />
            {t("panels.funnel.title")}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {t("panels.funnel.description")}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2">
            <BarChart3 size={14} />
            {t("panels.revenue.title")}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {t("panels.revenue.description")}
          </p>
        </div>
      </div>
    </div>
  );
}
