"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Globe,
  LayoutTemplate,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Trash2,
  UserMinus,
  UserPlus,
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
import { setClientSession } from "@/lib/auth/client-session";
import { useClientSession } from "@/components/session/ClientSessionProvider";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────

type LocationRecord = {
  id: number;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  public_visible?: boolean;
  location_color?: string | null;
  // address
  address_line1?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // content
  description_nl?: string | null;
  description_en?: string | null;
  description_de?: string | null;
  opening_hours?: Record<string, { open: string; close: string; closed: boolean }> | null;
  default_seller_id?: number | null;
  default_seller?: { id: number; name: string; email: string } | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  // counts
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

type LocationUser = {
  id: number;
  name: string;
  email: string;
  type: string;
  status: string;
  phone?: string | null;
  location_role?: string | null;
  last_login_at?: string | null;
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

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = typeof DAYS[number];
const DAY_LABELS: Record<Day, string> = {
  mon: "Maandag", tue: "Dinsdag", wed: "Woensdag", thu: "Donderdag",
  fri: "Vrijdag", sat: "Zaterdag", sun: "Zondag",
};
const EMPTY_HOURS = { open: "09:00", close: "17:00", closed: false };

type FormState = {
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  public_visible: boolean;
  location_color: string;
  address_line1: string;
  street_number: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  description_nl: string;
  description_en: string;
  description_de: string;
  opening_hours: Record<Day, { open: string; close: string; closed: boolean }>;
  default_seller_id: number | "";
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  status: "ACTIVE",
  public_visible: false,
  location_color: "#003566",
  address_line1: "",
  street_number: "",
  postal_code: "",
  city: "",
  country: "Netherlands",
  phone: "",
  email: "",
  website: "",
  description_nl: "",
  description_en: "",
  description_de: "",
  opening_hours: Object.fromEntries(DAYS.map((d) => [d, { ...EMPTY_HOURS }])) as FormState["opening_hours"],
  default_seller_id: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
};

const IMPACT_LABELS: Record<string, string> = {
  boats: "Boten",
  yachts: "Jachten",
  clients: "Klanten",
  staff_assignments: "Medewerkers",
  leads: "Leads",
  conversations: "Chats",
  tasks: "Taken",
  boards: "Borden",
  sign_requests: "Ondertekeningsverzoeken",
  harbor_channels: "Kanalen",
  call_sessions: "Belsessies",
  columns: "Kolommen",
  task_automations: "Automatiseringen",
  task_automation_templates: "Automatiseringstemplates",
};

// ── Google Places address autocomplete ───────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    initGooglePlaces?: () => void;
  }
}

function useGooglePlaces(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onPlace: (data: { address: string; city: string; postal: string; country: string; lat: number; lng: number }) => void,
) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey || !inputRef.current) return;

    const init = () => {
      if (!window.google?.maps?.places || !inputRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["address_components", "geometry", "formatted_address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;

        const get = (type: string) =>
          place.address_components?.find((c: { types: string[] }) => c.types.includes(type))?.long_name ?? "";
        const getShort = (type: string) =>
          place.address_components?.find((c: { types: string[] }) => c.types.includes(type))?.short_name ?? "";

        onPlace({
          address: `${get("route")} ${get("street_number")}`.trim(),
          city: get("locality") || get("postal_town") || get("administrative_area_level_2"),
          postal: getShort("postal_code"),
          country: get("country"),
          lat: place.geometry?.location?.lat() ?? 0,
          lng: place.geometry?.location?.lng() ?? 0,
        });
      });
    };

    if (window.google?.maps?.places) {
      init();
      return;
    }

    if (!document.getElementById("google-places-script")) {
      const script = document.createElement("script");
      script.id = "google-places-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
      script.async = true;
      window.initGooglePlaces = init;
      document.head.appendChild(script);
    } else {
      window.initGooglePlaces = init;
    }
  }, [inputRef, onPlace]);
}

// ── Component ─────────────────────────────────────────────────────

