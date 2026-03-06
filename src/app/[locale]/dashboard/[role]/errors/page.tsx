"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getErrorReferenceCode,
  getFriendlyErrorMessage,
} from "@/lib/friendly-errors";

type ErrorStatus = "unresolved" | "resolved" | "ignored";
type ErrorLevel = "error" | "warning" | "info" | "fatal" | "warn";

type PlatformError = {
  id: number;
  title: string;
  message: string;
  level: ErrorLevel | string;
  status: ErrorStatus;
  sentry_issue_id?: string | null;
  project?: string | null;
  environment?: string | null;
  release?: string | null;
  occurrences_count?: number | null;
  users_affected?: number | null;
  last_seen_at?: string | null;
  first_seen_at?: string | null;
  ai_user_message_nl?: string | null;
  ai_user_message_en?: string | null;
  ai_user_message_de?: string | null;
  ai_dev_summary?: string | null;
  ai_category?: string | null;
  tags?: Record<string, any> | null;
  assignee?: {
    id?: number;
    name?: string;
    email?: string;
  } | null;
};

type ErrorStats = {
  errors_last_24h: number;
  critical: number;
  regressions: number;
  users_affected: number;
};

type ErrorDetailResponse = {
  error: PlatformError & {
    last_event_sample_json?: Record<string, any> | null;
    notes?: Array<{
      id?: number;
      note?: string;
      created_at?: string;
      user?: { name?: string };
    }>;
  };
  reports?: Array<Record<string, any>>;
};

type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page?: number;
};

const API_BASE = "https://app.schepen-kring.nl/api";

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
      // Ignore invalid user payloads.
    }
  }

  return null;
}

