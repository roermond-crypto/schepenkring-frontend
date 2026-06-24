"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
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
  clients_total: number;
  staff_total: number;
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

type FormState = {
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
};

const EMPTY_FORM: FormState = { name: "", code: "", status: "ACTIVE" };

const IMPACT_LABELS: Record<string, string> = {
  boats:                     "Boten",
  yachts:                    "Jachten",
  clients:                   "Klanten",
  staff_assignments:         "Medewerkers",
  leads:                     "Leads",
  conversations:             "Chats",
  tasks:                     "Taken",
  boards:                    "Borden",
  sign_requests:             "Ondertekeningsverzoeken",
  harbor_channels:           "Kanalen",
  call_sessions:             "Belsessies",
  columns:                   "Kolommen",
  task_automations:          "Automatiseringen",
  task_automation_templates: "Automatiseringstemplates",
};

// ── Component ─────────────────────────────────────────────────────

export function AdminLocationsManagerPage({
  locale,
  role,
}: {
  locale: string;
  role: string;
}) {
  const isNl = locale === "nl";

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [archivedLocations, setArchivedLocations] = useState<ArchivedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showArchived, setShowArchived] = useState(false);

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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
      toast.error(isNl ? "Locaties laden mislukt." : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, [isNl]);

  useEffect(() => { void loadLocations(); }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter((l) => {
      const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
      const matchesSearch = !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [locations, search, statusFilter]);

  // ── Create / Edit ───────────────────────────────────────────────

  const resetDialog = () => {
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(false);
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      status: form.status,
    };
    if (!payload.name || !payload.code) {
      toast.error(isNl ? "Naam en code zijn verplicht." : "Name and code are required.");
      return;
    }
    setSaving(true);
    try {
      if (editingLocation) {
        await api.patch(`/admin/locations/${editingLocation.id}`, payload);
        toast.success(isNl ? "Locatie bijgewerkt." : "Location updated.");
      } else {
        await api.post("/admin/locations", payload);
        toast.success(isNl ? "Locatie aangemaakt." : "Location created.");
      }
      resetDialog();
      await loadLocations();
    } catch {
      toast.error(isNl ? "Opslaan mislukt." : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

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
      toast.error(isNl ? "Impact ophalen mislukt." : "Failed to load impact.");
      setDeleteTarget(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const closeDeleteFlow = () => {
    setDeleteTarget(null);
    setImpactData(null);
    setDeleteSuccess(false);
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
      toast.error(isNl ? "Verzoek indienen mislukt." : "Failed to submit request.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Restore ─────────────────────────────────────────────────────

  const handleRestore = async (loc: ArchivedLocation) => {
    try {
      await api.post(`/admin/locations/${loc.id}/restore`);
      toast.success(isNl ? `${loc.name} hersteld.` : `${loc.name} restored.`);
      await loadLocations();
    } catch {
      toast.error(isNl ? "Herstellen mislukt." : "Restore failed.");
    }
  };

  // ── Permanent delete ────────────────────────────────────────────

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      await api.delete(`/admin/locations/${permanentTarget.id}/permanent`);
      toast.success(isNl ? `${permanentTarget.name} permanent verwijderd.` : `${permanentTarget.name} permanently deleted.`);
      setPermanentTarget(null);
      await loadLocations();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg || (isNl ? "Permanent verwijderen mislukt." : "Permanent delete failed."));
    } finally {
      setPermanentDeleting(false);
    }
  };

  const fmt = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(isNl ? "nl-NL" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  };

  // ── Impact summary helper ───────────────────────────────────────

  const ImpactRow = ({ label, count }: { label: string; count: number }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", count > 0 ? "text-red-600" : "text-slate-300")}>
        {count}
      </span>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-2 sm:p-2 lg:p-2">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="rounded-[28px] border border-[#C9D8EE] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(135deg,#F7FBFF_0%,#EDF4FF_52%,#E4EEF9_100%)] p-8 text-[#0B1F3A] shadow-[0_20px_60px_rgba(15,39,74,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-blue-700">
              {isNl ? "Admin locaties" : "Admin locations"}
            </p>
            <h1 className="mt-3 text-4xl font-serif italic sm:text-5xl">
              {isNl ? "Maak en beheer locaties" : "Create and manage locations"}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              {isNl
                ? "Locaties kunnen niet direct worden verwijderd. Een verwijderingsverzoek vereist goedkeuring per e-mail."
                : "Locations cannot be deleted directly. A deletion request requires e-mail approval."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 bg-white text-slate-700"
              onClick={() => void loadLocations()}
            >
              <RefreshCcw className={loading ? "animate-spin" : ""} />
              {isNl ? "Verversen" : "Refresh"}
            </Button>
            <Button asChild className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]">
              <Link href={widgetHref}>
                <LayoutTemplate />
                {isNl ? "Widget-instellingen" : "Widget settings"}
              </Link>
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
              onClick={() => { setEditingLocation(null); setForm(EMPTY_FORM); setIsDialogOpen(true); }}
            >
              <Plus />
              {isNl ? "Locatie aanmaken" : "Create location"}
            </Button>
            {archivedLocations.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className={cn("rounded-xl", showArchived && "bg-amber-50 border-amber-200 text-amber-700")}
                onClick={() => setShowArchived((v) => !v)}
              >
                <ArchiveRestore />
                {isNl ? `Gearchiveerd (${archivedLocations.length})` : `Archived (${archivedLocations.length})`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Archived locations panel */}
      {showArchived && archivedLocations.length > 0 && (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.28em] text-amber-700">
            {isNl ? "Gearchiveerde locaties" : "Archived locations"}
          </p>
          <div className="space-y-3">
            {archivedLocations.map((loc) => {
              const total = Object.values(loc.impact).reduce((s, n) => s + n, 0);
              return (
                <div key={loc.id} className="flex items-start justify-between rounded-xl border border-amber-200 bg-white p-4">
                  <div>
                    <p className="font-semibold text-slate-900">{loc.name} <span className="text-xs text-slate-400 font-normal">({loc.code})</span></p>
                    {loc.delete_reason && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isNl ? "Reden:" : "Reason:"} {loc.delete_reason}
                      </p>
                    )}
                    {loc.deleted_by && (
                      <p className="text-xs text-slate-400">
                        {isNl ? "Door:" : "By:"} {loc.deleted_by} — {fmt(loc.deleted_at)}
                      </p>
                    )}
                    {total > 0 && (
                      <p className="mt-1 text-xs text-red-500">
                        {isNl ? `Nog ${total} gekoppelde records` : `${total} linked records remain`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => void handleRestore(loc)}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
                      {isNl ? "Herstellen" : "Restore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setPermanentTarget(loc)}
                      disabled={total > 0}
                      title={total > 0 ? (isNl ? "Verwijder eerst alle gekoppelde records" : "Remove all linked records first") : undefined}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {isNl ? "Permanent" : "Permanent"}
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isNl ? "Zoek op naam of code..." : "Search by name or code..."}
          className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
          className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400"
        >
          <option value="ALL">{isNl ? "Alle statussen" : "All statuses"}</option>
          <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
          <option value="INACTIVE">{isNl ? "Inactief" : "Inactive"}</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_minmax(0,1.3fr)_140px_180px_120px] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
          <span>{isNl ? "Locatie" : "Location"}</span>
          <span>Code</span>
          <span>{isNl ? "Medewerkers" : "Employees"}</span>
          <span>Status</span>
          <span>{isNl ? "Bijgewerkt" : "Updated"}</span>
          <span className="text-right">{isNl ? "Acties" : "Actions"}</span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {isNl ? "Locaties laden..." : "Loading locations..."}
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {isNl ? "Geen locaties gevonden." : "No locations found."}
          </div>
        ) : (
          filteredLocations.map((location) => (
            <div
              key={location.id}
              className="grid grid-cols-[minmax(0,2fr)_120px_minmax(0,1.3fr)_140px_180px_120px] gap-4 border-b border-slate-100 px-6 py-5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{location.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {location.boats_total} boten · {location.yachts_total} jachten · {location.open_leads} leads
                    </p>
                  </div>
                </div>
              </div>

              <div className="self-center text-sm font-semibold text-slate-700">{location.code}</div>

              <div className="self-center text-sm text-slate-700">
                <p className="font-semibold">
                  {(location.employee_count ?? location.employees?.length ?? 0)}{" "}
                  {isNl ? "gekoppeld" : "assigned"}
                </p>
                {location.employees && location.employees.length > 0 ? (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {location.employees.map((e) => e.name).join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    {isNl ? "Geen medewerkers" : "No employees"}
                  </p>
                )}
              </div>

              <div className="self-center">
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                    location.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {location.status === "ACTIVE" ? (isNl ? "Actief" : "Active") : (isNl ? "Inactief" : "Inactive")}
                </span>
              </div>

              <div className="self-center text-sm text-slate-600">{fmt(location.updated_at)}</div>

              <div className="flex items-center justify-end gap-2 self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => {
                    setEditingLocation(location);
                    setForm({ name: location.name, code: location.code, status: location.status });
                    setIsDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void openDeleteFlow(location)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create / Edit Dialog ───────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#003566]">
                {editingLocation ? (isNl ? "Locatie bewerken" : "Edit location") : (isNl ? "Locatie aanmaken" : "Create location")}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                {isNl
                  ? "Maak en beheer locaties voor registratie, scope en operationeel gebruik."
                  : "Create and manage locations for registration, scoping, and operations."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={isNl ? "Locatienaam" : "Location name"}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-400"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="Code"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm uppercase outline-none transition focus:border-blue-400"
                />
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-400"
                >
                  <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
                  <option value="INACTIVE">{isNl ? "Inactief" : "Inactive"}</option>
                </select>
              </div>
            </div>

            <DialogFooter className="mt-8">
              <Button type="button" variant="outline" className="rounded-xl" onClick={resetDialog} disabled={saving}>
                {isNl ? "Annuleren" : "Cancel"}
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                {saving ? (isNl ? "Opslaan..." : "Saving...") : editingLocation ? (isNl ? "Bijwerken" : "Update") : (isNl ? "Aanmaken" : "Create")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete request Dialog ──────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) closeDeleteFlow(); }}>
        <DialogContent className="max-w-lg rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            {/* Success screen */}
            {deleteSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {isNl ? "Verzoek ingediend" : "Request submitted"}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                  {isNl
                    ? "Alle admins ontvangen een e-mail om het verwijderingsverzoek goed te keuren of te annuleren. De link is 24 uur geldig."
                    : "All admins will receive an e-mail to approve or cancel the deletion request. The link is valid for 24 hours."}
                </p>
                <Button className="rounded-xl bg-[#003566] text-white" onClick={closeDeleteFlow}>
                  {isNl ? "Sluiten" : "Close"}
                </Button>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <DialogTitle className="text-xl text-slate-900">
                      {isNl ? "Locatie verwijderen" : "Delete location"}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-slate-500 text-sm">
                    {isNl
                      ? `Een verwijdering van "${deleteTarget?.name}" vereist goedkeuring per e-mail. Directe verwijdering is niet mogelijk.`
                      : `Deleting "${deleteTarget?.name}" requires e-mail approval. Immediate deletion is not possible.`}
                  </DialogDescription>
                </DialogHeader>

                {impactLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin h-6 w-6 text-slate-400" />
                    <span className="ml-3 text-sm text-slate-500">{isNl ? "Impact ophalen..." : "Loading impact..."}</span>
                  </div>
                ) : impactData ? (
                  <div className="mt-5 space-y-4">
                    {/* Impact analysis */}
                    <div className={cn(
                      "rounded-xl border p-4",
                      impactData.total_linked_records > 0
                        ? "border-red-200 bg-red-50"
                        : "border-emerald-200 bg-emerald-50"
                    )}>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-wider mb-2",
                        impactData.total_linked_records > 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {isNl ? "Gekoppelde gegevens" : "Linked records"}
                      </p>
                      {impactData.total_linked_records === 0 ? (
                        <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {isNl ? "Geen gekoppelde gegevens gevonden." : "No linked records found."}
                        </p>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            {Object.entries(impactData.impact)
                              .filter(([, count]) => count > 0)
                              .map(([key, count]) => (
                                <ImpactRow key={key} label={IMPACT_LABELS[key] ?? key} count={count} />
                              ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-red-200 flex justify-between">
                            <span className="text-xs font-bold text-red-700">{isNl ? "Totaal" : "Total"}</span>
                            <span className="text-xs font-bold text-red-700 tabular-nums">{impactData.total_linked_records}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Move records option */}
                    {impactData.total_linked_records > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          {isNl ? "Records verplaatsen naar (optioneel)" : "Move records to (optional)"}
                        </label>
                        <select
                          value={moveToLocationId}
                          onChange={(e) => setMoveToLocationId(e.target.value ? Number(e.target.value) : "")}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                        >
                          <option value="">{isNl ? "— Niet verplaatsen —" : "— Do not move —"}</option>
                          {locations
                            .filter((l) => l.id !== deleteTarget?.id)
                            .map((l) => (
                              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-400">
                          {isNl
                            ? "Boten, jachten, chats en leads worden verplaatst bij goedkeuring."
                            : "Boats, yachts, chats and leads will be moved upon approval."}
                        </p>
                      </div>
                    )}

                    {/* Proceed to reason */}
                    {deleteStep === "impact" && (
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" className="rounded-xl" onClick={closeDeleteFlow}>
                          {isNl ? "Annuleren" : "Cancel"}
                        </Button>
                        <Button
                          className="rounded-xl bg-red-600 text-white hover:bg-red-700"
                          onClick={() => setDeleteStep("reason")}
                        >
                          {isNl ? "Doorgaan" : "Continue"}
                        </Button>
                      </div>
                    )}

                    {/* Reason step */}
                    {deleteStep === "reason" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            {isNl ? "Reden voor verwijdering *" : "Reason for deletion *"}
                          </label>
                          <textarea
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder={isNl ? "Bijv. dubbele locatie, fout aangemaakt..." : "e.g. duplicate location, created by mistake..."}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none"
                          />
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                          <p className="font-bold mb-0.5">{isNl ? "Wat er daarna gebeurt:" : "What happens next:"}</p>
                          <ul className="space-y-0.5 list-disc list-inside text-amber-600">
                            <li>{isNl ? "Alle admins ontvangen een goedkeurings-e-mail" : "All admins receive an approval e-mail"}</li>
                            <li>{isNl ? "Na goedkeuring wordt de locatie gearchiveerd" : "After approval the location is archived"}</li>
                            <li>{isNl ? "De link verloopt na 24 uur" : "The link expires after 24 hours"}</li>
                            <li>{isNl ? "Herstel is altijd mogelijk via Gearchiveerd" : "Restore is always possible via Archived"}</li>
                          </ul>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => setDeleteStep("impact")}>
                            {isNl ? "Terug" : "Back"}
                          </Button>
                          <Button
                            className="rounded-xl bg-red-600 text-white hover:bg-red-700"
                            onClick={() => void submitDeleteRequest()}
                            disabled={deleteSubmitting || !deleteReason.trim()}
                          >
                            {deleteSubmitting ? (
                              <><Loader2 className="animate-spin h-4 w-4 mr-2" />{isNl ? "Versturen..." : "Sending..."}</>
                            ) : (
                              isNl ? "Verzoek indienen" : "Submit request"
                            )}
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
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl text-slate-900">
                  {isNl ? "Permanent verwijderen?" : "Delete permanently?"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm text-slate-500">
                {isNl
                  ? `"${permanentTarget?.name}" wordt onherroepelijk verwijderd uit de database. Dit kan niet ongedaan worden gemaakt.`
                  : `"${permanentTarget?.name}" will be permanently removed from the database. This cannot be undone.`}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6">
              <Button variant="outline" className="rounded-xl" onClick={() => setPermanentTarget(null)}>
                {isNl ? "Annuleren" : "Cancel"}
              </Button>
              <Button
                className="rounded-xl bg-red-600 text-white hover:bg-red-700"
                onClick={() => void handlePermanentDelete()}
                disabled={permanentDeleting}
              >
                {permanentDeleting ? (
                  <><Loader2 className="animate-spin h-4 w-4 mr-2" />{isNl ? "Verwijderen..." : "Deleting..."}</>
                ) : (
                  isNl ? "Permanent verwijderen" : "Delete permanently"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
