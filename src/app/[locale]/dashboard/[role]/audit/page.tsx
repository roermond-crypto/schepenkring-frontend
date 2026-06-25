"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCcw,
  ShieldCheck,
  Download,
  Search,
  Clock,
  User,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Database,
  Server,
  ChevronRight,
  Settings,
  X,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Calendar,
  Tag,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, parseISO, subDays, startOfMonth } from "date-fns";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";

// ── Types ──────────────────────────────────────────────────

interface SystemLog {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: number | null;
  user_id: number | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditApiItem {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor?: {
    id: number;
    type?: string;
    status?: string;
    name?: string;
    email?: string;
    phone?: string | null;
  };
  action?: string;
  entity_type?: string;
  entity_id?: number | null;
  risk_level?: string;
  result?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  snapshot_before?: Record<string, unknown> | null;
  snapshot_after?: Record<string, unknown> | null;
}

interface SummaryData {
  event_types: Array<{ event_type: string; count: number }>;
  entity_types: Array<{ entity_type: string; count: number }>;
  recent_activity_count: number;
  total_count: number;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// ── Constants ──────────────────────────────────────────────

const API_BASE = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://app.schepen-kring.nl/api",
);

// ── Helpers ────────────────────────────────────────────────

function getStoredToken() {
  if (typeof window === "undefined") return null;
  const cookieToken = document.cookie
    .split("; ")
    .find((part) => part.startsWith("schepenkring_auth_token="))
    ?.split("=")[1];
  if (cookieToken) return decodeURIComponent(cookieToken);
  const authToken = localStorage.getItem("auth_token");
  if (authToken) return authToken;
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) return adminToken;
  const userDataRaw = localStorage.getItem("user_data");
  if (userDataRaw) {
    try {
      const userData = JSON.parse(userDataRaw);
      if (userData?.token) return userData.token;
    } catch {
      // Ignore malformed payloads.
    }
  }
  return null;
}

function getAuthHeaders() {
  const token = getStoredToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatEventType(eventType: string) {
  return eventType
    .replaceAll(".", " ")
    .replaceAll("\\", " ")
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getShortEntityLabel(entityType: string) {
  return entityType.split("\\").pop() ?? entityType;
}

// ── Click-outside hook ─────────────────────────────────────

function useClickOutside<T extends HTMLElement>(cb: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cb]);
  return ref;
}

// ── Main page ──────────────────────────────────────────────

