"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCcw,
  ShieldCheck,
  Filter,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, parseISO } from "date-fns";

// Types
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

interface SystemStats {
  summary: {
    total_logs: number;
    event_types: Array<{ event_type: string; count: number }>;
    entity_types: Array<{ entity_type: string; count: number }>;
  };
  recent_activity: SystemLog[];
  daily_activity: Array<{ date: string; count: number }>;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://app.schepen-kring.nl/api";

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
      // Ignore malformed local storage payloads.
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

export default function SystemAuditPage() {
  const t = useTranslations("DashboardAdminAudit");
  const loadLogsErrorText = t("errors.loadLogs");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    per_page: 50,
    current_page: 1,
    last_page: 1,
    from: 1,
    to: 1,
  });

  const [filters, setFilters] = useState({
    event_type: [] as string[],
    entity_type: [] as string[],
    dateRange: {
      from: "",
      to: "",
    },
    search: "",
    page: 1,
  });

  // ============================================
  // API CALLS
  // ============================================

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
          ? {
              before: item.snapshot_before || null,
              after: item.snapshot_after || null,
            }
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

  const fetchSystemLogs = useCallback(async () => {
    setIsRefreshing(true);
    setApiError(null);

    try {
      const params = new URLSearchParams();

      if (filters.event_type.length > 0) {
        params.append("action", filters.event_type[0]);
      }

      if (filters.entity_type.length > 0) {
        params.append("entity_type", filters.entity_type[0]);
      }

      if (filters.dateRange.from) {
        params.append("date_from", filters.dateRange.from);
      }

      if (filters.dateRange.to) {
        params.append("date_to", filters.dateRange.to);
      }

      if (filters.search) {
        params.append("search", filters.search);
      }

      params.append("per_page", String(pagination.per_page || 50));
      params.append("sort_by", "created_at");
      params.append("sort_dir", "desc");
      params.append("page", filters.page.toString());

      const url = `${API_BASE}/audit?${params.toString()}`;

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const logs: SystemLog[] = Array.isArray(data.data)
        ? data.data.map(normalizeAuditItem)
        : [];

      setSystemLogs(logs);
      setFilteredLogs(logs);
      setPagination(
        data.meta || {
          total: 0,
          per_page: 50,
          current_page: 1,
          last_page: 1,
          from: 0,
          to: 0,
        },
      );
    } catch (error: unknown) {
      setApiError(
        error instanceof Error ? error.message : loadLogsErrorText,
      );
      setSystemLogs([]);
      setFilteredLogs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filters, pagination.per_page, loadLogsErrorText]);

  // ============================================
  // FILTERS AND UTILITIES
  // ============================================

  const stats = useMemo<SystemStats>(() => {
    const eventCount = new Map<string, number>();
    const entityCount = new Map<string, number>();
    const dailyCount = new Map<string, number>();

    for (const log of systemLogs) {
      eventCount.set(log.event_type, (eventCount.get(log.event_type) || 0) + 1);
      entityCount.set(
        log.entity_type,
        (entityCount.get(log.entity_type) || 0) + 1,
      );
      const day = log.created_at.slice(0, 10);
      dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
    }

    return {
      summary: {
        total_logs: pagination.total || systemLogs.length,
        event_types: Array.from(eventCount.entries()).map(
          ([event_type, count]) => ({ event_type, count }),
        ),
        entity_types: Array.from(entityCount.entries()).map(
          ([entity_type, count]) => ({ entity_type, count }),
        ),
      },
      recent_activity: systemLogs.slice(0, 10),
      daily_activity: Array.from(dailyCount.entries()).map(([date, count]) => ({
        date,
        count,
      })),
    };
  }, [pagination.total, systemLogs]);

  const availableEventTypes = useMemo(
    () => stats.summary.event_types.map((et) => et.event_type),
    [stats.summary.event_types],
  );

  const availableEntityTypes = useMemo(
    () => stats.summary.entity_types.map((et) => et.entity_type),
    [stats.summary.entity_types],
  );

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

  const clearFilters = () => {
    setFilters({
      event_type: [],
      entity_type: [],
      dateRange: { from: "", to: "" },
      search: "",
      page: 1,
    });
  };

  const changePage = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replaceAll(".", " ")
      .replaceAll("\\", " ")
      .split(/[_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getEventIcon = (eventType: string) => {
    const iconProps = { size: 18, className: "flex-shrink-0" };
    const normalized = eventType.toLowerCase();

    switch (true) {
      case normalized.includes("create"):
        return (
          <CheckCircle
            {...iconProps}
            className="flex-shrink-0 text-green-600"
          />
        );
      case normalized.includes("update"):
        return (
          <Activity {...iconProps} className="flex-shrink-0 text-blue-600" />
        );
      case normalized.includes("delete"):
        return (
          <XCircle {...iconProps} className="flex-shrink-0 text-red-600" />
        );
      case normalized.includes("login") || normalized.includes("logout"):
        return (
          <User {...iconProps} className="flex-shrink-0 text-purple-600" />
        );
      default:
        return (
          <Activity {...iconProps} className="flex-shrink-0 text-slate-600" />
        );
    }
  };

  const getEventColor = (eventType: string) => {
    const normalized = eventType.toLowerCase();

    switch (true) {
      case normalized.includes("create"):
        return "bg-green-50 text-green-700 border-green-200";
      case normalized.includes("update"):
        return "bg-blue-50 text-blue-700 border-blue-200";
      case normalized.includes("delete"):
        return "bg-red-50 text-red-700 border-red-200";
      case normalized.includes("login") || normalized.includes("logout"):
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getEntityName = (log: SystemLog) => {
    const entityType = formatEventType(
      log.entity_type.split("\\").pop() || log.entity_type,
    );
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

  // ============================================
  // LIFECYCLE
  // ============================================

  useEffect(() => {
    void fetchSystemLogs();
  }, [fetchSystemLogs]);

  // ============================================
  // PAGINATION HELPERS
  // ============================================

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    const halfRange = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, pagination.current_page - halfRange);
    const endPage = Math.min(
      pagination.last_page,
      startPage + maxPagesToShow - 1,
    );

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  // ============================================
  // RENDER
  // ============================================

  const activeFilterCount =
    filters.event_type.length +
    filters.entity_type.length +
    (filters.search ? 1 : 0) +
    (filters.dateRange.from ? 1 : 0) +
    (filters.dateRange.to ? 1 : 0);

  return (
    <div className="copied-admin-theme min-h-screen p-6 -top-30">
      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6 ">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                <ShieldCheck className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  {t("header.title")}
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  {t("header.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all shadow-sm text-sm",
                  showFilters
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:border-blue-300",
                )}
              >
                <Filter size={18} />
                <span>{t("actions.filters")}</span>
                {activeFilterCount > 0 && (
                  <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={fetchSystemLogs}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm disabled:opacity-50 text-sm"
              >
                <RefreshCcw
                  size={18}
                  className={cn(isRefreshing && "animate-spin")}
                />
                <span className="hidden sm:inline">{t("actions.refresh")}</span>
              </button>

              <button
                onClick={handleExport}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none text-sm"
              >
                <Download size={18} />
                <span className="hidden sm:inline">
                  {t("actions.exportCsv")}
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <Database size={22} className="text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">
                {stats.summary.total_logs.toLocaleString()}
              </p>
              <p className="text-sm text-slate-600 font-medium">
                {t("stats.totalEvents")}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <Activity size={22} className="text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">
                {stats.summary.event_types.length}
              </p>
              <p className="text-sm text-slate-600 font-medium">
                {t("stats.eventTypes")}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <Server size={22} className="text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">
                {stats.summary.entity_types.length}
              </p>
              <p className="text-sm text-slate-600 font-medium">
                {t("stats.entityTypes")}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-orange-100 rounded-xl">
                  <Clock size={22} className="text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mb-1">
                {stats.recent_activity.length}
              </p>
              <p className="text-sm text-slate-600 font-medium">
                {t("stats.recentActivity")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-900">
                    {t("filters.title")}
                  </h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Search */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {t("filters.searchLogs")}
                    </label>
                    <div className="relative">
                      <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder={t("filters.searchPlaceholder")}
                        value={filters.search}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            search: e.target.value,
                            page: 1,
                          }))
                        }
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {t("filters.fromDate")}
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.from}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: {
                            ...prev.dateRange,
                            from: e.target.value,
                          },
                          page: 1,
                        }))
                      }
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {t("filters.toDate")}
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.to}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, to: e.target.value },
                          page: 1,
                        }))
                      }
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Event Types */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    {t("filters.eventTypes")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableEventTypes.map((eventType) => (
                      <button
                        key={eventType}
                        onClick={() => toggleEventFilter(eventType)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2",
                          filters.event_type.includes(eventType)
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50",
                        )}
                      >
                        {formatEventType(eventType)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entity Types */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    {t("filters.entityTypes")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableEntityTypes.map((entityType) => (
                      <button
                        key={entityType}
                        onClick={() => toggleEntityFilter(entityType)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2",
                          filters.entity_type.includes(entityType)
                            ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200"
                            : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:bg-green-50",
                        )}
                      >
                        {formatEventType(entityType)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={clearFilters}
                      className="text-sm text-red-600 hover:text-red-700 font-bold transition-colors flex items-center gap-2"
                    >
                      <X size={16} />
                      {t("filters.clearAll", { count: activeFilterCount })}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <h2 className="text-xl font-black text-slate-900">
                {t("logs.title")}
              </h2>
              {pagination.total > 0 && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-600 font-semibold">
                    {t("logs.showing", {
                      from: pagination.from.toLocaleString(),
                      to: pagination.to.toLocaleString(),
                      total: pagination.total.toLocaleString(),
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p className="text-slate-600 font-semibold">
                  {t("logs.loading")}
                </p>
              </div>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => {
                const isExpanded = selectedLog?.id === log.id;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "hover:bg-slate-50 transition-all cursor-pointer",
                      isExpanded && "bg-blue-50 border-l-4 border-l-blue-600",
                    )}
                    onClick={() => setSelectedLog(isExpanded ? null : log)}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {getEventIcon(log.event_type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <p className="text-slate-900 font-semibold leading-relaxed">
                                {log.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-bold border-2 whitespace-nowrap",
                                  getEventColor(log.event_type),
                                )}
                              >
                                {formatEventType(log.event_type)}
                              </span>
                            </div>
                          </div>

                          {/* Meta Information */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Clock size={14} />
                              {formatDistanceToNow(parseISO(log.created_at), {
                                addSuffix: true,
                              })}
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

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-slate-200"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* User Information */}
                                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                                      <User size={16} />
                                      {log.user
                                        ? t("details.userInformation")
                                        : t("details.systemAction")}
                                    </h4>
                                    <div className="space-y-3">
                                      {log.user ? (
                                        <>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                              {t("details.name")}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-900">
                                              {log.user.name}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                              {t("details.email")}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-900">
                                              {log.user.email}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                              {t("details.role")}
                                            </p>
                                            <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                                              {log.user.role}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                            {t("details.action")}
                                          </p>
                                          <p className="text-sm font-semibold text-slate-900">
                                            {t("details.systemAutomatedAction")}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Technical Details */}
                                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                                      <Settings size={16} />
                                      {t("details.technicalDetails")}
                                    </h4>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                          {t("details.entityDetails")}
                                        </p>
                                        <p className="text-sm text-slate-900 font-semibold">
                                          {getEntityName(log)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                          {t("details.timestamp")}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900">
                                          {format(
                                            parseISO(log.created_at),
                                            "PPpp",
                                          )}
                                        </p>
                                      </div>
                                      {log.ip_address && (
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
                                            {t("details.ipAddress")}
                                          </p>
                                          <p className="text-sm font-mono font-semibold text-slate-900 bg-slate-200 px-2 py-1 rounded-lg inline-block">
                                            {log.ip_address}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Changes (Full Width) */}
                                  {log.changes &&
                                    Object.keys(log.changes).length > 0 && (
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
                <h3 className="text-xl font-black text-slate-700 mb-2">
                  {t("empty.title")}
                </h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  {activeFilterCount > 0
                    ? t("empty.filtered")
                    : t("empty.default")}
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

          {/* Enhanced Pagination */}
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
                  {/* First Page */}
                  <button
                    onClick={() => changePage(1)}
                    disabled={pagination.current_page === 1 || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.firstPage")}
                  >
                    <ChevronsLeft size={18} />
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => changePage(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1 || loading}
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.previousPage")}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Page Numbers */}
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

                  {/* Mobile: Current Page Indicator */}
                  <div className="sm:hidden px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl border-2 border-slate-300">
                    {pagination.current_page} / {pagination.last_page}
                  </div>

                  {/* Next Page */}
                  <button
                    onClick={() => changePage(pagination.current_page + 1)}
                    disabled={
                      pagination.current_page === pagination.last_page ||
                      loading
                    }
                    className="p-2 border-2 border-slate-300 rounded-xl disabled:opacity-40 hover:bg-white hover:border-blue-400 transition-all font-bold text-slate-700 disabled:cursor-not-allowed"
                    title={t("pagination.nextPage")}
                  >
                    <ChevronRight size={18} />
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => changePage(pagination.last_page)}
                    disabled={
                      pagination.current_page === pagination.last_page ||
                      loading
                    }
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
