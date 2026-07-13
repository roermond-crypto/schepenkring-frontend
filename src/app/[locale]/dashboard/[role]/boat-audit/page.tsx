"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  ShieldCheck,
  Search,
  Bot,
  User,
  Database,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  History,
  Activity,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getLocaleOrDefault } from "@/lib/i18n";
import { translateChangedField } from "@/lib/audit-i18n";

interface BoatFieldChange {
  id: number;
  yacht_id: number;
  platform_id: number | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_type: "ai" | "user" | "admin" | "import" | "scraper";
  changed_by_id: number | null;
  source_type: string | null;
  confidence_before: number | null;
  confidence_after: number | null;
  ai_session_id: string | null;
  model_name: string | null;
  reason: string | null;
  correction_label: string | null;
  created_at: string;
  yacht?: { id: number; boat_name: string | null };
  user?: { id: number; name: string; email: string };
  platform?: { id: number; name: string };
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

interface PlatformOption {
  id: number;
  name: string;
}

function parseValue(val: string | null, emptyLabel: string): string {
  if (val === null || val === "null") return emptyLabel;
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === "boolean") return parsed ? "✓" : "✕";
    return String(parsed);
  } catch {
    return val;
  }
}

const ACTOR_ICON: Record<string, typeof Bot> = {
  ai: Bot,
  user: User,
  admin: User,
  import: Database,
  scraper: Database,
};

const ACTOR_TONE: Record<string, string> = {
  ai: "bg-violet-100 text-violet-700",
  admin: "bg-blue-100 text-blue-700",
  user: "bg-blue-100 text-blue-700",
  import: "bg-amber-100 text-amber-700",
  scraper: "bg-amber-100 text-amber-700",
};

