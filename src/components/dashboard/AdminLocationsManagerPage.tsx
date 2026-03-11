"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  LayoutTemplate,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type LocationRecord = {
  id: number;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  clients_total: number;
  staff_total: number;
  boats_total: number;
  yachts_total: number;
  open_leads: number;
  open_conversations: number;
  open_tasks: number;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
};

type AdminLocationsManagerPageProps = {
  locale: string;
  role: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  status: "ACTIVE",
};

export function AdminLocationsManagerPage({
  locale,
  role,
}: AdminLocationsManagerPageProps) {
  const isNl = locale === "nl";
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<LocationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const widgetHref = `/${locale}/dashboard/${role}/locations/widget`;

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/locations", {
        params: { include_inactive: true },
      });
      setLocations(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      toast.error(
        isNl ? "Locaties laden mislukt." : "Failed to load locations.",
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [isNl]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesStatus =
        statusFilter === "ALL" || location.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        location.name.toLowerCase().includes(normalizedSearch) ||
        location.code.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [locations, search, statusFilter]);

  const resetDialog = () => {
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(false);
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (location: LocationRecord) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      code: location.code,
      status: location.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      status: form.status,
    };

    if (!payload.name || !payload.code) {
      toast.error(
        isNl ? "Naam en code zijn verplicht." : "Name and code are required.",
      );
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
    } catch (error) {
      toast.error(
        isNl
          ? editingLocation
            ? "Locatie bijwerken mislukt."
            : "Locatie aanmaken mislukt."
          : editingLocation
            ? "Failed to update location."
            : "Failed to create location.",
      );
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.delete(`/admin/locations/${deleteTarget.id}`);
      toast.success(isNl ? "Locatie verwijderd." : "Location deleted.");
      setDeleteTarget(null);
      await loadLocations();
    } catch (error) {
      toast.error(
        isNl ? "Locatie verwijderen mislukt." : "Failed to delete location.",
      );
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div className=" p-2 sm:p-2 lg:p-2">
      <Toaster position="top-right" />

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
                ? "Beheer locaties voor registratie, scope en operationeel gebruik. Widget-instellingen staan nu als subpagina onder locaties."
                : "Manage locations for registration, scoping, and operations. Widget settings now live as a subpage under locations."}
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
            <Button
              asChild
              className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
            >
              <Link href={widgetHref}>
                <LayoutTemplate />
                {isNl ? "Widget-instellingen" : "Widget settings"}
              </Link>
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
              onClick={openCreateDialog}
            >
              <Plus />
              {isNl ? "Locatie aanmaken" : "Create location"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            isNl ? "Zoek op naam of code..." : "Search by name or code..."
          }
          className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400"
        >
          <option value="ALL">
            {isNl ? "Alle statussen" : "All statuses"}
          </option>
          <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
          <option value="INACTIVE">{isNl ? "Inactief" : "Inactive"}</option>
        </select>
      </div>

      <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_140px_180px_120px] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
          <span>{isNl ? "Locatie" : "Location"}</span>
          <span>Code</span>
          <span>{isNl ? "Status" : "Status"}</span>
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
              className="grid grid-cols-[minmax(0,2fr)_120px_140px_180px_120px] gap-4 border-b border-slate-100 px-6 py-5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {location.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {location.boats_total} boats, {location.yachts_total}{" "}
                      yachts, {location.open_leads} open leads
                    </p>
                  </div>
                </div>
              </div>

              <div className="self-center text-sm font-semibold text-slate-700">
                {location.code}
              </div>

              <div className="self-center">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    location.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {location.status === "ACTIVE"
                    ? isNl
                      ? "Actief"
                      : "Active"
                    : isNl
                      ? "Inactief"
                      : "Inactive"}
                </span>
              </div>

              <div className="self-center text-sm text-slate-600">
                {formatDateTime(location.updated_at)}
              </div>

              <div className="flex items-center justify-end gap-2 self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => openEditDialog(location)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDeleteTarget(location)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#003566]">
                {editingLocation
                  ? isNl
                    ? "Locatie bewerken"
                    : "Edit location"
                  : isNl
                    ? "Locatie aanmaken"
                    : "Create location"}
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={isNl ? "Locatienaam" : "Location name"}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-400"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder={isNl ? "Code" : "Code"}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm uppercase outline-none transition focus:border-blue-400"
                />

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as "ACTIVE" | "INACTIVE",
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-400"
                >
                  <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
                  <option value="INACTIVE">
                    {isNl ? "Inactief" : "Inactive"}
                  </option>
                </select>
              </div>
            </div>

            <DialogFooter className="mt-8">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={resetDialog}
                disabled={saving}
              >
                {isNl ? "Annuleren" : "Cancel"}
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                {saving
                  ? isNl
                    ? "Opslaan..."
                    : "Saving..."
                  : editingLocation
                    ? isNl
                      ? "Locatie bijwerken"
                      : "Update location"
                    : isNl
                      ? "Locatie aanmaken"
                      : "Create location"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={isNl ? "Locatie verwijderen?" : "Delete location?"}
        description={
          deleteTarget
            ? isNl
              ? `Weet je zeker dat je ${deleteTarget.name} wilt verwijderen?`
              : `Are you sure you want to delete ${deleteTarget.name}?`
            : ""
        }
        confirmText={isNl ? "Verwijderen" : "Delete"}
        cancelText={isNl ? "Annuleren" : "Cancel"}
        variant="destructive"
        onConfirm={() => {
          void handleDelete();
        }}
        isLoading={deleting}
      />
    </div>
  );
}