export default function SystemAuditPage() {
  const t = useTranslations("DashboardAdminAudit");
  const searchParams = useSearchParams();
  const loadLogsErrorText = t("errors.loadLogs");

  // ── Core state ──
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [highlightedLogId, setHighlightedLogId] = useState<number | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  // ── Popover state ──
  const [openPopover, setOpenPopover] = useState<"event" | "entity" | "recent" | null>(null);
  const closePopover = useCallback(() => setOpenPopover(null), []);
  const eventPopoverRef = useClickOutside<HTMLDivElement>(closePopover);
  const entityPopoverRef = useClickOutside<HTMLDivElement>(closePopover);
  const recentPopoverRef = useClickOutside<HTMLDivElement>(closePopover);

  // ── Pagination ──
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    per_page: 50,
    current_page: 1,
    last_page: 1,
    from: 1,
    to: 1,
  });

  // ── Filters ──
  const [filters, setFilters] = useState({
    event_type: [] as string[],
    entity_type: [] as string[],
    dateRange: { from: "", to: "" },
    search: "",
    risk_level: "",
    source: "",
    page: 1,
  });

  const deepLinkedLogId = useMemo(() => {
    const rawLogId = searchParams.get("logId");
    if (!rawLogId) return null;
    const parsedLogId = Number.parseInt(rawLogId, 10);
    return Number.isFinite(parsedLogId) ? parsedLogId : null;
  }, [searchParams]);

  // ── API ────────────────────────────────────────────────

  const normalizeAuditItem = (item: AuditApiItem): SystemLog => {
    const action = item.action || "audit.unknown";
    const entityType = item.entity_type || "Entity";
    const entityName = entityType.split("\\").pop() || entityType;
    const reason =
      typeof item.metadata?.reason === "string" ? item.metadata.reason : "";
    return {
      id: item.id,
      event_type: action,
      entity_type: entityType,
      entity_id: item.entity_id ?? null,
      user_id: item.actor_id ?? null,
      old_data: item.snapshot_before || null,
      new_data: item.snapshot_after || null,
      changes:
        item.snapshot_before || item.snapshot_after
          ? { before: item.snapshot_before || null, after: item.snapshot_after || null }
          : null,
      description: reason
        ? `${action} - ${reason}`
        : `${action} on ${entityName}${item.entity_id ? ` #${item.entity_id}` : ""}`,
      ip_address: item.ip_address ?? null,
      user_agent: item.user_agent ?? null,
      created_at: item.created_at,
      user: item.actor
        ? {
            id: item.actor.id,
            name: item.actor.name || "Unknown",
            email: item.actor.email || "",
            role: item.actor.type || "USER",
          }
        : undefined,
    };
  };

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/audit/summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data: SummaryData = await res.json();
      setSummary(data);
    } catch {
      // Non-critical — page still works without summary
    }
  }, []);

  const fetchSystemLogs = useCallback(async () => {
    setIsRefreshing(true);
    setApiError(null);
    try {
      const params = new URLSearchParams();
      if (filters.event_type.length > 0) params.append("action", filters.event_type.join(","));
      if (filters.entity_type.length > 0) params.append("entity_type", filters.entity_type.join(","));
      if (filters.dateRange.from) params.append("date_from", filters.dateRange.from);
      if (filters.dateRange.to) params.append("date_to", filters.dateRange.to);
      if (filters.search) params.append("search", filters.search);
      if (filters.risk_level) params.append("risk_level", filters.risk_level);
      if (filters.source) params.append("source", filters.source);
      params.append("per_page", String(pagination.per_page || 50));
      params.append("sort_by", "created_at");
      params.append("sort_dir", "desc");
      params.append("page", filters.page.toString());

      const response = await fetch(`${API_BASE}/admin/audit?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const logs: SystemLog[] = Array.isArray(data.data)
        ? data.data.map(normalizeAuditItem)
        : [];
      setSystemLogs(logs);
      setFilteredLogs(logs);
      setPagination(
        data.meta || { total: 0, per_page: 50, current_page: 1, last_page: 1, from: 0, to: 0 },
      );
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : loadLogsErrorText);
      setSystemLogs([]);
      setFilteredLogs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filters, pagination.per_page, loadLogsErrorText]);

  // ── Filter helpers ─────────────────────────────────────

  const toggleEventFilter = (eventType: string) => {
    setFilters((prev) => ({
      ...prev,
      event_type: prev.event_type.includes(eventType)
        ? prev.event_type.filter((t) => t !== eventType)
        : [...prev.event_type, eventType],
      page: 1,
    }));
  };

  const toggleEntityFilter = (entityType: string) => {
    setFilters((prev) => ({
      ...prev,
      entity_type: prev.entity_type.includes(entityType)
        ? prev.entity_type.filter((t) => t !== entityType)
        : [...prev.entity_type, entityType],
      page: 1,
    }));
  };

  const applyDateShortcut = (shortcut: string) => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let from = "";
    let to = fmt(today);
    switch (shortcut) {
      case "today":
        from = fmt(today);
        break;
      case "yesterday":
        from = fmt(subDays(today, 1));
        to = fmt(subDays(today, 1));
        break;
      case "last7":
        from = fmt(subDays(today, 7));
        break;
      case "last30":
        from = fmt(subDays(today, 30));
        break;
      case "thisMonth":
        from = fmt(startOfMonth(today));
        break;
      default:
        return;
    }
    setFilters((prev) => ({ ...prev, dateRange: { from, to }, page: 1 }));
    closePopover();
  };

  const clearFilters = () => {
    setFilters({
      event_type: [],
      entity_type: [],
      dateRange: { from: "", to: "" },
      search: "",
      risk_level: "",
      source: "",
      page: 1,
    });
  };

  const changePage = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Event helpers ──────────────────────────────────────

  const getEventIcon = (eventType: string) => {
    const p = { size: 18, className: "flex-shrink-0" };
    const n = eventType.toLowerCase();
    if (n.includes("create")) return <CheckCircle {...p} className="flex-shrink-0 text-green-600" />;
    if (n.includes("update")) return <Activity {...p} className="flex-shrink-0 text-blue-600" />;
    if (n.includes("delete")) return <XCircle {...p} className="flex-shrink-0 text-red-600" />;
    if (n.includes("login") || n.includes("logout")) return <User {...p} className="flex-shrink-0 text-purple-600" />;
    return <Activity {...p} className="flex-shrink-0 text-slate-600" />;
  };

  const getEventColor = (eventType: string) => {
    const n = eventType.toLowerCase();
    if (n.includes("create")) return "bg-green-50 text-green-700 border-green-200";
    if (n.includes("update")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (n.includes("delete")) return "bg-red-50 text-red-700 border-red-200";
    if (n.includes("login") || n.includes("logout")) return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getEntityName = (log: SystemLog) => {
    const entityType = formatEventType(log.entity_type.split("\\").pop() || log.entity_type);
    const entityId = log.entity_id ? `#${log.entity_id}` : "";
    return `${entityType} ${entityId}`.trim();
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) return;
    const csvData = filteredLogs.map((log) => ({
      timestamp: log.created_at,
      event_type: log.event_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      user: log.user?.name || t("systemUser"),
      description: log.description,
      ip_address: log.ip_address,
    }));
    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-audit-${new Date().toISOString()}.csv`;
    a.click();
  };

  // ── Lifecycle ──────────────────────────────────────────

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchSystemLogs();
  }, [fetchSystemLogs]);

  useEffect(() => {
    if (!deepLinkedLogId || loading || filteredLogs.length === 0) return;
    const matchedLog = filteredLogs.find((log) => log.id === deepLinkedLogId);
    if (!matchedLog) return;
    setSelectedLog(matchedLog);
    setHighlightedLogId(matchedLog.id);
    const t1 = window.setTimeout(() => {
      document.getElementById(`audit-log-${matchedLog.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const t2 = window.setTimeout(() => {
      setHighlightedLogId((cur) => (cur === matchedLog.id ? null : cur));
    }, 2500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [deepLinkedLogId, filteredLogs, loading]);

  // ── Pagination helpers ─────────────────────────────────

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxPages = 5;
    const half = Math.floor(maxPages / 2);
    let start = Math.max(1, pagination.current_page - half);
    const end = Math.min(pagination.last_page, start + maxPages - 1);
    if (end - start + 1 < maxPages) start = Math.max(1, end - maxPages + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // ── Derived values ─────────────────────────────────────

  const displayEventTypes = summary?.event_types ?? [];
  const displayEntityTypes = summary?.entity_types ?? [];
  const totalEvents = summary?.total_count ?? pagination.total;
  const recentActivityCount = summary?.recent_activity_count ?? 0;

  const activeFilterCount =
    filters.event_type.length +
    filters.entity_type.length +
    (filters.search ? 1 : 0) +
    (filters.dateRange.from ? 1 : 0) +
    (filters.dateRange.to ? 1 : 0) +
    (filters.risk_level ? 1 : 0) +
    (filters.source ? 1 : 0);

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="copied-admin-theme min-h-screen p-6 -top-30">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                <ShieldCheck className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t("header.title")}</h1>
                <p className="text-slate-600 text-sm mt-1">{t("header.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchSystemLogs}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm disabled:opacity-50 text-sm"
              >
                <RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">{t("actions.refresh")}</span>
              </button>
              <button
                onClick={handleExport}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none text-sm"
              >
                <Download size={18} />
                <span className="hidden sm:inline">{t("actions.exportCsv")}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Total Events */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Database size={22} className="text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{totalEvents.toLocaleString()}</p>
            <p className="text-sm text-slate-600 font-medium">{t("stats.totalEvents")}</p>
          </div>

          {/* Event Types — clickable */}
          <div className="relative" ref={eventPopoverRef}>
            <button
              onClick={() => setOpenPopover(openPopover === "event" ? null : "event")}
              className={cn(
                "w-full text-left bg-white rounded-2xl p-6 shadow-sm border transition-all",
                openPopover === "event"
                  ? "border-green-400 shadow-md ring-2 ring-green-100"
                  : "border-slate-200 hover:shadow-md hover:border-green-300",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <Activity size={22} className="text-green-600" />
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-slate-400 transition-transform",
                    openPopover === "event" && "rotate-180 text-green-600",
                  )}
                />
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">{displayEventTypes.length}</p>
              <p className="text-sm text-slate-600 font-medium">{t("stats.eventTypes")}</p>
              {filters.event_type.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.event_type.map((et) => (
                    <span key={et} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                      {getShortEntityLabel(et)}
                    </span>
                  ))}
                </div>
              )}
            </button>

            <AnimatePresence>
              {openPopover === "event" && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Tag size={14} className="text-green-600" />
                      {t("stats.eventTypes")}
                    </span>
                    {filters.event_type.length > 0 && (
                      <button
                        onClick={() => setFilters((p) => ({ ...p, event_type: [], page: 1 }))}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        {t("filters.clearSelection")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {displayEventTypes.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400 text-center">{t("empty.noData")}</p>
                    ) : (
                      displayEventTypes.map(({ event_type, count }) => {
                        const active = filters.event_type.includes(event_type);
                        return (
                          <button
                            key={event_type}
                            onClick={() => { toggleEventFilter(event_type); closePopover(); }}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors text-sm",
                              active
                                ? "bg-green-50 text-green-800 font-semibold"
                                : "text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {active && <CheckCircle size={14} className="text-green-600 flex-shrink-0" />}
                              <span className="font-mono truncate">{event_type}</span>
                            </span>
                            <span className={cn(
                              "ml-3 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0",
                              active ? "bg-green-200 text-green-800" : "bg-slate-100 text-slate-600",
                            )}>
                              {count.toLocaleString()}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Entity Types — clickable */}
          <div className="relative" ref={entityPopoverRef}>
            <button
              onClick={() => setOpenPopover(openPopover === "entity" ? null : "entity")}
              className={cn(
                "w-full text-left bg-white rounded-2xl p-6 shadow-sm border transition-all",
                openPopover === "entity"
                  ? "border-purple-400 shadow-md ring-2 ring-purple-100"
                  : "border-slate-200 hover:shadow-md hover:border-purple-300",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <Server size={22} className="text-purple-600" />
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-slate-400 transition-transform",
                    openPopover === "entity" && "rotate-180 text-purple-600",
                  )}
                />
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">{displayEntityTypes.length}</p>
              <p className="text-sm text-slate-600 font-medium">{t("stats.entityTypes")}</p>
              {filters.entity_type.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.entity_type.map((et) => (
                    <span key={et} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                      {getShortEntityLabel(et)}
                    </span>
                  ))}
                </div>
              )}
            </button>

            <AnimatePresence>
              {openPopover === "entity" && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Layers size={14} className="text-purple-600" />
                      {t("stats.entityTypes")}
                    </span>
                    {filters.entity_type.length > 0 && (
                      <button
                        onClick={() => setFilters((p) => ({ ...p, entity_type: [], page: 1 }))}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        {t("filters.clearSelection")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {displayEntityTypes.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400 text-center">{t("empty.noData")}</p>
                    ) : (
                      displayEntityTypes.map(({ entity_type, count }) => {
                        const active = filters.entity_type.includes(entity_type);
                        const label = getShortEntityLabel(entity_type);
                        return (
                          <button
                            key={entity_type}
                            onClick={() => { toggleEntityFilter(entity_type); closePopover(); }}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors text-sm",
                              active
                                ? "bg-purple-50 text-purple-800 font-semibold"
                                : "text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {active && <CheckCircle size={14} className="text-purple-600 flex-shrink-0" />}
                              <span className="capitalize truncate">{label.toLowerCase()}</span>
                            </span>
                            <span className={cn(
                              "ml-3 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0",
                              active ? "bg-purple-200 text-purple-800" : "bg-slate-100 text-slate-600",
                            )}>
                              {count.toLocaleString()}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent Activity — clickable */}
          <div className="relative" ref={recentPopoverRef}>
            <button
              onClick={() => setOpenPopover(openPopover === "recent" ? null : "recent")}
              className={cn(
                "w-full text-left bg-white rounded-2xl p-6 shadow-sm border transition-all",
                openPopover === "recent"
                  ? "border-orange-400 shadow-md ring-2 ring-orange-100"
                  : "border-slate-200 hover:shadow-md hover:border-orange-300",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-orange-100 rounded-xl">
                  <Clock size={22} className="text-orange-600" />
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-slate-400 transition-transform",
                    openPopover === "recent" && "rotate-180 text-orange-600",
                  )}
                />
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">{recentActivityCount.toLocaleString()}</p>
              <p className="text-sm text-slate-600 font-medium">{t("stats.recentActivity")}</p>
              {(filters.dateRange.from || filters.dateRange.to) && (
                <p className="mt-2 text-xs text-orange-600 font-semibold truncate">
                  {filters.dateRange.from && filters.dateRange.to
                    ? `${filters.dateRange.from} → ${filters.dateRange.to}`
                    : filters.dateRange.from
                    ? `${t("filters.from")} ${filters.dateRange.from}`
                    : `${t("filters.to")} ${filters.dateRange.to}`}
                </p>
              )}
            </button>

            <AnimatePresence>
              {openPopover === "recent" && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Calendar size={14} className="text-orange-600" />
                      {t("filters.dateShortcuts")}
                    </span>
                    {(filters.dateRange.from || filters.dateRange.to) && (
                      <button
                        onClick={() => { setFilters((p) => ({ ...p, dateRange: { from: "", to: "" }, page: 1 })); closePopover(); }}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        {t("filters.clearSelection")}
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    {(["today", "yesterday", "last7", "last30", "thisMonth"] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => applyDateShortcut(key)}
                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-800 transition-colors font-medium"
                      >
                        {t(`filters.shortcuts.${key}`)}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 mt-2 pt-2 px-1 space-y-2">
                      <p className="text-xs font-bold text-slate-500 px-3 pb-1">{t("filters.customRange")}</p>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={filters.dateRange.from}
                          onChange={(e) => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, from: e.target.value }, page: 1 }))}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                          placeholder={t("filters.fromDate")}
                        />
                        <input
                          type="date"
                          value={filters.dateRange.to}
                          onChange={(e) => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, to: e.target.value }, page: 1 }))}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                          placeholder={t("filters.toDate")}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Persistent Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t("filters.searchPlaceholder")}
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Event type select */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                value={filters.event_type[0] ?? ""}
                onChange={(e) => setFilters((p) => ({
                  ...p,
                  event_type: e.target.value ? [e.target.value] : [],
                  page: 1,
                }))}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">{t("filters.allEventTypes")}</option>
                {displayEventTypes.map(({ event_type }) => (
                  <option key={event_type} value={event_type}>{event_type}</option>
                ))}
              </select>
            </div>

            {/* Entity type select */}
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                value={filters.entity_type[0] ?? ""}
                onChange={(e) => setFilters((p) => ({
                  ...p,
                  entity_type: e.target.value ? [e.target.value] : [],
                  page: 1,
                }))}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">{t("filters.allEntityTypes")}</option>
                {displayEntityTypes.map(({ entity_type }) => (
                  <option key={entity_type} value={entity_type}>
                    {getShortEntityLabel(entity_type)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <input
              type="date"
              value={filters.dateRange.from}
              onChange={(e) => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, from: e.target.value }, page: 1 }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              title={t("filters.fromDate")}
            />

            {/* Date to */}
            <input
              type="date"
              value={filters.dateRange.to}
              onChange={(e) => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, to: e.target.value }, page: 1 }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              title={t("filters.toDate")}
            />

            {/* Risk level */}
            <div className="relative">
              <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                value={filters.risk_level}
                onChange={(e) => setFilters((p) => ({ ...p, risk_level: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">{t("filters.allRiskLevels")}</option>
                <option value="LOW">{t("filters.riskLow")}</option>
                <option value="MEDIUM">{t("filters.riskMedium")}</option>
                <option value="HIGH">{t("filters.riskHigh")}</option>
                <option value="CRITICAL">{t("filters.riskCritical")}</option>
              </select>
            </div>

            {/* Source */}
            <div className="relative">
              <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder={t("filters.sourcePlaceholder")}
                value={filters.source}
                onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Active filters + clear */}
          {activeFilterCount > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">{t("filters.activeFilters")}:</span>
              {filters.event_type.map((et) => (
                <span key={et} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  <Tag size={10} />
                  {et}
                  <button onClick={() => toggleEventFilter(et)} className="ml-0.5 hover:text-green-900"><X size={10} /></button>
                </span>
              ))}
              {filters.entity_type.map((et) => (
                <span key={et} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                  <Layers size={10} />
                  {getShortEntityLabel(et)}
                  <button onClick={() => toggleEntityFilter(et)} className="ml-0.5 hover:text-purple-900"><X size={10} /></button>
                </span>
              ))}
              {filters.dateRange.from && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                  <Calendar size={10} />
                  {t("filters.from")} {filters.dateRange.from}
                  <button onClick={() => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, from: "" }, page: 1 }))} className="ml-0.5 hover:text-orange-900"><X size={10} /></button>
                </span>
              )}
              {filters.dateRange.to && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                  <Calendar size={10} />
                  {t("filters.to")} {filters.dateRange.to}
                  <button onClick={() => setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, to: "" }, page: 1 }))} className="ml-0.5 hover:text-orange-900"><X size={10} /></button>
                </span>
              )}
              {filters.risk_level && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                  <AlertCircle size={10} />
                  {filters.risk_level}
                  <button onClick={() => setFilters((p) => ({ ...p, risk_level: "", page: 1 }))} className="ml-0.5 hover:text-red-900"><X size={10} /></button>
                </span>
              )}
              {filters.source && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                  <Server size={10} />
                  {filters.source}
                  <button onClick={() => setFilters((p) => ({ ...p, source: "", page: 1 }))} className="ml-0.5 hover:text-slate-900"><X size={10} /></button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
              >
                <X size={12} />
                {t("filters.clearAll", { count: activeFilterCount })}
              </button>
            </div>
          )}
        </motion.div>

        {/* Error State */}
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-black text-red-900">{t("errors.title")}</h3>
                <p className="text-sm text-red-700 mt-1">{apiError}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Activity Logs */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">{t("logs.title")}</h2>
              {pagination.total > 0 && (
                <p className="text-sm text-slate-600 font-semibold">
                  {t("logs.showing", {
                    from: pagination.from.toLocaleString(),
                    to: pagination.to.toLocaleString(),
                    total: pagination.total.toLocaleString(),
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4" />
                <p className="text-slate-600 font-semibold">{t("logs.loading")}</p>
              </div>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => {
                const isExpanded = selectedLog?.id === log.id;
                return (
                  <motion.div
                    key={log.id}
                    id={`audit-log-${log.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "hover:bg-slate-50 transition-all cursor-pointer",
                      isExpanded && "bg-blue-50 border-l-4 border-l-blue-600",
                      highlightedLogId === log.id && "bg-amber-50 ring-2 ring-amber-300 ring-inset",
                    )}
                    onClick={() => setSelectedLog(isExpanded ? null : log)}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">{getEventIcon(log.event_type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <p className="text-slate-900 font-semibold leading-relaxed">{log.description}</p>
                            <span className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-bold border-2 whitespace-nowrap flex-shrink-0",
                              getEventColor(log.event_type),
                            )}>
                              {formatEventType(log.event_type)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Clock size={14} />
                              {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                            </span>
                            {log.user && (
                              <span className="flex items-center gap-1.5 font-medium">
                                <User size={14} />
                                {log.user.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 font-medium">
                              <Database size={14} />
                              {getEntityName(log)}
                            </span>
                            {log.ip_address && (
                              <span className="font-mono text-xs bg-slate-200 px-2.5 py-1 rounded-lg font-bold">
                                {log.ip_address}
                              </span>
                            )}
                            <ChevronRight
                              size={18}
                              className={cn(
                                "ml-auto transition-transform text-slate-400",
                                isExpanded && "rotate-90 text-blue-600",
                              )}
                            />
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-slate-200"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                                      <User size={16} />
                                      {log.user ? t("details.userInformation") : t("details.systemAction")}
                                    </h4>
                                    <div className="space-y-3">
                                      {log.user ? (
                                        <>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.name")}</p>
                                            <p className="text-sm font-semibold text-slate-900">{log.user.name}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.email")}</p>
                                            <p className="text-sm font-semibold text-slate-900">{log.user.email}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.role")}</p>
                                            <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{log.user.role}</span>
                                          </div>
                                        </>
                                      ) : (
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.action")}</p>
                                          <p className="text-sm font-semibold text-slate-900">{t("details.systemAutomatedAction")}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                                      <Settings size={16} />
                                      {t("details.technicalDetails")}
                                    </h4>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.entityDetails")}</p>
                                        <p className="text-sm text-slate-900 font-semibold">{getEntityName(log)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.timestamp")}</p>
                                        <p className="text-sm font-semibold text-slate-900">{format(parseISO(log.created_at), "PPpp")}</p>
                                      </div>
                                      {log.ip_address && (
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">{t("details.ipAddress")}</p>
                                          <p className="text-sm font-mono font-semibold text-slate-900 bg-slate-200 px-2 py-1 rounded-lg inline-block">{log.ip_address}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {log.changes && Object.keys(log.changes).length > 0 && (
                                    <div className="md:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                                      <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                                        <Activity size={14} />
                                        {t("details.changesMade")}
                                      </p>
                                      <pre className="text-xs bg-white p-4 rounded-lg overflow-auto max-h-60 border border-slate-300 text-slate-900 font-mono">
                                        {JSON.stringify(log.changes, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center">
                  <Search size={40} className="text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-700 mb-2">{t("empty.title")}</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  {activeFilterCount > 0 ? t("empty.filtered") : t("empty.default")}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-lg shadow-blue-200"
                  >
                    {t("filters.clearAllPlain")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.last_page > 1 && !apiError && (
            <div className="px-6 py-5 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-700 font-semibold">
                  {t("pagination.resultsSummary", {
                    from: pagination.from.toLocaleString(),
                    to: pagination.to.toLocaleString(),
                    total: pagination.total.toLocaleString(),
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changePage(1)}
                    disabled={pagination.current_page === 1 || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.firstPage")}
                  >
                    <ChevronsLeft size={18} />
                  </button>
                  <button
                    onClick={() => changePage(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1 || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.previousPage")}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="hidden sm:flex items-center gap-2">
                    {getPageNumbers().map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => changePage(pageNum)}
                        disabled={loading}
                        className={cn(
                          "min-w-[40px] px-3 py-2 rounded-xl font-bold text-sm transition-all border-2",
                          pageNum === pagination.current_page
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                            : "border-slate-300 text-slate-700 hover:bg-white hover:border-blue-400",
                        )}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <div className="sm:hidden px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl border-2 border-slate-300">
                    {pagination.current_page} / {pagination.last_page}
                  </div>
                  <button
                    onClick={() => changePage(pagination.current_page + 1)}
                    disabled={pagination.current_page === pagination.last_page || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.nextPage")}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={() => changePage(pagination.last_page)}
                    disabled={pagination.current_page === pagination.last_page || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.lastPage")}
                  >
                    <ChevronsRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