export default function BoatAuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ role?: string }>();
  const locale = getLocaleOrDefault(useLocale());
  const role = params?.role ?? "admin";
  const t = useTranslations("AiCorrectionAudit");
  const root = `/${locale}/dashboard/${role}`;

  const [logs, setLogs] = useState<BoatFieldChange[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);

  const [searchYacht, setSearchYacht] = useState("");
  const [searchField, setSearchField] = useState(searchParams?.get("field_name") ?? "");
  const [filterActor, setFilterActor] = useState(searchParams?.get("changed_by_type") ?? "");
  const [filterLabel, setFilterLabel] = useState(searchParams?.get("correction_label") ?? "");
  const [filterPlatform, setFilterPlatform] = useState(searchParams?.get("platform_id") ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<PlatformOption[] | { data: PlatformOption[] }>("/admin/platforms").then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setPlatforms(data);
    }).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ page: page.toString(), per_page: "25" });
      if (searchField) query.append("field_name", searchField);
      if (filterActor) query.append("changed_by_type", filterActor);
      if (filterLabel) query.append("correction_label", filterLabel);
      if (filterPlatform) query.append("platform_id", filterPlatform);

      const response = await api.get(`/admin/boat-audit?${query.toString()}`);
      if (response.data) {
        setLogs(response.data.data || []);
        setMeta({
          current_page: response.data.current_page,
          last_page: response.data.last_page,
          per_page: response.data.per_page,
          total: response.data.total,
          from: response.data.from,
          to: response.data.to,
        });
      }
    } catch {
      // Non-critical — page stays on its previous (or empty) state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchField, filterActor, filterLabel, filterPlatform]);

  const filteredLogs = useMemo(() => {
    if (!searchYacht) return logs;
    const lowerQ = searchYacht.toLowerCase();
    return logs.filter((log) => {
      const name = log.yacht?.boat_name || `Yacht #${log.yacht_id}`;
      return name.toLowerCase().includes(lowerQ);
    });
  }, [logs, searchYacht]);

  const correctorName = (log: BoatFieldChange): string => {
    if (log.user) return log.user.name;
    return t(`actorType.${log.changed_by_type}`);
  };

  return (
    <div className="flex-1 space-y-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`${root}/boat-audit/quality`)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <BarChart3 className="h-4 w-4" />
            {t("qualityDashboardLink")}
          </button>
          <button
            type="button"
            onClick={() => router.push(`${root}/yachts`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("backToYachts")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder={t("searchYachtPlaceholder")}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            value={searchYacht}
            onChange={(e) => setSearchYacht(e.target.value)}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder={t("searchFieldPlaceholder")}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
          />
        </div>
        <select
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
        >
          <option value="">{t("allActors")}</option>
          <option value="ai">{t("actorType.ai")}</option>
          <option value="admin">{t("actorType.admin")}</option>
          <option value="user">{t("actorType.user")}</option>
          <option value="import">{t("actorType.import")}</option>
          <option value="scraper">{t("actorType.scraper")}</option>
        </select>
        <select
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterLabel}
          onChange={(e) => setFilterLabel(e.target.value)}
        >
          <option value="">{t("allFeedback")}</option>
          <option value="wrong_image_detection">{t("labels.wrongImageDetection")}</option>
          <option value="wrong_text_interpretation">{t("labels.wrongTextInterpretation")}</option>
          <option value="guessed_too_much">{t("labels.guessedTooMuch")}</option>
          <option value="duplicate_data_issue">{t("labels.duplicateDataIssue")}</option>
          <option value="import_mismatch">{t("labels.importMismatch")}</option>
          <option value="other">{t("labels.other")}</option>
        </select>
        <select
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="">{t("allPlatforms")}</option>
          <option value="0">{t("general")}</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <History size={24} className="text-slate-300" />
              </motion.div>
              <p className="text-sm">{t("loading")}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2 bg-white rounded-xl border border-slate-200">
              <ShieldCheck size={32} className="text-slate-300" />
              <p>{t("emptyState")}</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const ActorIcon = ACTOR_ICON[log.changed_by_type] ?? Activity;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <a
                        href={`${root}/yachts/${log.yacht_id}`}
                        className="font-bold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {log.yacht?.boat_name || `Yacht #${log.yacht_id}`}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t("field")}</span>
                        <span className="text-xs font-mono font-semibold text-slate-600">{translateChangedField(log.field_name, locale)}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                          {log.platform?.name ?? t("general")}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-xs font-medium text-slate-500">{format(new Date(log.created_at), "MMM d, yyyy")}</span>
                      <span className="text-[11px] text-slate-400">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("aiDetected")}</p>
                      <p className="text-sm text-slate-600 truncate">{parseValue(log.old_value, t("empty"))}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                    <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">{t("correctedTo")}</p>
                      <p className="text-sm font-semibold text-emerald-800 truncate">{parseValue(log.new_value, t("empty"))}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("p-1 rounded-md", ACTOR_TONE[log.changed_by_type] ?? "bg-slate-100 text-slate-600")}>
                        <ActorIcon size={12} />
                      </div>
                      <span className="text-slate-500">{t("changedBy")}</span>
                      <span className="font-semibold text-slate-800">{correctorName(log)}</span>
                    </div>

                    {log.reason && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">{t("reason")}</span>
                        <span className="italic text-slate-700">{log.reason}</span>
                      </div>
                    )}

                    {log.confidence_before !== null && (
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-violet-400" />
                        <span className="text-slate-500">{t("aiConfidence")}</span>
                        <span className="font-semibold text-slate-800">{Math.round(log.confidence_before * 100)}%</span>
                      </div>
                    )}

                    {log.confidence_after !== null && (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        <span className="text-slate-500">{t("finalConfidence")}</span>
                        <span className="font-semibold text-emerald-700">{Math.round(log.confidence_after * 100)}%</span>
                      </div>
                    )}

                    {log.correction_label && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600 uppercase tracking-wide">
                        {log.correction_label.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="px-6 py-4 border border-slate-200 rounded-xl bg-white flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {t("showingRange", { from: meta.from, to: meta.to, total: meta.total })}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-medium text-slate-900">
              {t("pageOf", { page, lastPage: meta.last_page })}
            </div>
            <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(meta.last_page)} disabled={page === meta.last_page} className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