function getAuthHeaders() {
  const token = getStoredToken();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(value?: string | null, locale = "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const localeTag =
    locale === "nl" ? "nl-NL" : locale === "de" ? "de-DE" : "en-US";
  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function levelClasses(level?: string | null) {
  switch ((level || "").toLowerCase()) {
    case "fatal":
      return "bg-red-100 text-red-800 border-red-200";
    case "error":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "warning":
    case "warn":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function statusClasses(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ignored":
      return "bg-slate-200 text-slate-700 border-slate-300";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveData(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, entry]) => {
    if (/(token|password|secret|iban|authorization|cookie)/i.test(key)) {
      acc[key] = "[REDACTED]";
      return acc;
    }

    acc[key] = redactSensitiveData(entry);
    return acc;
  }, {});
}

export default function AdminErrorsPage() {
  const locale = useLocale();
  const router = useRouter();
  const copy = useMemo(() => {
    const isNl = locale === "nl";
    const isDe = locale === "de";

    return {
      title: isNl
        ? "Errors Control Center"
        : isDe
          ? "Errors Control Center"
          : "Errors Control Center",
      subtitle: isNl
        ? "Volg productieproblemen, regressies en AI-verklaringen vanuit een centrale inbox."
        : isDe
          ? "Verfolgen Sie Produktionsfehler, Regressionen und KI-Erklärungen in einer zentralen Inbox."
          : "Track production failures, regressions, and AI explanations from one central inbox.",
      refresh: isNl ? "Verversen" : isDe ? "Aktualisieren" : "Refresh",
      filters: isNl ? "Filters" : isDe ? "Filter" : "Filters",
      search: isNl
        ? "Zoek op titel of melding"
        : isDe
          ? "Nach Titel oder Meldung suchen"
          : "Search title or message",
      allStatuses: isNl
        ? "Alle statussen"
        : isDe
          ? "Alle Status"
          : "All statuses",
      allLevels: isNl ? "Alle niveaus" : isDe ? "Alle Stufen" : "All levels",
      allSources: isNl ? "Alle bronnen" : isDe ? "Alle Quellen" : "All sources",
      allEnvironments: isNl
        ? "Alle omgevingen"
        : isDe
          ? "Alle Umgebungen"
          : "All environments",
      allCategories: isNl
        ? "Alle categorieen"
        : isDe
          ? "Alle Kategorien"
          : "All categories",
      route: isNl ? "Route" : isDe ? "Route" : "Route",
      release: isNl ? "Release" : isDe ? "Release" : "Release",
      userId: isNl ? "Gebruiker ID" : isDe ? "Benutzer-ID" : "User ID",
      fromDate: isNl ? "Vanaf" : isDe ? "Von" : "From",
      toDate: isNl ? "Tot" : isDe ? "Bis" : "To",
      clear: isNl ? "Reset" : isDe ? "Zuruecksetzen" : "Clear",
      errors24h: isNl ? "Errors 24u" : isDe ? "Fehler 24h" : "Errors 24h",
      critical: isNl ? "Kritiek" : isDe ? "Kritisch" : "Critical",
      regressions: isNl ? "Regressies" : isDe ? "Regressionen" : "Regressions",
      usersAffected: isNl
        ? "Gebruikers geraakt"
        : isDe
          ? "Betroffene Nutzer"
          : "Users affected",
      lastSeen: isNl ? "Laatst gezien" : isDe ? "Zuletzt gesehen" : "Last seen",
      firstSeen: isNl ? "Eerst gezien" : isDe ? "Zuerst gesehen" : "First seen",
      level: isNl ? "Niveau" : isDe ? "Stufe" : "Level",
      source: isNl ? "Bron" : isDe ? "Quelle" : "Source",
      environment: isNl ? "Omgeving" : isDe ? "Umgebung" : "Environment",
      events: isNl ? "Events" : isDe ? "Ereignisse" : "Events",
      affected: isNl ? "Getroffen" : isDe ? "Betroffen" : "Affected",
      status: isNl ? "Status" : isDe ? "Status" : "Status",
      category: isNl ? "Categorie" : isDe ? "Kategorie" : "Category",
      actions: isNl ? "Acties" : isDe ? "Aktionen" : "Actions",
      open: isNl ? "Open" : isDe ? "Oeffnen" : "Open",
      empty: isNl
        ? "Geen platformfouten gevonden voor de huidige filters."
        : isDe
          ? "Keine Plattformfehler fuer die aktuellen Filter gefunden."
          : "No platform errors found for the current filters.",
      loadFailed: isNl
        ? "De foutenfeed kon niet worden geladen."
        : isDe
          ? "Der Fehlerfeed konnte nicht geladen werden."
          : "Could not load the errors feed.",
      detailTitle: isNl
        ? "Foutdetails"
        : isDe
          ? "Fehlerdetails"
          : "Error details",
      detailSubtitle: isNl
        ? "Bekijk stacktrace, tags, voorbeeldpayload en AI-advies."
        : isDe
          ? "Zeigt Stacktrace, Tags, Beispielpayload und KI-Hinweise."
          : "Inspect stack trace, tags, sample payload, and AI guidance.",
      userMessage: isNl
        ? "Gebruikersmelding"
        : isDe
          ? "Benutzermeldung"
          : "User message",
      developerSummary: isNl
        ? "Developer summary"
        : isDe
          ? "Entwickler-Zusammenfassung"
          : "Developer summary",
      payload: isNl
        ? "Laatste event payload"
        : isDe
          ? "Letzte Event-Payload"
          : "Last event payload",
      reports: isNl ? "Rapporten" : isDe ? "Berichte" : "Reports",
      resolve: isNl ? "Resolve" : isDe ? "Resolve" : "Resolve",
      ignore7Days: isNl
        ? "Negeer 7 dagen"
        : isDe
          ? "7 Tage ignorieren"
          : "Ignore 7 days",
      addNote: isNl
        ? "Notitie toevoegen"
        : isDe
          ? "Notiz hinzufuegen"
          : "Add note",
      assign: isNl ? "Toewijzen" : isDe ? "Zuweisen" : "Assign",
      save: isNl ? "Opslaan" : isDe ? "Speichern" : "Save",
      cancel: isNl ? "Annuleren" : isDe ? "Abbrechen" : "Cancel",
      notePlaceholder: isNl
        ? "Interne notitie voor het team"
        : isDe
          ? "Interne Notiz fuer das Team"
          : "Internal note for the team",
      assignPlaceholder: isNl
        ? "Developer user ID"
        : isDe
          ? "Entwickler-Benutzer-ID"
          : "Developer user ID",
      copied: isNl
        ? "Referentiecode gekopieerd."
        : isDe
          ? "Referenzcode kopiert."
          : "Reference code copied.",
      updated: isNl
        ? "Foutstatus bijgewerkt."
        : isDe
          ? "Fehlerstatus aktualisiert."
          : "Error status updated.",
      savedNote: isNl
        ? "Notitie opgeslagen."
        : isDe
          ? "Notiz gespeichert."
          : "Note saved.",
      assigned: isNl
        ? "Issue toegewezen."
        : isDe
          ? "Issue zugewiesen."
          : "Issue assigned.",
      unresolved: isNl ? "Onopgelost" : isDe ? "Offen" : "Unresolved",
      resolved: isNl ? "Opgelost" : isDe ? "Geloest" : "Resolved",
      ignored: isNl ? "Genegeerd" : isDe ? "Ignoriert" : "Ignored",
      page: isNl ? "Pagina" : isDe ? "Seite" : "Page",
      perPage: isNl ? "per pagina" : isDe ? "pro Seite" : "per page",
      noSelection: isNl
        ? "Selecteer een fout"
        : isDe
          ? "Waehlen Sie einen Fehler"
          : "Select an error",
    };
  }, [locale]);

  const [loading, setLoading] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [rows, setRows] = useState<PlatformError[]>([]);
  const [stats, setStats] = useState<ErrorStats>({
    errors_last_24h: 0,
    critical: 0,
    regressions: 0,
    users_affected: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    current_page: 1,
    per_page: 25,
    total: 0,
    last_page: 1,
  });
  const [selectedErrorId, setSelectedErrorId] = useState<number | null>(null);
  const [selectedError, setSelectedError] =
    useState<ErrorDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    level: "",
    source: "",
    environment: "",
    release: "",
    route: "",
    userId: "",
    category: "",
    from: "",
    to: "",
    sortBy: "last_seen_at",
    sortDir: "desc",
    page: 1,
    perPage: 25,
  });

  const activeFilterCount = useMemo(
    () =>
      [
        filters.q,
        filters.status,
        filters.level,
        filters.source,
        filters.environment,
        filters.release,
        filters.route,
        filters.userId,
        filters.category,
        filters.from,
        filters.to,
      ].filter(Boolean).length,
    [filters],
  );

  const options = useMemo(() => {
    const projects = Array.from(
      new Set(rows.map((row) => row.project).filter(Boolean) as string[]),
    );
    const environments = Array.from(
      new Set(rows.map((row) => row.environment).filter(Boolean) as string[]),
    );
    const categories = Array.from(
      new Set(rows.map((row) => row.ai_category).filter(Boolean) as string[]),
    );
    const releases = Array.from(
      new Set(rows.map((row) => row.release).filter(Boolean) as string[]),
    );

    return { projects, environments, categories, releases };
  }, [rows]);

  const loadStats = useCallback(async () => {
    const response = await fetch(`${API_BASE}/admin/errors/stats`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(copy.loadFailed);
    }

    const data = await response.json();
    setStats({
      errors_last_24h: Number(data?.errors_last_24h || 0),
      critical: Number(data?.critical || 0),
      regressions: Number(data?.regressions || 0),
      users_affected: Number(data?.users_affected || 0),
    });
  }, [copy.loadFailed]);

  const loadErrors = useCallback(async () => {
    setRefreshing(true);
    setApiError(null);

    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.level) params.set("level", filters.level);
      if (filters.source) params.set("project", filters.source);
      if (filters.environment) params.set("environment", filters.environment);
      if (filters.release) params.set("release", filters.release);
      if (filters.route) params.set("route", filters.route);
      if (filters.userId) params.set("user_id", filters.userId);
      if (filters.category) params.set("category", filters.category);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.q) params.set("search", filters.q);
      params.set("sort_by", filters.sortBy);
      params.set("sort_dir", filters.sortDir);
      params.set("page", String(filters.page));
      params.set("per_page", String(filters.perPage));

      const response = await fetch(
        `${API_BASE}/admin/errors?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(copy.loadFailed);
      }

      const payload = await response.json();
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setPagination({
        current_page: Number(payload?.meta?.current_page || filters.page),
        per_page: Number(payload?.meta?.per_page || filters.perPage),
        total: Number(payload?.meta?.total || 0),
        last_page: Number(payload?.meta?.last_page || 1),
      });
    } catch (error: any) {
      setApiError(error?.message || copy.loadFailed);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [copy.loadFailed, filters]);

  const loadDetail = useCallback(
    async (errorId: number) => {
      setSelectedErrorId(errorId);
      setDetailLoading(true);

      try {
        const response = await fetch(
          `${API_BASE}/admin/errors/${errorId}?include_reports=true`,
          {
            headers: getAuthHeaders(),
          },
        );

        if (!response.ok) {
          throw new Error(copy.loadFailed);
        }

        const payload = await response.json();
        setSelectedError(payload);
        setNoteInput("");
        setAssignUserId("");
      } catch (error: any) {
        setApiError(error?.message || copy.loadFailed);
        setSelectedError(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [copy.loadFailed],
  );

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([loadStats(), loadErrors()]);
      if (selectedErrorId) {
        await loadDetail(selectedErrorId);
      }
    } catch (error: any) {
      setApiError(error?.message || copy.loadFailed);
    }
  }, [copy.loadFailed, loadDetail, loadErrors, loadStats, selectedErrorId]);

  useEffect(() => {
    const userDataRaw =
      typeof window !== "undefined" ? localStorage.getItem("user_data") : null;

    if (!userDataRaw) {
      router.replace("/dashboard");
      return;
    }

    try {
      const userData = JSON.parse(userDataRaw);
      const role = String(
        userData?.role || userData?.userType || "",
      ).toLowerCase();

      if (role !== "admin" && role !== "employee") {
        router.replace("/dashboard");
        return;
      }
    } catch {
      router.replace("/dashboard");
      return;
    }

    setAccessChecked(true);
  }, [router]);

  useEffect(() => {
    if (!accessChecked) return;
    refreshAll();
  }, [accessChecked, refreshAll]);

  const handleAction = async (
    action: "resolve" | "ignore" | "note" | "assign",
  ) => {
    if (!selectedErrorId) return;

    const target =
      action === "resolve"
        ? `${API_BASE}/admin/errors/${selectedErrorId}/resolve`
        : action === "ignore"
          ? `${API_BASE}/admin/errors/${selectedErrorId}/ignore`
          : action === "note"
            ? `${API_BASE}/admin/errors/${selectedErrorId}/note`
            : `${API_BASE}/admin/errors/${selectedErrorId}/assign`;

    const body =
      action === "ignore"
        ? { days: 7 }
        : action === "note"
          ? { note: noteInput.trim() }
          : action === "assign"
            ? { user_id: Number(assignUserId) }
            : undefined;

    if (action === "note" && !noteInput.trim()) return;
    if (action === "assign" && !assignUserId.trim()) return;

    setActionLoading(action);
    try {
      const response = await fetch(target, {
        method: "POST",
        headers: getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(copy.loadFailed);
      }

      await refreshAll();
    } catch (error: any) {
      setApiError(error?.message || copy.loadFailed);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyReference = async (row: PlatformError) => {
    if (typeof window === "undefined") return;
    const code = getErrorReferenceCode(row);
    await navigator.clipboard.writeText(code);
  };

  const selectedRecord = selectedError?.error ?? null;
  const friendly = getFriendlyErrorMessage(selectedRecord, locale);

  const updateSort = (sortBy: string) => {
    setFilters((current) => ({
      ...current,
      sortBy,
      sortDir:
        current.sortBy === sortBy && current.sortDir === "desc"
          ? "asc"
          : "desc",
      page: 1,
    }));
  };

  if (!accessChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#003566]" />
      </div>
    );
  }

  return (
    <div className="copied-admin-theme space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F8FBFF] to-[#EFF6FF] p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Operations
            </div>
            <h1 className="mt-3 text-4xl font-serif italic text-[#003566]">
              {copy.title}
            </h1>
            <p className="mt-3 text-sm text-slate-600">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setShowFilters((current) => !current)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {copy.filters}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <Button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="rounded-2xl bg-[#003566] hover:bg-[#00284d]"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              {copy.refresh}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/20 bg-white/85 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {copy.errors24h}
            </p>
            <p className="mt-2 text-3xl font-black text-[#0B1F3A]">
              {stats.errors_last_24h.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {copy.critical}
            </p>
            <p className="mt-2 text-3xl font-black text-rose-700">
              {stats.critical.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {copy.regressions}
            </p>
            <p className="mt-2 text-3xl font-black text-amber-700">
              {stats.regressions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {copy.usersAffected}
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {stats.users_affected.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.search}
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.q}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      q: event.target.value,
                      page: 1,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#003566]"
                />
              </div>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.status}
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.allStatuses}</option>
                <option value="unresolved">{copy.unresolved}</option>
                <option value="resolved">{copy.resolved}</option>
                <option value="ignored">{copy.ignored}</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.level}
              </span>
              <select
                value={filters.level}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    level: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.allLevels}</option>
                <option value="error">error</option>
                <option value="warning">warning</option>
                <option value="fatal">fatal</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.source}
              </span>
              <select
                value={filters.source}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    source: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.allSources}</option>
                {options.projects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.environment}
              </span>
              <select
                value={filters.environment}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    environment: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.allEnvironments}</option>
                {options.environments.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.release}
              </span>
              <select
                value={filters.release}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    release: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.release}</option>
                {options.releases.map((release) => (
                  <option key={release} value={release}>
                    {release}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.category}
              </span>
              <select
                value={filters.category}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    category: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              >
                <option value="">{copy.allCategories}</option>
                {options.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.route}
              </span>
              <input
                value={filters.route}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    route: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.userId}
              </span>
              <input
                value={filters.userId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    userId: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.fromDate}
              </span>
              <input
                type="date"
                value={filters.from}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    from: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {copy.toDate}
              </span>
              <input
                type="date"
                value={filters.to}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    to: event.target.value,
                    page: 1,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566]"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() =>
                setFilters({
                  q: "",
                  status: "",
                  level: "",
                  source: "",
                  environment: "",
                  release: "",
                  route: "",
                  userId: "",
                  category: "",
                  from: "",
                  to: "",
                  sortBy: "last_seen_at",
                  sortDir: "desc",
                  page: 1,
                  perPage: 25,
                })
              }
            >
              {copy.clear}
            </Button>
          </div>
        </div>
      )}

      {apiError && (
        <div className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{apiError}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => updateSort("last_seen_at")}
                    className="font-inherit"
                  >
                    {copy.lastSeen}
                  </button>
                </th>
                <th className="px-5 py-4">{copy.firstSeen}</th>
                <th className="px-5 py-4">{copy.level}</th>
                <th className="px-5 py-4">{copy.source}</th>
                <th className="px-5 py-4">{copy.environment}</th>
                <th className="px-5 py-4">{copy.release}</th>
                <th className="px-5 py-4">Issue</th>
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => updateSort("occurrences_count")}
                    className="font-inherit"
                  >
                    {copy.events}
                  </button>
                </th>
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => updateSort("users_affected")}
                    className="font-inherit"
                  >
                    {copy.affected}
                  </button>
                </th>
                <th className="px-5 py-4">{copy.status}</th>
                <th className="px-5 py-4">{copy.category}</th>
                <th className="px-5 py-4">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#003566]" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-100 text-sm text-slate-600 last:border-b-0",
                      selectedErrorId === row.id && "bg-blue-50/50",
                    )}
                  >
                    <td className="px-5 py-4">
                      {formatDate(row.last_seen_at, locale)}
                    </td>
                    <td className="px-5 py-4">
                      {formatDate(row.first_seen_at, locale)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          levelClasses(row.level),
                        )}
                      >
                        {row.level || "error"}
                      </span>
                    </td>
                    <td className="px-5 py-4">{row.project || "—"}</td>
                    <td className="px-5 py-4">{row.environment || "—"}</td>
                    <td className="px-5 py-4">{row.release || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="max-w-[22rem]">
                        <p className="font-semibold text-[#0B1F3A]">
                          {row.title || row.message}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {row.message}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {Number(row.occurrences_count || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      {Number(row.users_affected || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          statusClasses(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">{row.ai_category || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => loadDetail(row.id)}
                          className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#003566]"
                        >
                          {copy.open}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyReference(row)}
                          className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                          title={copy.copied}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {copy.page} {pagination.current_page} •{" "}
            {pagination.total.toLocaleString()} total • {pagination.per_page}{" "}
            {copy.perPage}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, page: 1 }))}
              disabled={pagination.current_page <= 1}
              className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
              disabled={pagination.current_page <= 1}
              className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.min(
                    pagination.last_page || current.page,
                    current.page + 1,
                  ),
                }))
              }
              disabled={pagination.current_page >= (pagination.last_page || 1)}
              className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: pagination.last_page || current.page,
                }))
              }
              disabled={pagination.current_page >= (pagination.last_page || 1)}
              className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedErrorId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedErrorId(null);
            setSelectedError(null);
          }
        }}
      >
        <DialogContent
          className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-[2rem] border-slate-200 bg-white p-0 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-5xl"
          showCloseButton={true}
        >
          <div className="border-b border-slate-200 bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF] px-6 py-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-[#0B1F3A] dark:text-slate-100">
                <Bot className="h-5 w-5 text-blue-600" />
                {copy.detailTitle}
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400">{copy.detailSubtitle}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-6">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#003566]" />
              </div>
            ) : !selectedRecord ? (
              <div className="py-10 text-center text-sm text-slate-500">
                {copy.noSelection}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/80 lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          levelClasses(selectedRecord.level),
                        )}
                      >
                        {selectedRecord.level || "error"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          statusClasses(selectedRecord.status),
                        )}
                      >
                        {selectedRecord.status}
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-bold text-[#0B1F3A] dark:text-slate-100">
                      {selectedRecord.title || selectedRecord.message}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {selectedRecord.message}
                    </p>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {friendly.referenceCode}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {copy.usersAffected}
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#0B1F3A] dark:text-slate-100">
                      {Number(
                        selectedRecord.users_affected || 0,
                      ).toLocaleString()}
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <p>
                        {copy.lastSeen}:{" "}
                        {formatDate(selectedRecord.last_seen_at, locale)}
                      </p>
                      <p>
                        {copy.firstSeen}:{" "}
                        {formatDate(selectedRecord.first_seen_at, locale)}
                      </p>
                      <p>
                        {copy.release}: {selectedRecord.release || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/40">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                      {copy.userMessage}
                    </p>
                    <h3 className="mt-3 text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                      {friendly.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {friendly.body}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-blue-700">
                      {friendly.referenceCode}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {copy.developerSummary}
                    </p>
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                      {friendly.developerSummary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {copy.category}: {friendly.category}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {selectedRecord.project || "project"}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {selectedRecord.environment || "env"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Tags
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(selectedRecord.tags || {}).length ? (
                        Object.entries(selectedRecord.tags || {}).map(
                          ([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                            >
                              {key}: {String(value)}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          No tags available.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {copy.reports}
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      {(selectedError?.reports || []).length ? (
                        (selectedError?.reports || [])
                          .slice(0, 5)
                          .map((report, index) => (
                            <div
                              key={index}
                              className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-700/50"
                            >
                              <p className="font-semibold text-[#0B1F3A] dark:text-slate-100">
                                {String(
                                  report.title ||
                                    report.type ||
                                    `Report ${index + 1}`,
                                )}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {String(report.message || report.summary || "")}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No related reports.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {copy.addNote}
                  </p>
                  <div className="mt-3 space-y-3">
                    {(selectedRecord.notes || []).length ? (
                      (selectedRecord.notes || []).map((note, index) => (
                        <div
                          key={String(note.id || note.created_at || index)}
                          className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-700/50"
                        >
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            {note.note || "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {note.user?.name || "Internal"} •{" "}
                            {formatDate(note.created_at, locale)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No internal notes yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {copy.payload}
                  </p>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200">
                    {JSON.stringify(
                      redactSensitiveData(
                        selectedRecord.last_event_sample_json || {},
                      ),
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {copy.addNote}
                    </p>
                    <textarea
                      value={noteInput}
                      onChange={(event) => setNoteInput(event.target.value)}
                      placeholder={copy.notePlaceholder}
                      className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#003566] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <Button
                      type="button"
                      onClick={() => handleAction("note")}
                      disabled={actionLoading === "note" || !noteInput.trim()}
                      className="mt-3 rounded-2xl bg-[#003566] hover:bg-[#00284d]"
                    >
                      {actionLoading === "note" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {copy.save}
                    </Button>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {copy.assign}
                    </p>
                    <input
                      value={assignUserId}
                      onChange={(event) => setAssignUserId(event.target.value)}
                      placeholder={copy.assignPlaceholder}
                      className="mt-3 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#003566] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <Button
                      type="button"
                      onClick={() => handleAction("assign")}
                      disabled={
                        actionLoading === "assign" || !assignUserId.trim()
                      }
                      className="mt-3 rounded-2xl bg-[#003566] hover:bg-[#00284d]"
                    >
                      {actionLoading === "assign" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserRound className="mr-2 h-4 w-4" />
                      )}
                      {copy.assign}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-5 dark:border-slate-700 sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() =>
                  selectedRecord && handleCopyReference(selectedRecord)
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => handleAction("resolve")}
                disabled={actionLoading === "resolve"}
              >
                {actionLoading === "resolve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {copy.resolve}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => handleAction("ignore")}
                disabled={actionLoading === "ignore"}
              >
                {actionLoading === "ignore" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {copy.ignore7Days}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                setSelectedErrorId(null);
                setSelectedError(null);
              }}
            >
              {copy.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
