"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Save,
  Star,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ── Types ─────────────────────────────────────────────────────────────────────

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

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: "Maandag",
  tue: "Dinsdag",
  wed: "Woensdag",
  thu: "Donderdag",
  fri: "Vrijdag",
  sat: "Zaterdag",
  sun: "Zondag",
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
  whatsapp_number: string;
  email: string;
  sender_email: string;
  website: string;
  description_nl: string;
  description_en: string;
  description_de: string;
  opening_hours: Record<Day, { open: string; close: string; closed: boolean }>;
  default_seller_id: number | "";
  lead_assignment_mode: "default_seller" | "round_robin" | "unassigned";
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
  whatsapp_number: "",
  email: "",
  sender_email: "",
  website: "",
  description_nl: "",
  description_en: "",
  description_de: "",
  opening_hours: Object.fromEntries(
    DAYS.map((d) => [d, { ...EMPTY_HOURS }]),
  ) as FormState["opening_hours"],
  default_seller_id: "",
  lead_assignment_mode: "default_seller",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
};

// ── Google Places autocomplete ────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    initGooglePlaces?: () => void;
  }
}

function useGooglePlaces(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onPlace: (data: {
    street: string;
    streetNumber: string;
    city: string;
    postal: string;
    country: string;
    lat: number;
    lng: number;
  }) => void,
) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !inputRef.current) return;

    const init = () => {
      if (!window.google?.maps?.places || !inputRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["address_components", "geometry"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;
        const get = (type: string) =>
          place.address_components?.find((c: { types: string[] }) =>
            c.types.includes(type),
          )?.long_name ?? "";
        const getShort = (type: string) =>
          place.address_components?.find((c: { types: string[] }) =>
            c.types.includes(type),
          )?.short_name ?? "";
        onPlace({
          street: get("route"),
          streetNumber: get("street_number"),
          city:
            get("locality") ||
            get("postal_town") ||
            get("administrative_area_level_2"),
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

// ── User role helpers ─────────────────────────────────────────────────────────

function roleLabel(type: string, locationRole?: string | null): string {
  if (locationRole === "LOCATION_MANAGER") return "Vestigingsmanager";
  if (locationRole === "BROKER") return "Makelaar";
  if (locationRole === "LOCATION_EMPLOYEE") return "Medewerker";
  if (type === "ADMIN") return "Admin";
  if (type === "EMPLOYEE") return "Medewerker";
  return type;
}

function roleColor(type: string, locationRole?: string | null): string {
  if (locationRole === "LOCATION_MANAGER") return "bg-blue-100 text-blue-700";
  if (locationRole === "BROKER") return "bg-teal-100 text-teal-700";
  if (type === "ADMIN") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-600";
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  locationId?: number;
  locale: string;
  role: string;
}

export function LocationFormPage({ locationId, locale, role }: Props) {
  const isEditing = locationId !== undefined;
  const router = useRouter();
  const { user: sessionUser } = useClientSession();
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [locationName, setLocationName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"info" | "users">("info");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Users tab
  const [locationUsers, setLocationUsers] = useState<LocationUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<
    Array<{ id: number; name: string; type: string }>
  >([]);
  const [addUserId, setAddUserId] = useState("");
  const [addUserRole, setAddUserRole] = useState("LOCATION_EMPLOYEE");
  const [addingUser, setAddingUser] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  // Impersonation dialog state
  const [impersonateTarget, setImpersonateTarget] = useState<LocationUser | null>(null);
  const [impersonatePassword, setImpersonatePassword] = useState("");
  const [impersonateOtp, setImpersonateOtp] = useState("");

  // Default seller state
  const [settingDefaultSeller, setSettingDefaultSeller] = useState<number | null>(null);

  // Video intro/outro state
  const [videoIntroUrl, setVideoIntroUrl] = useState<string | null>(null);
  const [videoOutroUrl, setVideoOutroUrl] = useState<string | null>(null);
  const [uploadingVideoSlot, setUploadingVideoSlot] = useState<"intro" | "outro" | null>(null);

  // Create-user sub-form state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    type: "PARTNER",
    phone: "",
    status: "ACTIVE",
  });

  // ── Load existing location ────────────────────────────────────────────────

  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);
    api
      .get(`/admin/locations/${locationId}`)
      .then((res) => {
        const loc = res.data?.data ?? res.data;
        if (!loc) return;
        setLocationName(loc.name ?? "");
        const defaultHours = Object.fromEntries(
          DAYS.map((d) => [d, { ...EMPTY_HOURS }]),
        ) as FormState["opening_hours"];
        const savedHours = (loc.opening_hours ??
          {}) as Partial<
          Record<Day, { open: string; close: string; closed: boolean }>
        >;
        const mergedHours = { ...defaultHours };
        DAYS.forEach((d) => {
          if (savedHours[d])
            mergedHours[d] = { ...EMPTY_HOURS, ...savedHours[d] };
        });
        setForm({
          name: loc.name ?? "",
          code: loc.code ?? "",
          status: loc.status ?? "ACTIVE",
          public_visible: loc.public_visible ?? false,
          location_color: loc.location_color ?? "#003566",
          address_line1: loc.address_line1 ?? "",
          street_number: loc.street_number ?? "",
          postal_code: loc.postal_code ?? "",
          city: loc.city ?? "",
          country: loc.country ?? "Netherlands",
          phone: loc.phone ?? "",
          whatsapp_number: loc.whatsapp_number ?? "",
          email: loc.email ?? "",
          sender_email: loc.sender_email ?? "",
          website: loc.website ?? "",
          description_nl: loc.description_nl ?? "",
          description_en: loc.description_en ?? "",
          description_de: loc.description_de ?? "",
          opening_hours: mergedHours,
          default_seller_id: loc.default_seller_id ?? "",
          lead_assignment_mode: loc.lead_assignment_mode ?? "default_seller",
          seo_title: loc.seo_title ?? "",
          seo_description: loc.seo_description ?? "",
          seo_keywords: loc.seo_keywords ?? "",
        });
        setVideoIntroUrl(loc.video_intro_media ?? null);
        setVideoOutroUrl(loc.video_outro_media ?? null);
      })
      .catch(() => toast.error("Locatie laden mislukt."))
      .finally(() => setLoading(false));
  }, [isEditing, locationId]);

  // ── Load users (when editing + users tab active) ──────────────────────────

  const loadLocationUsers = useCallback(async () => {
    if (!isEditing) return;
    setUsersLoading(true);
    try {
      const res = await api.get(`/admin/locations/${locationId}/users`);
      setLocationUsers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Gebruikers laden mislukt.");
    } finally {
      setUsersLoading(false);
    }
  }, [isEditing, locationId]);

  useEffect(() => {
    if (activeTab === "users" && isEditing) {
      void loadLocationUsers();
      api.get("/admin/users").then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setAllUsers(
          list.map((u: { id: number; name: string; type: string }) => ({
            id: u.id,
            name: u.name,
            type: u.type,
          })),
        );
      });
    }
  }, [activeTab, isEditing, loadLocationUsers]);

  const availableToAdd = useMemo(
    () => allUsers.filter((u) => !locationUsers.find((lu) => lu.id === u.id)),
    [allUsers, locationUsers],
  );

  // ── Google Places ─────────────────────────────────────────────────────────

  useGooglePlaces(addressInputRef, ({ street, streetNumber, city, postal, country }) => {
    setForm((f) => ({
      ...f,
      address_line1: street,
      street_number: streetNumber,
      city,
      postal_code: postal,
      country,
    }));
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Naam en code zijn verplicht.");
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
        whatsapp_number: form.whatsapp_number || null,
        email: form.email || null,
        sender_email: form.sender_email || null,
        website: form.website || null,
        description_nl: form.description_nl || null,
        description_en: form.description_en || null,
        description_de: form.description_de || null,
        opening_hours: form.opening_hours,
        default_seller_id: form.default_seller_id || null,
        lead_assignment_mode: form.lead_assignment_mode,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
      };

      if (isEditing) {
        await api.patch(`/admin/locations/${locationId}`, payload);
        toast.success("Locatie bijgewerkt.");
        router.push(`/${locale}/dashboard/${role}/locations/${locationId}`);
      } else {
        const res = await api.post("/admin/locations", payload);
        const newId = res.data?.data?.id ?? res.data?.id;
        toast.success("Locatie aangemaakt.");
        router.push(
          newId
            ? `/${locale}/dashboard/${role}/locations/${newId}`
            : `/${locale}/dashboard/${role}/locations`,
        );
      }
    } catch {
      toast.error("Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  };

  // ── User management ───────────────────────────────────────────────────────

  const handleAddUser = async () => {
    if (!isEditing || !addUserId) return;
    setAddingUser(true);
    try {
      await api.post(`/admin/locations/${locationId}/users`, {
        user_id: Number(addUserId),
        role: addUserRole,
      });
      toast.success("Gebruiker toegevoegd.");
      setAddUserId("");
      await loadLocationUsers();
    } catch {
      toast.error("Toevoegen mislukt.");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId: number, name: string) => {
    if (!isEditing) return;
    try {
      await api.delete(`/admin/locations/${locationId}/users/${userId}`);
      toast.success(`${name} verwijderd.`);
      setLocationUsers((p) => p.filter((u) => u.id !== userId));
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  };

  const handleImpersonate = (u: LocationUser) => {
    setImpersonateTarget(u);
    setImpersonatePassword("");
    setImpersonateOtp("");
  };

  const executeImpersonation = async () => {
    if (!impersonateTarget || !impersonatePassword.trim()) return;
    setImpersonating(true);
    try {
      const res = await api.post(
        `/admin/impersonate/${impersonateTarget.id}`,
        { password: impersonatePassword.trim(), otp_code: impersonateOtp.trim() || undefined },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      const token = res.data?.token;
      const imp = res.data?.impersonated;
      if (!token || !imp) throw new Error("failed");
      const roleMap: Record<string, string> = {
        ADMIN: "admin",
        EMPLOYEE: "employee",
        PARTNER: "partner",
        CLIENT: "client",
        SELLER: "seller",
        BUYER: "buyer",
      };
      const nextRole = roleMap[imp.type] ?? "client";
      setClientSession(token, {
        id: String(imp.id),
        name: imp.name,
        email: imp.email,
        role: nextRole as Parameters<typeof setClientSession>[1]["role"],
        type: imp.type,
        status: imp.status,
        phone: imp.phone ?? null,
        location_id: imp.location_id ?? null,
        location_role: imp.location_role ?? null,
        client_location_id: imp.client_location_id ?? null,
        has_location_assignment: imp.has_location_assignment ?? false,
        can_access_board: imp.can_access_board ?? false,
        location: imp.location ?? null,
        locations: imp.locations ?? [],
      });
      localStorage.setItem(
        "impersonation_session",
        JSON.stringify({
          started_at: res.data?.session?.started_at,
          impersonated_id: imp.id,
          impersonated_name: imp.name,
        }),
      );
      toast.success(`Imitatie gestart: ${imp.name}`);
      setImpersonateTarget(null);
      setTimeout(() => router.push(`/${locale}/dashboard/${nextRole}`), 300);
    } catch {
      toast.error("Imitatie mislukt. Controleer je wachtwoord of OTP.");
    } finally {
      setImpersonating(false);
    }
  };

  const handleSetDefaultSeller = async (userId: number) => {
    if (!locationId) return;
    setSettingDefaultSeller(userId);
    try {
      await api.patch(`/admin/locations/${locationId}/default-seller`, { user_id: userId });
      setForm((f) => ({ ...f, default_seller_id: userId }));
      toast.success("Standaard verkoper ingesteld.");
    } catch {
      toast.error("Instellen mislukt.");
    } finally {
      setSettingDefaultSeller(null);
    }
  };

  const handleUploadVideoMedia = async (slot: "intro" | "outro", file: File) => {
    if (!locationId) return;
    setUploadingVideoSlot(slot);
    try {
      const fd = new FormData();
      fd.append("slot", slot);
      fd.append("file", file);
      const res = await api.post(`/admin/locations/${locationId}/video-media`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (slot === "intro") setVideoIntroUrl(res.data?.url ?? null);
      else setVideoOutroUrl(res.data?.url ?? null);
      toast.success(slot === "intro" ? "Openingsvideo geüpload." : "Slotvideo geüpload.");
    } catch {
      toast.error("Uploaden mislukt.");
    } finally {
      setUploadingVideoSlot(null);
    }
  };

  const handleRemoveVideoMedia = async (slot: "intro" | "outro") => {
    if (!locationId) return;
    setUploadingVideoSlot(slot);
    try {
      const field = slot === "intro" ? "video_intro_media" : "video_outro_media";
      await api.patch(`/admin/locations/${locationId}`, { [field]: null });
      if (slot === "intro") setVideoIntroUrl(null);
      else setVideoOutroUrl(null);
      toast.success("Verwijderd.");
    } catch {
      toast.error("Verwijderen mislukt.");
    } finally {
      setUploadingVideoSlot(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8) {
      toast.error("Naam, e-mail en wachtwoord (min. 8 tekens) zijn verplicht.");
      return;
    }
    setCreatingUser(true);
    try {
      await api.post("/admin/users", {
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        type: newUser.type,
        phone: newUser.phone.trim() || null,
        status: newUser.status,
        location_id: locationId,
        location_role: "LOCATION_EMPLOYEE",
      });
      toast.success("Gebruiker aangemaakt en gekoppeld.");
      setShowCreateUser(false);
      setNewUser({ name: "", email: "", password: "", type: "PARTNER", phone: "", status: "ACTIVE" });
      await loadLocationUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Aanmaken mislukt.");
    } finally {
      setCreatingUser(false);
    }
  };

  // Suppress unused warning — sessionUser is available for future role checks
  void sessionUser;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-24">
      <Toaster position="top-right" />

      {/* Page header */}
      <div>
        <Link
          href={
            isEditing
              ? `/${locale}/dashboard/${role}/locations/${locationId}`
              : `/${locale}/dashboard/${role}/locations`
          }
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isEditing ? locationName || "Locatie" : "Alle locaties"}
        </Link>

        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {isEditing ? "Locatie bewerken" : "Nieuwe locatie"}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#003566]">
                {isEditing
                  ? locationName || "Locatie bewerken"
                  : "Locatie aanmaken"}
              </h1>
            </div>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="shrink-0 rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Opslaan…" : isEditing ? "Wijzigingen opslaan" : "Aanmaken"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs (only when editing) */}
      {isEditing && (
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
              activeTab === "info"
                ? "bg-[#003566] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            Informatie
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
              activeTab === "users"
                ? "bg-[#003566] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <Users className="h-4 w-4" />
            Medewerkers
            {locationUsers.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">
                {locationUsers.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Info tab / form ───────────────────────────────────────────────────── */}
      {(!isEditing || activeTab === "info") && (
        <div className="space-y-5">
          {/* Basic info */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Basisgegevens
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Naam</Label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Schepenkring Heeg"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>Code</Label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="HG"
                  maxLength={10}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "ACTIVE" | "INACTIVE",
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400"
                >
                  <option value="ACTIVE">Actief</option>
                  <option value="INACTIVE">Inactief</option>
                </select>
              </div>
              <div className="flex items-center gap-6 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.public_visible}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        public_visible: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-[#003566]"
                  />
                  <span className="text-sm text-slate-700">
                    Publiek zichtbaar
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <Label>Kleur</Label>
                  <input
                    type="color"
                    value={form.location_color}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        location_color: e.target.value,
                      }))
                    }
                    className="h-9 w-14 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                  />
                  <span className="font-mono text-xs text-slate-400">
                    {form.location_color}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Address */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <MapPin className="h-3.5 w-3.5" /> Adres
            </p>
            <div className="grid gap-4">
              <div>
                <Label>Straat</Label>
                <input
                  ref={addressInputRef}
                  value={form.address_line1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      address_line1: e.target.value,
                    }))
                  }
                  placeholder="Havenweg"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Huisnummer</Label>
                  <input
                    value={form.street_number}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        street_number: e.target.value,
                      }))
                    }
                    placeholder="12a"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                  />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <input
                    value={form.postal_code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        postal_code: e.target.value,
                      }))
                    }
                    placeholder="8621 AB"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                  />
                </div>
                <div>
                  <Label>Stad</Label>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                    placeholder="Heeg"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <Label>Land</Label>
                <input
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                  placeholder="Netherlands"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <Phone className="h-3.5 w-3.5" /> Contactgegevens
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Telefoon</Label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+31 6 12345678"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="heeg@schepenkring.nl"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>WhatsApp-nummer</Label>
                <input
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp_number: e.target.value }))
                  }
                  placeholder="+31 6 12345678"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>Afzender e-mail (voor automatische mails)</Label>
                <input
                  type="email"
                  value={form.sender_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sender_email: e.target.value }))
                  }
                  placeholder="noreply@heeg.schepenkring.nl"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Website
                  </span>
                </Label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, website: e.target.value }))
                  }
                  placeholder="https://www.schepenkring.nl/heeg"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
            </div>
          </section>

          {/* Descriptions */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Omschrijving
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["nl", "en", "de"] as const).map((lang) => (
                <div key={lang}>
                  <Label>{lang.toUpperCase()}</Label>
                  <textarea
                    rows={4}
                    value={
                      form[
                        `description_${lang}` as
                          | "description_nl"
                          | "description_en"
                          | "description_de"
                      ]
                    }
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [`description_${lang}`]: e.target.value,
                      }))
                    }
                    placeholder={`Omschrijving in het ${lang === "nl" ? "Nederlands" : lang === "en" ? "Engels" : "Duits"}…`}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Video intro/outro */}
          {isEditing && (
            <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <Video className="h-3.5 w-3.5" /> Video-intro &amp; -outro
              </p>
              <p className="mb-4 text-xs text-slate-500">
                Deze foto of korte video wordt automatisch toegevoegd aan het begin en einde van elke
                gegenereerde bootvideo voor boten bij deze locatie.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["intro", "outro"] as const).map((slot) => {
                  const url = slot === "intro" ? videoIntroUrl : videoOutroUrl;
                  const isUploading = uploadingVideoSlot === slot;
                  return (
                    <div key={slot} className="space-y-2">
                      <Label>{slot === "intro" ? "Opening" : "Slot"}</Label>
                      {url ? (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          {/\.(mp4|mov|webm|m4v)$/i.test(url) ? (
                            <video src={url} className="h-12 w-20 rounded-lg object-cover" muted />
                          ) : (
                            <img src={url} alt="" className="h-12 w-20 rounded-lg object-cover" />
                          )}
                          <span className="flex-1 truncate text-xs text-slate-500">{url.split("/").pop()}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                            disabled={isUploading}
                            onClick={() => void handleRemoveVideoMedia(slot)}
                          >
                            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      ) : (
                        <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600">
                          {isUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {isUploading ? "Uploaden…" : "Afbeelding of video uploaden"}
                          <input
                            type="file"
                            accept="image/*,video/mp4,video/quicktime,video/webm"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUploadVideoMedia(slot, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Opening hours */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Openingstijden
            </p>
            <div className="space-y-3">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="w-28 shrink-0 text-sm font-semibold text-slate-700">
                    {DAY_LABELS[day]}
                  </span>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={!form.opening_hours[day].closed}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          opening_hours: {
                            ...f.opening_hours,
                            [day]: {
                              ...f.opening_hours[day],
                              closed: !e.target.checked,
                            },
                          },
                        }))
                      }
                      className="h-4 w-4 accent-[#003566]"
                    />
                    Open
                  </label>
                  {!form.opening_hours[day].closed ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={form.opening_hours[day].open}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            opening_hours: {
                              ...f.opening_hours,
                              [day]: {
                                ...f.opening_hours[day],
                                open: e.target.value,
                              },
                            },
                          }))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        value={form.opening_hours[day].close}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            opening_hours: {
                              ...f.opening_hours,
                              [day]: {
                                ...f.opening_hours[day],
                                close: e.target.value,
                              },
                            },
                          }))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                  ) : (
                    <span className="text-sm italic text-slate-400">
                      Gesloten
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* SEO */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
              SEO
            </p>
            <div className="grid gap-4">
              <div>
                <Label>Paginatitel</Label>
                <input
                  value={form.seo_title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, seo_title: e.target.value }))
                  }
                  placeholder="Schepenkring Heeg | Jachten te koop"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>Meta-omschrijving</Label>
                <textarea
                  rows={3}
                  value={form.seo_description}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      seo_description: e.target.value,
                    }))
                  }
                  placeholder="Bezoek onze vestiging in Heeg…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <div>
                <Label>Trefwoorden</Label>
                <input
                  value={form.seo_keywords}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, seo_keywords: e.target.value }))
                  }
                  placeholder="jacht, heeg, te koop, friesland"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
            </div>
          </section>

          {/* Sticky save bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                {isEditing
                  ? `Wijzigingen voor ${locationName || "locatie"} worden opgeslagen.`
                  : "Nieuwe locatie wordt aangemaakt."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    router.push(
                      isEditing
                        ? `/${locale}/dashboard/${role}/locations/${locationId}`
                        : `/${locale}/dashboard/${role}/locations`,
                    )
                  }
                >
                  Annuleren
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving
                    ? "Opslaan…"
                    : isEditing
                      ? "Wijzigingen opslaan"
                      : "Locatie aanmaken"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Users tab ──────────────────────────────────────────────────────────── */}
      {isEditing && activeTab === "users" && (
        <div className="space-y-5">
          {/* Add user */}
          <section className="rounded-[20px] border border-blue-100 bg-blue-50 p-6 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-600">
              <UserPlus className="h-3.5 w-3.5" /> Medewerker koppelen
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
              >
                <option value="">— Selecteer gebruiker —</option>
                {availableToAdd.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.type})
                  </option>
                ))}
              </select>
              <select
                value={addUserRole}
                onChange={(e) => setAddUserRole(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400"
              >
                <option value="LOCATION_EMPLOYEE">Medewerker</option>
                <option value="LOCATION_MANAGER">Vestigingsmanager</option>
                <option value="BROKER">Makelaar</option>
              </select>
              <Button
                type="button"
                disabled={!addUserId || addingUser}
                onClick={() => void handleAddUser()}
                className="h-11 rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
              >
                {addingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="mr-1 h-4 w-4" />
                    Toevoegen
                  </>
                )}
              </Button>
            </div>
          </section>

          {/* User list */}
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Lead-toewijzing
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Bepaalt wie een nieuwe lead, chat of boeking krijgt toegewezen wanneer de boot zelf geen eigen verkoper heeft.
            </p>
            <select
              value={form.lead_assignment_mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lead_assignment_mode: e.target.value as FormState["lead_assignment_mode"],
                }))
              }
              className="mb-6 h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 sm:w-auto"
            >
              <option value="default_seller">Standaard verkoper (hieronder met ★ ingesteld)</option>
              <option value="round_robin">Rondgaand verdelen over actieve medewerkers</option>
              <option value="unassigned">Altijd onbeheerd — alleen in de locatie-inbox</option>
            </select>

            <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Gekoppelde medewerkers
            </p>
            {usersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : locationUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Geen medewerkers gekoppeld.
              </p>
            ) : (
              <div className="space-y-2">
                {locationUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {u.name}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            roleColor(u.type, u.location_role),
                          )}
                        >
                          {roleLabel(u.type, u.location_role)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            u.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-slate-200 text-slate-500",
                          )}
                        >
                          {u.status === "ACTIVE" ? "Actief" : "Inactief"}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="h-3 w-3 shrink-0" />
                        {u.email}
                        {u.last_login_at && (
                          <span className="text-slate-400">
                            · Ingelogd:{" "}
                            {new Date(u.last_login_at).toLocaleDateString(
                              "nl-NL",
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className={cn(
                          "h-8 w-8 rounded-lg border-amber-200 hover:bg-amber-50",
                          form.default_seller_id === u.id
                            ? "bg-amber-50 text-amber-600"
                            : "text-slate-400",
                        )}
                        title="Stel in als standaard verkoper"
                        disabled={settingDefaultSeller === u.id}
                        onClick={() => void handleSetDefaultSeller(u.id)}
                      >
                        {settingDefaultSeller === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Star className={cn("h-3.5 w-3.5", form.default_seller_id === u.id && "fill-amber-500")} />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
                        title="Imiteer gebruiker"
                        disabled={impersonating}
                        onClick={() => handleImpersonate(u)}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                        title="Verwijder van locatie"
                        onClick={() => void handleRemoveUser(u.id, u.name)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Create new user section */}
          <section className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                <UserPlus className="h-3.5 w-3.5" /> Nieuwe gebruiker aanmaken
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                onClick={() => setShowCreateUser((v) => !v)}
              >
                {showCreateUser ? "Sluiten" : "Formulier openen"}
              </Button>
            </div>

            {showCreateUser && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Naam *</label>
                    <Input
                      value={newUser.name}
                      onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                      placeholder="Volledige naam"
                      className="h-10 rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">E-mail *</label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                      placeholder="naam@voorbeeld.nl"
                      className="h-10 rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Wachtwoord * (min. 8)</label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                      placeholder="••••••••"
                      className="h-10 rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Telefoon</label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                      placeholder="+31 6 12345678"
                      className="h-10 rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rol</label>
                    <select
                      value={newUser.type}
                      onChange={(e) => setNewUser((u) => ({ ...u, type: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566]"
                    >
                      <option value="PARTNER">Vestigingsmanager</option>
                      <option value="EMPLOYEE">Medewerker</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label>
                    <select
                      value={newUser.status}
                      onChange={(e) => setNewUser((u) => ({ ...u, status: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566]"
                    >
                      <option value="ACTIVE">Actief</option>
                      <option value="INACTIVE">Inactief</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Locatie wordt automatisch ingesteld op <strong>{locationName}</strong>.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={() => setShowCreateUser(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="button"
                    disabled={creatingUser}
                    onClick={() => void handleCreateUser()}
                    className="h-9 rounded-xl bg-[#003566] text-white hover:bg-[#00284d]"
                  >
                    {creatingUser ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Gebruiker aanmaken
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Impersonation dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(impersonateTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonateTarget(null);
            setImpersonatePassword("");
            setImpersonateOtp("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-[#003566]">Gebruiker imiteren</DialogTitle>
            <DialogDescription className="text-slate-500">
              {impersonateTarget
                ? `Je staat op het punt om ${impersonateTarget.name} te imiteren.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Beheerderswachtwoord</label>
              <Input
                type="password"
                value={impersonatePassword}
                onChange={(e) => setImpersonatePassword(e.target.value)}
                className="h-10 rounded-xl border-slate-200"
                placeholder="Jouw wachtwoord"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">OTP-code (optioneel)</label>
              <Input
                type="text"
                value={impersonateOtp}
                onChange={(e) => setImpersonateOtp(e.target.value)}
                className="h-10 rounded-xl border-slate-200"
                placeholder="123456"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImpersonateTarget(null)}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              disabled={!impersonatePassword.trim() || impersonating}
              onClick={() => void executeImpersonation()}
              className="bg-[#003566] text-white hover:bg-[#00284d]"
            >
              {impersonating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Bezig…</>
              ) : "Imiteren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
