"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Ship,
  UserRound,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rescheduled"
  | string;

type BookingRecord = {
  id: number;
  location_id: number | null;
  boat_id: number | null;
  type?: string | null;
  status?: BookingStatus | null;
  date?: string | null;
  time?: string | null;
  duration_minutes?: number | null;
  name?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  location?: {
    id: number;
    name?: string | null;
    code?: string | null;
  } | null;
  boat?: {
    id: number;
    boat_name?: string | null;
    price?: number | null;
  } | null;
};

type BookingListResponse = {
  data?: BookingRecord[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

type BookingDetailResponse = BookingRecord | { data?: BookingRecord };

type Filters = {
  search: string;
  status: string;
  locationId: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value.slice(0, 5);
  return value;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value?: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeBookingList(payload: BookingListResponse | BookingRecord[]) {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: payload.length,
        total: payload.length,
      },
    };
  }

  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? {
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: 0,
    },
  };
}

function getStatusTone(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "confirmed" || normalized === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalized === "pending") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (normalized === "cancelled") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function DashboardBookingsPage() {
  const t = useTranslations("DashboardBookings");
  const params = useParams<{ locale?: string; role?: string }>();
  const router = useRouter();
  const locale = params?.locale ?? "en";
  const role = params?.role ?? "admin";

  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    locationId: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    search: "",
    status: "",
    locationId: "",
  });
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [meta, setMeta] = useState<BookingListResponse["meta"]>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasLoadedInitialData = useRef(false);
  const loadErrorText = t("errors.load");
  const detailErrorText = t("errors.detail");

  useEffect(() => {
    if (role !== "admin") {
      router.replace(`/${locale}/dashboard/${role}/tasks`);
    }
  }, [locale, role, router]);

  const loadBookings = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        const response = await api.get<BookingListResponse>("/admin/bookings", {
          params: {
            search: appliedFilters.search || undefined,
            status: appliedFilters.status || undefined,
            location_id: appliedFilters.locationId || undefined,
          },
        });

        const normalized = normalizeBookingList(response.data);
        setBookings(normalized.data);
        setMeta(normalized.meta);
      } catch (error) {
        console.error(error);
        setError(loadErrorText);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedFilters.locationId, appliedFilters.search, appliedFilters.status, loadErrorText],
  );

  useEffect(() => {
    if (role !== "admin") return;
    if (hasLoadedInitialData.current) return;
    hasLoadedInitialData.current = true;
    void loadBookings();
  }, [loadBookings, role]);

  useEffect(() => {
    if (role !== "admin") return;
    if (!hasLoadedInitialData.current) return;
    void loadBookings();
  }, [appliedFilters, loadBookings, role]);

  const openBooking = useCallback(
    async (bookingId: number) => {
      setDetailLoading(true);
      setDetailOpen(true);
      try {
        const response = await api.get<BookingDetailResponse>(
          `/admin/bookings/${bookingId}`,
        );
        const detail =
          "data" in response.data && response.data.data
            ? response.data.data
            : (response.data as BookingRecord);
        setSelectedBooking(detail);
      } catch (error) {
        console.error(error);
        toast.error(detailErrorText);
        setDetailOpen(false);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailErrorText],
  );

  const stats = useMemo(() => {
    const total = meta?.total ?? bookings.length;
    const confirmed = bookings.filter(
      (booking) => (booking.status || "").toLowerCase() === "confirmed",
    ).length;
    const pending = bookings.filter(
      (booking) => (booking.status || "").toLowerCase() === "pending",
    ).length;
    const todaysDate = new Date().toISOString().slice(0, 10);
    const today = bookings.filter((booking) => booking.date === todaysDate).length;

    return { total, confirmed, pending, today };
  }, [bookings, meta?.total]);

  const hasActiveFilters = Boolean(
    appliedFilters.search || appliedFilters.status || appliedFilters.locationId,
  );

  return (
    <div className="copied-admin-theme space-y-8">
      <Toaster position="top-right" />

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#EAF3FF] px-6 py-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:px-8">
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
            onClick={() => void loadBookings(true)}
            disabled={refreshing}
            className="h-12 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("filters.apply")}
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.total")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {stats.total}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.confirmed")}
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {stats.confirmed}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.pending")}
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {stats.pending}
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {t("stats.today")}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
              {stats.today}
            </p>
          </div>
        </div>
      </section>

      {error && !loading ? (
        <div className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_220px_220px_auto_auto]">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {t("filters.search")}
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder={t("filters.searchPlaceholder")}
                  className="h-11 rounded-2xl border-slate-200 pl-9 text-sm text-slate-700"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {t("filters.status")}
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
              >
                <option value="">{t("filters.allStatuses")}</option>
                <option value="pending">{t("statuses.pending")}</option>
                <option value="confirmed">{t("statuses.confirmed")}</option>
                <option value="completed">{t("statuses.completed")}</option>
                <option value="cancelled">{t("statuses.cancelled")}</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {t("filters.locationId")}
              </span>
              <Input
                value={filters.locationId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    locationId: event.target.value,
                  }))
                }
                placeholder={t("filters.locationPlaceholder")}
                className="h-11 rounded-2xl border-slate-200 text-sm text-slate-700"
                inputMode="numeric"
              />
            </label>

            <Button
              type="button"
              variant="outline"
              className="mt-auto h-11 rounded-2xl border-slate-200"
              onClick={() => {
                setFilters({
                  search: "",
                  status: "",
                  locationId: "",
                });
                setAppliedFilters({
                  search: "",
                  status: "",
                  locationId: "",
                });
              }}
            >
              {t("filters.reset")}
            </Button>
            <Button
              type="button"
              className="mt-auto h-11 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
              onClick={() => {
                setAppliedFilters(filters);
                void loadBookings(true);
              }}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("filters.apply")}
            </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            {t("resultsSummary", {
              total: String(meta?.total ?? bookings.length),
            })}
          </p>
          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              {appliedFilters.search ? (
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  {t("activeFilters.search", { value: appliedFilters.search })}
                </span>
              ) : null}
              {appliedFilters.status ? (
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  {t("activeFilters.status", {
                    value: t(`statuses.${appliedFilters.status}`),
                  })}
                </span>
              ) : null}
              {appliedFilters.locationId ? (
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  {t("activeFilters.location", { value: appliedFilters.locationId })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1fr)_170px_140px_120px] gap-4 border-b border-[#E5EEFB] bg-[#F8FBFF] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7C94B8] lg:grid">
            <span>{t("table.id")}</span>
            <span>{t("table.guest")}</span>
            <span>{t("table.boat")}</span>
            <span>{t("table.schedule")}</span>
            <span>{t("table.status")}</span>
            <span>{t("table.action")}</span>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
                <span>{t("table.loading")}</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[#0B1F3A]">
                  {t("errorState.title")}
                </h2>
                <p className="max-w-md text-sm text-slate-500">
                  {t("errorState.description")}
                </p>
              </div>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
                onClick={() => void loadBookings(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("errorState.retry")}
              </Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
              <CalendarDays className="h-10 w-10 text-slate-300" />
              <h2 className="text-lg font-semibold text-[#0B1F3A]">
                {t("empty.title")}
              </h2>
              <p className="max-w-md text-sm text-slate-500">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5EEFB]">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="grid gap-4 px-5 py-4 text-sm text-slate-600 lg:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1fr)_170px_140px_120px] lg:items-center"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.id")}
                    </p>
                    <p className="text-sm font-semibold text-[#0B1F3A]">
                      #{booking.id}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.guest")}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>{booking.name || "—"}</span>
                    </div>
                    <p className="text-sm text-slate-500">{booking.email || "—"}</p>
                    <p className="text-xs text-slate-400">
                      {(booking.location?.name || "—") +
                        (booking.location?.code
                          ? ` • ${booking.location.code}`
                          : "")}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.boat")}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
                      <Ship className="h-4 w-4 text-slate-400" />
                      <span>{booking.boat?.boat_name || "—"}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(booking.boat?.price ?? null)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                      {booking.type || "—"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.schedule")}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      <span>{formatDate(booking.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      <span>
                        {formatTime(booking.time)}
                        {booking.duration_minutes
                          ? ` • ${booking.duration_minutes}m`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.status")}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusTone(
                        booking.status,
                      )}`}
                    >
                      {booking.status
                        ? t(
                            `statuses.${booking.status.toLowerCase()}`,
                            { default: booking.status },
                          )
                        : "—"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                      {t("table.action")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-2xl border-slate-200"
                      onClick={() => void openBooking(booking.id)}
                    >
                      {t("table.view")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-[#0B1F3A]">
              {selectedBooking
                ? t("detail.titleWithId", { id: selectedBooking.id })
                : t("detail.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {t("detail.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            {detailLoading || !selectedBooking ? (
              <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
                <span>{t("detail.loading")}</span>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("detail.guest")}
                  </h3>
                  <div className="space-y-2 text-sm text-[#0B1F3A]">
                    <p>
                      <span className="font-semibold">{t("detail.name")}:</span>{" "}
                      {selectedBooking.name || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.email")}:</span>{" "}
                      {selectedBooking.email || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.source")}:</span>{" "}
                      {selectedBooking.source || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("detail.appointment")}
                  </h3>
                  <div className="space-y-2 text-sm text-[#0B1F3A]">
                    <p>
                      <span className="font-semibold">{t("detail.date")}:</span>{" "}
                      {formatDate(selectedBooking.date)}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.time")}:</span>{" "}
                      {formatTime(selectedBooking.time)}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.duration")}:</span>{" "}
                      {selectedBooking.duration_minutes
                        ? `${selectedBooking.duration_minutes}m`
                        : "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.status")}:</span>{" "}
                      {selectedBooking.status
                        ? t(
                            `statuses.${selectedBooking.status.toLowerCase()}`,
                            { default: selectedBooking.status },
                          )
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("detail.location")}
                  </h3>
                  <div className="space-y-2 text-sm text-[#0B1F3A]">
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{selectedBooking.location?.name || "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.locationCode")}:</span>{" "}
                      {selectedBooking.location?.code || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("detail.boat")}
                  </h3>
                  <div className="space-y-2 text-sm text-[#0B1F3A]">
                    <p>
                      <span className="font-semibold">{t("detail.boatName")}:</span>{" "}
                      {selectedBooking.boat?.boat_name || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.price")}:</span>{" "}
                      {formatCurrency(selectedBooking.boat?.price ?? null)}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.type")}:</span>{" "}
                      {selectedBooking.type || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("detail.notes")}
                  </h3>
                  <p className="text-sm leading-6 text-[#0B1F3A]">
                    {selectedBooking.notes || t("detail.noNotes")}
                  </p>
                  <div className="grid gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400 md:grid-cols-2">
                    <p>
                      <span className="font-semibold">{t("detail.createdAt")}:</span>{" "}
                      {formatDateTime(selectedBooking.created_at)}
                    </p>
                    <p>
                      <span className="font-semibold">{t("detail.updatedAt")}:</span>{" "}
                      {formatDateTime(selectedBooking.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