export function AdminLocationsManagerPage({
  locale,
  role,
}: {
  locale: string;
  role: string;
}) {
  const isNl = locale === "nl";
  const router = useRouter();
  const { user: sessionUser } = useClientSession();
  const addressInputRef = useRef<HTMLInputElement>(null);

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
  const [dialogTab, setDialogTab] = useState<"info" | "users">("info");

  // Location users
  const [locationUsers, setLocationUsers] = useState<LocationUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; email: string; type: string }>>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addUserRole, setAddUserRole] = useState("LOCATION_EMPLOYEE");
  const [addingUser, setAddingUser] = useState(false);

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

  // Impersonation
  const [impersonating, setImpersonating] = useState(false);

  const widgetHref = `/${locale}/dashboard/${role}/locations/widget`;

  // ── Google Places hook ─────────────────────────────────────────

  useGooglePlaces(addressInputRef, ({ address, city, postal, country, lat, lng }) => {
    setForm((f) => ({
      ...f,
      address_line1: address,
      city,
      postal_code: postal,
      country,
    }));
    // store lat/lng separately as numbers
    void (lat); void (lng);
  });

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
      toast.error(isNl ? "Locaties laden mislukt." : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, [isNl]);

  useEffect(() => { void loadLocations(); }, [loadLocations]);

  const loadLocationUsers = useCallback(async (locationId: number) => {
    setUsersLoading(true);
    try {
      const res = await api.get(`/admin/locations/${locationId}/users`);
      setLocationUsers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error(isNl ? "Gebruikers laden mislukt." : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [isNl]);

  // Load all users for "add user" dropdown
  useEffect(() => {
    if (!isDialogOpen || !editingLocation) return;
    api.get("/admin/users").then((res) => {
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setAllUsers(list.map((u: { id: number; name: string; email: string; type: string }) => ({
        id: u.id, name: u.name, email: u.email, type: u.type,
      })));
    }).catch(() => {});
  }, [isDialogOpen, editingLocation]);

  // Load users when switching to users tab
  useEffect(() => {
    if (dialogTab === "users" && editingLocation) {
      void loadLocationUsers(editingLocation.id);
    }
  }, [dialogTab, editingLocation, loadLocationUsers]);

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
    setDialogTab("info");
    setLocationUsers([]);
    setAddUserId("");
  };

  const openEdit = (location: LocationRecord) => {
    setEditingLocation(location);
    const defaultHours = Object.fromEntries(DAYS.map((d) => [d, { ...EMPTY_HOURS }])) as FormState["opening_hours"];
    const savedHours = (location.opening_hours ?? {}) as Partial<Record<Day, { open: string; close: string; closed: boolean }>>;
    const mergedHours = { ...defaultHours };
    DAYS.forEach((d) => { if (savedHours[d]) mergedHours[d] = { ...EMPTY_HOURS, ...savedHours[d] }; });
    setForm({
      name: location.name,
      code: location.code,
      status: location.status,
      public_visible: location.public_visible ?? false,
      location_color: location.location_color ?? "#003566",
      address_line1: location.address_line1 ?? "",
      street_number: location.street_number ?? "",
      postal_code: location.postal_code ?? "",
      city: location.city ?? "",
      country: location.country ?? "Netherlands",
      phone: location.phone ?? "",
      email: location.email ?? "",
      website: location.website ?? "",
      description_nl: location.description_nl ?? "",
      description_en: location.description_en ?? "",
      description_de: location.description_de ?? "",
      opening_hours: mergedHours,
      default_seller_id: location.default_seller_id ?? "",
      seo_title: location.seo_title ?? "",
      seo_description: location.seo_description ?? "",
      seo_keywords: location.seo_keywords ?? "",
    });
    setDialogTab("info");
    setLocationUsers([]);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(isNl ? "Naam en code zijn verplicht." : "Name and code are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        status: form.status,
        public_visible: form.public_visible,
        location_color: form.location_color || null,
        address_line1: form.address_line1 || null,
        street_number: form.street_number || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        country: form.country || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        description_nl: form.description_nl || null,
        description_en: form.description_en || null,
        description_de: form.description_de || null,
        opening_hours: form.opening_hours,
        default_seller_id: form.default_seller_id || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
      };

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

  // ── Location user management ────────────────────────────────────

  const handleAddUser = async () => {
    if (!editingLocation || !addUserId) return;
    setAddingUser(true);
    try {
      await api.post(`/admin/locations/${editingLocation.id}/users`, {
        user_id: Number(addUserId),
        role: addUserRole,
      });
      toast.success(isNl ? "Gebruiker toegevoegd." : "User added.");
      setAddUserId("");
      await loadLocationUsers(editingLocation.id);
    } catch {
      toast.error(isNl ? "Toevoegen mislukt." : "Add failed.");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId: number, userName: string) => {
    if (!editingLocation) return;
    try {
      await api.delete(`/admin/locations/${editingLocation.id}/users/${userId}`);
      toast.success(isNl ? `${userName} verwijderd van locatie.` : `${userName} removed from location.`);
      setLocationUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      toast.error(isNl ? "Verwijderen mislukt." : "Remove failed.");
    }
  };

  const handleImpersonate = async (user: LocationUser) => {
    setImpersonating(true);
    try {
      const adminPassword = prompt(isNl ? "Voer je beheerderswachtwoord in om te imiteren:" : "Enter your admin password to impersonate:");
      if (!adminPassword) { setImpersonating(false); return; }

      const res = await api.post(
        `/admin/impersonate/${user.id}`,
        { password: adminPassword },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );

      const token = res.data?.token;
      const impersonated = res.data?.impersonated;
      if (!token || !impersonated) throw new Error("Impersonation failed");

      const roleMap: Record<string, string> = { ADMIN: "admin", EMPLOYEE: "employee", PARTNER: "partner", CLIENT: "client", SELLER: "seller", BUYER: "buyer" };

      setClientSession(token, {
        id: String(impersonated.id),
        name: impersonated.name,
        email: impersonated.email,
        role: roleMap[impersonated.type] ?? "client",
        type: impersonated.type,
        status: impersonated.status,
        phone: impersonated.phone ?? null,
        location_id: impersonated.location_id ?? null,
        location_role: impersonated.location_role ?? null,
        client_location_id: impersonated.client_location_id ?? null,
        has_location_assignment: impersonated.has_location_assignment ?? false,
        can_access_board: impersonated.can_access_board ?? false,
        location: impersonated.location ?? null,
        locations: impersonated.locations ?? [],
      });

      localStorage.setItem("impersonation_session", JSON.stringify({
        started_at: res.data?.session?.started_at,
        impersonated_id: impersonated.id,
        impersonated_name: impersonated.name,
      }));

      toast.success(isNl ? `Imitatie gestart: ${impersonated.name}` : `Impersonating: ${impersonated.name}`);
      resetDialog();
      setTimeout(() => {
        router.push(`/${locale}/dashboard/${roleMap[impersonated.type] ?? "client"}`);
        router.refresh();
      }, 400);
    } catch {
      toast.error(isNl ? "Imitatie mislukt." : "Impersonation failed.");
    } finally {
      setImpersonating(false);
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

  // ── Restore / permanent delete ──────────────────────────────────

  const handleRestore = async (loc: ArchivedLocation) => {
    try {
      await api.post(`/admin/locations/${loc.id}/restore`);
      toast.success(isNl ? `${loc.name} hersteld.` : `${loc.name} restored.`);
      await loadLocations();
    } catch {
      toast.error(isNl ? "Herstellen mislukt." : "Restore failed.");
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      await api.delete(`/admin/locations/${permanentTarget.id}/permanent`);
      toast.success(isNl ? `${permanentTarget.name} permanent verwijderd.` : `${permanentTarget.name} permanently deleted.`);
      setPermanentTarget(null);
      await loadLocations();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      toast.error(msg ?? (isNl ? "Permanent verwijderen mislukt." : "Permanent delete failed."));
    } finally {
      setPermanentDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────

  const fmt = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(isNl ? "nl-NL" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      ADMIN: "Admin", EMPLOYEE: "Medewerker", PARTNER: "Partner",
      CLIENT: "Klant", SELLER: "Verkoper", BUYER: "Koper",
    };
    return map[type] ?? type;
  };

  const typeColor = (type: string) => {
    if (type === "PARTNER") return "bg-teal-100 text-teal-700";
    if (type === "EMPLOYEE") return "bg-blue-100 text-blue-700";
    if (type === "ADMIN") return "bg-purple-100 text-purple-700";
    return "bg-slate-100 text-slate-600";
  };

  const ImpactRow = ({ label, count }: { label: string; count: number }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", count > 0 ? "text-red-600" : "text-slate-300")}>{count}</span>
    </div>
  );

  const availableUsersToAdd = allUsers.filter((u) => !locationUsers.find((lu) => lu.id === u.id));

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-2 sm:p-2 lg:p-2">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="rounded-[28px] border border-[#C9D8EE] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(135deg,#F7FBFF_0%,#EDF4FF_52%,#E4EEF9_100%)] p-8 text-[#0B1F3A] shadow-[0_20px_60px_rgba(15,39,74,0.10)]">
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
                ? "Locaties beheren inclusief adres, gekoppelde gebruikers en partners. Verwijdering vereist goedkeuring."
                : "Manage locations including address, linked users and partners. Deletion requires approval."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700" onClick={() => void loadLocations()}>
              <RefreshCcw className={loading ? "animate-spin" : ""} />
              {isNl ? "Verversen" : "Refresh"}
            </Button>
            <Button asChild className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]">
              <Link href={widgetHref}><LayoutTemplate />{isNl ? "Widget-instellingen" : "Widget settings"}</Link>
            </Button>
            <Button type="button" className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]" onClick={() => { setEditingLocation(null); setForm(EMPTY_FORM); setDialogTab("info"); setIsDialogOpen(true); }}>
              <Plus />{isNl ? "Locatie aanmaken" : "Create location"}
            </Button>
            {archivedLocations.length > 0 && (
              <Button type="button" variant="outline" className={cn("rounded-xl", showArchived && "bg-amber-50 border-amber-200 text-amber-700")} onClick={() => setShowArchived((v) => !v)}>
                <ArchiveRestore />{isNl ? `Gearchiveerd (${archivedLocations.length})` : `Archived (${archivedLocations.length})`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Archived panel */}
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
                    {loc.delete_reason && <p className="mt-0.5 text-xs text-slate-500">{isNl ? "Reden:" : "Reason:"} {loc.delete_reason}</p>}
                    {loc.deleted_by && <p className="text-xs text-slate-400">{isNl ? "Door:" : "By:"} {loc.deleted_by} — {fmt(loc.deleted_at)}</p>}
                    {total > 0 && <p className="mt-1 text-xs text-red-500">{isNl ? `Nog ${total} gekoppelde records` : `${total} linked records remain`}</p>}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <Button size="sm" variant="outline" className="rounded-lg text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => void handleRestore(loc)}>
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1" />{isNl ? "Herstellen" : "Restore"}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-red-600 border-red-200 hover:bg-red-50" onClick={() => setPermanentTarget(loc)} disabled={total > 0} title={total > 0 ? (isNl ? "Verwijder eerst alle gekoppelde records" : "Remove all linked records first") : undefined}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />{isNl ? "Permanent" : "Permanent"}
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
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isNl ? "Zoek op naam of code..." : "Search by name or code..."} className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")} className="h-16 rounded-[22px] border border-slate-200 bg-white px-5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400">
          <option value="ALL">{isNl ? "Alle statussen" : "All statuses"}</option>
          <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
          <option value="INACTIVE">{isNl ? "Inactief" : "Inactive"}</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,2fr)_100px_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_180px_120px] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
          <span>{isNl ? "Locatie" : "Location"}</span>
          <span>Code</span>
          <span>{isNl ? "Adres" : "Address"}</span>
          <span>{isNl ? "Medewerkers" : "Employees"}</span>
          <span>Status</span>
          <span>{isNl ? "Bijgewerkt" : "Updated"}</span>
          <span className="text-right">{isNl ? "Acties" : "Actions"}</span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">{isNl ? "Locaties laden..." : "Loading locations..."}</div>
        ) : filteredLocations.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">{isNl ? "Geen locaties gevonden." : "No locations found."}</div>
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
                    <p className="mt-1 text-xs text-slate-500">{location.boats_total} boten · {location.yachts_total} jachten · {location.open_leads} leads</p>
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
                  <p className="text-xs text-slate-300 italic">{isNl ? "Geen adres" : "No address"}</p>
                )}
                {location.phone && <p className="truncate text-xs text-slate-500 mt-0.5">{location.phone}</p>}
              </div>
              <div className="self-center text-sm text-slate-700">
                <p className="font-semibold">{(location.employee_count ?? location.employees?.length ?? 0)} {isNl ? "gekoppeld" : "linked"}</p>
                {location.employees && location.employees.length > 0 ? (
                  <p className="mt-1 truncate text-xs text-slate-500">{location.employees.map((e) => e.name).join(", ")}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">{isNl ? "Geen medewerkers" : "No employees"}</p>
                )}
              </div>
              <div className="self-center">
                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", location.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>
                  {location.status === "ACTIVE" ? (isNl ? "Actief" : "Active") : (isNl ? "Inactief" : "Inactive")}
                </span>
              </div>
              <div className="self-center text-sm text-slate-600">{fmt(location.updated_at)}</div>
              <div className="flex items-center justify-end gap-2 self-center">
                <Button asChild type="button" variant="outline" size="icon" className="rounded-xl" title={isNl ? "Vestigingspagina" : "Location detail"}>
                  <Link href={`/${locale}/dashboard/${role}/locations/${location.id}`}>
                    <Users />
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => openEdit(location)}>
                  <Pencil />
                </Button>
                <Button type="button" variant="outline" size="icon" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void openDeleteFlow(location)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create / Edit Dialog ───────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 bg-white p-0 max-h-[90vh] overflow-y-auto">
          <div className="p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#003566]">
                {editingLocation ? (isNl ? "Locatie bewerken" : "Edit location") : (isNl ? "Locatie aanmaken" : "Create location")}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                {editingLocation ? editingLocation.name : (isNl ? "Maak een nieuwe locatie aan voor het platform." : "Create a new location for the platform.")}
              </DialogDescription>
            </DialogHeader>

            {/* Tabs (only when editing) */}
            {editingLocation && (
              <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  className={cn("flex-1 rounded-lg py-2 text-sm font-semibold transition-colors", dialogTab === "info" ? "bg-white text-[#003566] shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  onClick={() => setDialogTab("info")}
                >
                  {isNl ? "Informatie" : "Information"}
                </button>
                <button
                  type="button"
                  className={cn("flex-1 rounded-lg py-2 text-sm font-semibold transition-colors", dialogTab === "users" ? "bg-white text-[#003566] shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  onClick={() => setDialogTab("users")}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {isNl ? "Gebruikers" : "Users"}
                    {locationUsers.length > 0 && <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5">{locationUsers.length}</span>}
                  </span>
                </button>
              </div>
            )}

            {/* Info tab */}
            {dialogTab === "info" && (
              <div className="mt-5 space-y-4">
                {/* Core */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{isNl ? "Naam *" : "Name *"}</label>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Schepenkring Heeg" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    <div>
                      <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{isNl ? "Code *" : "Code *"}</label>
                      <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="HG" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm uppercase outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
                      <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400">
                        <option value="ACTIVE">{isNl ? "Actief" : "Active"}</option>
                        <option value="INACTIVE">{isNl ? "Inactief" : "Inactive"}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />{isNl ? "Adresgegevens" : "Address"}
                  </p>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Straat (Google Places)" : "Street (Google Places)"}</label>
                    <input
                      ref={addressInputRef}
                      value={form.address_line1}
                      onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                      placeholder={isNl ? "Begin met typen voor Google-suggesties…" : "Start typing for Google suggestions…"}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="grid gap-3 grid-cols-3">
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Huisnr." : "Number"}</label>
                      <input value={form.street_number} onChange={(e) => setForm((f) => ({ ...f, street_number: e.target.value }))} placeholder="12a" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Postcode" : "Postal code"}</label>
                      <input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} placeholder="8621 AB" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Stad" : "City"}</label>
                      <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Heeg" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Land" : "Country"}</label>
                    <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Netherlands" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                  </div>
                </div>

                {/* Contact */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />{isNl ? "Contactgegevens" : "Contact"}
                  </p>
                  <div className="grid gap-3 grid-cols-2">
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Telefoon" : "Phone"}</label>
                      <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+31 6 12345678" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" type="tel" />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-500">E-mail</label>
                      <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="heeg@schepenkring.nl" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" type="email" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Website
                    </label>
                    <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://www.schepenkring.nl/heeg" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" type="url" />
                  </div>
                </div>

                {/* Visibility + color */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isNl ? "Zichtbaarheid" : "Visibility"}</p>
                  <div className="grid gap-3 grid-cols-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.public_visible} onChange={(e) => setForm((f) => ({ ...f, public_visible: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-[#003566]" />
                      <span className="text-sm text-slate-700">{isNl ? "Publiek zichtbaar" : "Publicly visible"}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500">{isNl ? "Kleur" : "Color"}</label>
                      <input type="color" value={form.location_color} onChange={(e) => setForm((f) => ({ ...f, location_color: e.target.value }))} className="h-8 w-16 rounded-lg border border-slate-200 p-0.5 cursor-pointer" />
                      <span className="text-xs text-slate-400">{form.location_color}</span>
                    </div>
                  </div>
                </div>

                {/* Descriptions */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isNl ? "Omschrijving" : "Description"}</p>
                  {(["nl", "en", "de"] as const).map((lang) => (
                    <div key={lang}>
                      <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase">{lang.toUpperCase()}</label>
                      <textarea
                        rows={2}
                        value={form[`description_${lang}` as "description_nl" | "description_en" | "description_de"]}
                        onChange={(e) => setForm((f) => ({ ...f, [`description_${lang}`]: e.target.value }))}
                        placeholder={isNl ? `Omschrijving in het ${lang === "nl" ? "Nederlands" : lang === "en" ? "Engels" : "Duits"}…` : `Description in ${lang}…`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Opening hours */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isNl ? "Openingstijden" : "Opening hours"}</p>
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-semibold text-slate-600 shrink-0">{DAY_LABELS[day]}</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                        <input
                          type="checkbox"
                          checked={!form.opening_hours[day].closed}
                          onChange={(e) => setForm((f) => ({ ...f, opening_hours: { ...f.opening_hours, [day]: { ...f.opening_hours[day], closed: !e.target.checked } } }))}
                          className="h-3.5 w-3.5 accent-[#003566]"
                        />
                        {isNl ? "Open" : "Open"}
                      </label>
                      {!form.opening_hours[day].closed && (
                        <>
                          <input
                            type="time"
                            value={form.opening_hours[day].open}
                            onChange={(e) => setForm((f) => ({ ...f, opening_hours: { ...f.opening_hours, [day]: { ...f.opening_hours[day], open: e.target.value } } }))}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                          />
                          <span className="text-slate-400 text-xs">–</span>
                          <input
                            type="time"
                            value={form.opening_hours[day].close}
                            onChange={(e) => setForm((f) => ({ ...f, opening_hours: { ...f.opening_hours, [day]: { ...f.opening_hours[day], close: e.target.value } } }))}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                          />
                        </>
                      )}
                      {form.opening_hours[day].closed && <span className="text-xs text-slate-400 italic">{isNl ? "Gesloten" : "Closed"}</span>}
                    </div>
                  ))}
                </div>

                {/* SEO */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">SEO</p>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-slate-500">SEO-titel</label>
                    <input value={form.seo_title} onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))} placeholder="Schepenkring Heeg | Jachten te koop" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-slate-500">SEO-beschrijving</label>
                    <textarea value={form.seo_description} onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))} rows={2} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Bezoek onze vestiging in Heeg…" />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-slate-500">{isNl ? "Trefwoorden" : "Keywords"}</label>
                    <input value={form.seo_keywords} onChange={(e) => setForm((f) => ({ ...f, seo_keywords: e.target.value }))} placeholder="jacht, heeg, te koop, friesland" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Users tab */}
            {dialogTab === "users" && editingLocation && (
              <div className="mt-5 space-y-4">
                {/* Add user */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />{isNl ? "Gebruiker toevoegen" : "Add user"}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                    <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                      <option value="">{isNl ? "— Selecteer gebruiker —" : "— Select user —"}</option>
                      {availableUsersToAdd.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                      ))}
                    </select>
                    <select value={addUserRole} onChange={(e) => setAddUserRole(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                      <option value="LOCATION_EMPLOYEE">{isNl ? "Medewerker" : "Employee"}</option>
                      <option value="LOCATION_MANAGER">{isNl ? "Manager" : "Manager"}</option>
                    </select>
                    <Button type="button" disabled={!addUserId || addingUser} onClick={() => void handleAddUser()} className="h-10 rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B] whitespace-nowrap">
                      {addingUser ? <Loader2 className="animate-spin h-4 w-4" /> : <><UserPlus className="h-4 w-4 mr-1" />{isNl ? "Toevoegen" : "Add"}</>}
                    </Button>
                  </div>
                </div>

                {/* User list */}
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
                    <span className="ml-2 text-sm text-slate-500">{isNl ? "Gebruikers laden…" : "Loading users…"}</span>
                  </div>
                ) : locationUsers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    {isNl ? "Geen gebruikers gekoppeld aan deze locatie." : "No users linked to this location."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {locationUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">{u.name}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", typeColor(u.type))}>{typeLabel(u.type)}</span>
                            {u.location_role && (
                              <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">
                                {u.location_role === "LOCATION_MANAGER" ? (isNl ? "Manager" : "Manager") : (isNl ? "Medewerker" : "Employee")}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-2">
                            <Mail className="h-3 w-3" />{u.email}
                            {u.last_login_at && <span className="text-slate-400">· {isNl ? "Ingelogd:" : "Login:"} {new Date(u.last_login_at).toLocaleDateString()}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50"
                            title={isNl ? "Imiteer gebruiker" : "Impersonate user"}
                            disabled={impersonating}
                            onClick={() => void handleImpersonate(u)}
                          >
                            <LogIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                            title={isNl ? "Verwijder van locatie" : "Remove from location"}
                            onClick={() => void handleRemoveUser(u.id, u.name)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dialogTab === "info" && (
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" className="rounded-xl" onClick={resetDialog} disabled={saving}>
                  {isNl ? "Annuleren" : "Cancel"}
                </Button>
                <Button type="button" className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]" onClick={() => void handleSubmit()} disabled={saving}>
                  {saving ? (isNl ? "Opslaan..." : "Saving...") : editingLocation ? (isNl ? "Bijwerken" : "Update") : (isNl ? "Aanmaken" : "Create")}
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete request Dialog ──────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setImpactData(null); setDeleteSuccess(false); } }}>
        <DialogContent className="max-w-lg rounded-[28px] border-slate-200 bg-white p-0">
          <div className="p-6 sm:p-8">
            {deleteSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">{isNl ? "Verzoek ingediend" : "Request submitted"}</h2>
                <p className="text-sm text-slate-500 mb-6">{isNl ? "Alle admins ontvangen een e-mail om het verwijderingsverzoek goed te keuren. De link is 24 uur geldig." : "All admins will receive an e-mail to approve the deletion. The link is valid for 24 hours."}</p>
                <Button className="rounded-xl bg-[#003566] text-white" onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }}>{isNl ? "Sluiten" : "Close"}</Button>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
                    <DialogTitle className="text-xl text-slate-900">{isNl ? "Locatie verwijderen" : "Delete location"}</DialogTitle>
                  </div>
                  <DialogDescription className="text-slate-500 text-sm">{isNl ? `Verwijdering van "${deleteTarget?.name}" vereist goedkeuring per e-mail.` : `Deleting "${deleteTarget?.name}" requires e-mail approval.`}</DialogDescription>
                </DialogHeader>

                {impactLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin h-6 w-6 text-slate-400" /><span className="ml-3 text-sm text-slate-500">{isNl ? "Impact ophalen..." : "Loading impact..."}</span>
                  </div>
                ) : impactData ? (
                  <div className="mt-5 space-y-4">
                    <div className={cn("rounded-xl border p-4", impactData.total_linked_records > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-wider mb-2", impactData.total_linked_records > 0 ? "text-red-600" : "text-emerald-600")}>{isNl ? "Gekoppelde gegevens" : "Linked records"}</p>
                      {impactData.total_linked_records === 0 ? (
                        <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{isNl ? "Geen gekoppelde gegevens." : "No linked records."}</p>
                      ) : (
                        <>
                          <div className="space-y-0.5">{Object.entries(impactData.impact).filter(([, c]) => c > 0).map(([k, c]) => <ImpactRow key={k} label={IMPACT_LABELS[k] ?? k} count={c} />)}</div>
                          <div className="mt-3 pt-3 border-t border-red-200 flex justify-between"><span className="text-xs font-bold text-red-700">{isNl ? "Totaal" : "Total"}</span><span className="text-xs font-bold text-red-700 tabular-nums">{impactData.total_linked_records}</span></div>
                        </>
                      )}
                    </div>

                    {impactData.total_linked_records > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{isNl ? "Records verplaatsen naar (optioneel)" : "Move records to (optional)"}</label>
                        <select value={moveToLocationId} onChange={(e) => setMoveToLocationId(e.target.value ? Number(e.target.value) : "")} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                          <option value="">{isNl ? "— Niet verplaatsen —" : "— Do not move —"}</option>
                          {locations.filter((l) => l.id !== deleteTarget?.id).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                        </select>
                      </div>
                    )}

                    {deleteStep === "impact" && (
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" className="rounded-xl" onClick={() => { setDeleteTarget(null); setImpactData(null); }}>{isNl ? "Annuleren" : "Cancel"}</Button>
                        <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => setDeleteStep("reason")}>{isNl ? "Doorgaan" : "Continue"}</Button>
                      </div>
                    )}

                    {deleteStep === "reason" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{isNl ? "Reden voor verwijdering *" : "Reason for deletion *"}</label>
                          <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder={isNl ? "Bijv. dubbele locatie, fout aangemaakt..." : "e.g. duplicate location, created by mistake..."} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none" />
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                          <p className="font-bold mb-0.5">{isNl ? "Wat er daarna gebeurt:" : "What happens next:"}</p>
                          <ul className="space-y-0.5 list-disc list-inside text-amber-600">
                            <li>{isNl ? "Alle admins ontvangen een goedkeurings-e-mail" : "All admins receive an approval e-mail"}</li>
                            <li>{isNl ? "Na goedkeuring wordt de locatie gearchiveerd" : "After approval the location is archived"}</li>
                            <li>{isNl ? "De link verloopt na 24 uur" : "The link expires after 24 hours"}</li>
                          </ul>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => setDeleteStep("impact")}>{isNl ? "Terug" : "Back"}</Button>
                          <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => void submitDeleteRequest()} disabled={deleteSubmitting || !deleteReason.trim()}>
                            {deleteSubmitting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />{isNl ? "Versturen..." : "Sending..."}</> : (isNl ? "Verzoek indienen" : "Submit request")}
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
                <DialogTitle className="text-xl text-slate-900">{isNl ? "Permanent verwijderen?" : "Delete permanently?"}</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-slate-500">{isNl ? `"${permanentTarget?.name}" wordt onherroepelijk verwijderd uit de database.` : `"${permanentTarget?.name}" will be permanently removed from the database.`}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button variant="outline" className="rounded-xl" onClick={() => setPermanentTarget(null)}>{isNl ? "Annuleren" : "Cancel"}</Button>
              <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => void handlePermanentDelete()} disabled={permanentDeleting}>
                {permanentDeleting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />{isNl ? "Verwijderen..." : "Deleting..."}</> : (isNl ? "Permanent verwijderen" : "Delete permanently")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
