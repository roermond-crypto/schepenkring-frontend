"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Anchor,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

type LocationRecord = {
  id: number;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  public_visible?: boolean;
  location_color?: string | null;
  city?: string | null;
  phone?: string | null;
  employee_count?: number;
  employees?: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    location_role?: string | null;
  }>;
  boats_total: number;
  yachts_total: number;
  open_leads: number;
  open_conversations: number;
  open_tasks: number;
  created_at: string;
  updated_at: string;
};

type ArchivedLocation = {
  id: number;
  name: string;
  code: string;
  status: string;
  deleted_at: string;
  deleted_by: string | null;
  delete_reason: string | null;
  impact: Record<string, number>;
};

type ImpactData = {
  location_id: number;
  location_name: string;
  impact: Record<string, number>;
  total_linked_records: number;
  safe_to_delete: boolean;
};

// ── Component ─────────────────────────────────────────────────────

export function AdminLocationsManagerPage({
  locale,
  role,
}: {
  locale: string;
  role: string;
}) {
  const t = useTranslations("AdminLocations");

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [archivedLocations, setArchivedLocations] = useState<ArchivedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showArchived, setShowArchived] = useState(false);

  // Delete flow
  const [deleteTarget, setDeleteTarget] = useState<LocationRecord | null>(null);
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"impact" | "reason">("impact");
  const [deleteReason, setDeleteReason] = useState("");
  const [moveToLocationId, setMoveToLocationId] = useState<number | "">("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Restore / permanent delete
  const [permanentTarget, setPermanentTarget] = useState<ArchivedLocation | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const widgetHref = `/${locale}/dashboard/${role}/locations/widget`;

  // ── Data loading ────────────────────────────────────────────────

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        api.get("/admin/locations", { params: { include_inactive: true } }),
        api.get("/admin/locations/archived"),
      ]);
      setLocations(Array.isArray(activeRes.data?.data) ? activeRes.data.data : []);
      setArchivedLocations(Array.isArray(archivedRes.data?.data) ? archivedRes.data.data : []);
    } catch {
      toast.error(t("loadLocationsFailed"));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadLocations(); }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter((l) => {
      const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
      const matchesSearch = !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [locations, search, statusFilter]);

  // ── Delete flow ─────────────────────────────────────────────────

  const openDeleteFlow = async (location: LocationRecord) => {
    setDeleteTarget(location);
    setDeleteStep("impact");
    setDeleteReason("");
    setMoveToLocationId("");
    setDeleteSuccess(false);
    setImpactLoading(true);
    setImpactData(null);
    try {
      const res = await api.get(`/admin/locations/${location.id}/impact`);
      setImpactData(res.data as ImpactData);
    } catch {
      toast.error(t("loadImpactFailed"));
      setDeleteTarget(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (!deleteTarget || !deleteReason.trim()) return;
    setDeleteSubmitting(true);
    try {
      await api.post(`/admin/locations/${deleteTarget.id}/request-delete`, {
        reason: deleteReason.trim(),
        move_to_location_id: moveToLocationId || null,
      });
      setDeleteSuccess(true);
      await loadLocations();
    } catch {
      toast.error(t("submitRequestFailed"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Restore / permanent delete ──────────────────────────────────

  const handleRestore = async (loc: ArchivedLocation) => {
    try {
      await api.post(`/admin/locations/${loc.id}/restore`);
      toast.success(t("locationRestored", { name: loc.name }));
      await loadLocations();
    } catch {
      toast.error(t("restoreFailed"));
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      await api.delete(`/admin/locations/${permanentTarget.id}/permanent`);
      toast.success(t("locationPermanentlyDeleted", { name: permanentTarget.name }));
      setPermanentTarget(null);
      await loadLocations();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      toast.error(msg ?? t("permanentDeleteFailed"));
    } finally {
      setPermanentDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────

  const fmt = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
  };

  const ImpactRow = ({ label, count }: { label: string; count: number }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", count > 0 ? "text-red-600" : "text-slate-300")}>{count}</span>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-2 sm:p-2 lg:p-2">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="rounded-[28px] border border-[#C9D8EE] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(135deg,#F7FBFF_0%,#EDF4FF_52%,#E4EEF9_100%)] p-8 text-[#0B1F3A] shadow-[0_20px_60px_rgba(15,39,74,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-blue-700">
              {t("adminLocationsLabel")}
            </p>
            <h1 className="mt-3 text-4xl font-serif italic sm:text-5xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              {t("pageSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700" onClick={() => void loadLocations()}>
              <RefreshCcw className={loading ? "animate-spin" : ""} />
              {t("refresh")}
            </Button>
            <Button asChild className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]">
              <Link href={widgetHref}><LayoutTemplate />{t("widgetSettings")}</Link>
            </Button>
            <Button asChild className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]">
              <Link href={`/${locale}/dashboard/${role}/locations/new`}>
                <Plus />{t("createLocation")}
              </Link>
            </Button>
            {archivedLocations.length > 0 && (
              <Button type="button" variant="outline" className={cn("rounded-xl", showArchived && "bg-amber-50 border-amber-200 text-amber-700")} onClick={() => setShowArchived((v) => !v)}>
                <ArchiveRestore />{t("archivedCount", { count: archivedLocations.length })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Archived panel */}
      {showArchived && archivedLocations.length > 0 && (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.28em] text-amber-700">
            {t("archivedLocations")}
          </p>
          <div className="space-y-3">
            {archivedLocations.map((loc) => {
              const total = Object.values(loc.impact).reduce((s, n) => s + n, 0);
              return (
                <div key={loc.id} className="flex items-start justify-between rounded-xl border border-amber-200 bg-white p-4">
                  <div>
                    <p className="font-semibold text-slate-900">{loc.name} <span className="text-xs text-slate-400 font-normal">({loc.code})</span></p>
                    {loc.delete_reason && <p className="mt-0.5 text-xs text-slate-500">{t("reason")} {loc.delete_reason}</p>}
                    {loc.deleted_by && <p className="text-xs text-slate-400">{t("by")} {loc.deleted_by} — {fmt(loc.deleted_at)}</p>}
                    {total > 0 && <p className="mt-1 text-xs text-red-500">{t("linkedRecordsRemain", { count: total })}</p>}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <Button size="sm" variant="outline" className="rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => void handleRestore(loc)}>
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1" />{t("restore")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-red-600 border-red-200 hover:bg-red-50" onClick={() => setPermanentTarget(loc)} disabled={total > 0} title={total > 0 ? t("removeLinkedFirst") : undefined}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />{t("permanent")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & filter */}
      <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")} className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400">
          <option value="ALL">{t("allStatuses")}</option>
          <option value="ACTIVE">{t("active")}</option>
          <option value="INACTIVE">{t("inactive")}</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,2fr)_100px_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_180px_120px] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
          <span>{t("location")}</span>
          <span>Code</span>
          <span>{t("address")}</span>
          <span>{t("employees")}</span>
          <span>Status</span>
          <span>{t("updated")}</span>
          <span className="text-right">{t("actions")}</span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">{t("loadingLocations")}</div>
        ) : filteredLocations.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">{t("noLocations")}</div>
        ) : (
          filteredLocations.map((location) => (
            <div key={location.id} className="grid grid-cols-[minmax(0,2fr)_100px_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_180px_120px] gap-4 border-b border-slate-100 px-6 py-5 last:border-b-0">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{location.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{location.boats_total} {t("boats")} · {location.yachts_total} {t("yachts")} · {location.open_leads} leads</p>
                  </div>
                </div>
              </div>
              <div className="self-center text-sm font-semibold text-slate-700">{location.code}</div>
              <div className="self-center min-w-0">
                {location.city ? (
                  <p className="truncate text-sm text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />{location.city}
                  </p>
                ) : (
                  <p className="text-xs text-slate-300 italic">{t("noAddress")}</p>
                )}
                {location.phone && <p className="truncate text-xs text-slate-500 mt-0.5">{location.phone}</p>}
              </div>
              <div className="self-center text-sm text-slate-700">
                <p className="font-semibold">{(location.employee_count ?? location.employees?.length ?? 0)} {t("linked")}</p>
                {location.employees && location.employees.length > 0 ? (
                  <p className="mt-1 truncate text-xs text-slate-500">{location.employees.map((e) => e.name).join(", ")}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">{t("noEmployees")}</p>
                )}
              </div>
              <div className="self-center">
                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", location.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>
                  {location.status === "ACTIVE" ? t("active") : t("inactive")}
                </span>
              </div>
              <div className="self-center text-sm text-slate-600">{fmt(location.updated_at)}</div>
              <div className="flex items-center justify-end gap-2 self-center">
                <Button asChild type="button" variant="outline" size="icon" className="rounded-xl" title={t("locationDetail")}>
                  <Link href={`/${locale}/dashboard/${role}/locations/${location.id}`}>
                    <Users />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="rounded-xl" title={t("editLocation")}>
                  <Link href={`/${locale}/dashboard/${role}/locations/${location.id}/edit`}>
                    <Pencil />
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="icon" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void openDeleteFlow(location)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Delete request Dialog ──────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setImpactData(null); setDeleteSuccess(false); } }}>
        <DialogContent className="max-w-lg rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            {deleteSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">{t("requestSubmitted")}</h2>
                <p className="text-sm text-slate-500 mb-6">{t("requestSubmittedDesc")}</p>
                <Button className="rounded-xl bg-[#003566] text-white" onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }}>{t("close")}</Button>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
                    <DialogTitle className="text-xl text-slate-900">{t("deleteLocation")}</DialogTitle>
                  </div>
                  <DialogDescription className="text-slate-500 text-sm">{t("deleteConfirmDesc", { name: deleteTarget?.name ?? "" })}</DialogDescription>
                </DialogHeader>

                {impactLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin h-6 w-6 text-slate-400" /><span className="ml-3 text-sm text-slate-500">{t("loadingImpact")}</span>
                  </div>
                ) : impactData ? (
                  <div className="mt-5 space-y-4">
                    <div className={cn("rounded-xl border p-4", impactData.total_linked_records > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-wider mb-2", impactData.total_linked_records > 0 ? "text-red-600" : "text-emerald-600")}>{t("linkedRecords")}</p>
                      {impactData.total_linked_records === 0 ? (
                        <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{t("noLinkedRecords")}</p>
                      ) : (
                        <>
                          <div className="space-y-0.5">{Object.entries(impactData.impact).filter(([, c]) => c > 0).map(([k, c]) => <ImpactRow key={k} label={t(`impact_${k}` as Parameters<typeof t>[0]) || k} count={c} />)}</div>
                          <div className="mt-3 pt-3 border-t border-red-200 flex justify-between"><span className="text-xs font-bold text-red-700">{t("total")}</span><span className="text-xs font-bold text-red-700 tabular-nums">{impactData.total_linked_records}</span></div>
                        </>
                      )}
                    </div>

                    {impactData.total_linked_records > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t("moveRecords")}</label>
                        <select value={moveToLocationId} onChange={(e) => setMoveToLocationId(e.target.value ? Number(e.target.value) : "")} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                          <option value="">{t("doNotMove")}</option>
                          {locations.filter((l) => l.id !== deleteTarget?.id).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                        </select>
                      </div>
                    )}

                    {deleteStep === "impact" && (
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" className="rounded-xl" onClick={() => { setDeleteTarget(null); setImpactData(null); }}>{t("cancel")}</Button>
                        <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => setDeleteStep("reason")}>{t("continue")}</Button>
                      </div>
                    )}

                    {deleteStep === "reason" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t("reasonForDeletion")}</label>
                          <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder={t("reasonPlaceholder")} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none" />
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                          <p className="font-bold mb-0.5">{t("whatHappensNext")}</p>
                          <ul className="space-y-0.5 list-disc list-inside text-amber-600">
                            <li>{t("step1")}</li>
                            <li>{t("step2")}</li>
                            <li>{t("step3")}</li>
                          </ul>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => setDeleteStep("impact")}>{t("back")}</Button>
                          <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => void submitDeleteRequest()} disabled={deleteSubmitting || !deleteReason.trim()}>
                            {deleteSubmitting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />{t("sending")}</> : t("submitRequest")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Permanent delete confirmation ─────────────────────────── */}
      <Dialog open={permanentTarget !== null} onOpenChange={(open) => { if (!open) setPermanentTarget(null); }}>
        <DialogContent className="max-w-md rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600"><XCircle className="h-5 w-5" /></div>
                <DialogTitle className="text-xl text-slate-900">{t("deletePermanentlyTitle")}</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-slate-500">{t("deletePermanentlyDesc", { name: permanentTarget?.name ?? "" })}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button variant="outline" className="rounded-xl" onClick={() => setPermanentTarget(null)}>{t("cancel")}</Button>
              <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => void handlePermanentDelete()} disabled={permanentDeleting}>
                {permanentDeleting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />{t("deleting")}</> : t("deletePermanently")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
