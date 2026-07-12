"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Anchor,
  ArrowLeft,
  BarChart3,
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarDays,
  Euro,
  Globe,
  History,
  Inbox as InboxIcon,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  RefreshCcw,
  Settings,
  Ship,
  Users,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setClientSession } from "@/lib/auth/client-session";
import { useClientSession } from "@/components/session/ClientSessionProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type Location = {
  id: number;
  name: string;
  code: string;
  slug?: string | null;
  status: string;
  public_visible?: boolean;
  location_color?: string | null;
  // address
  address_line1?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  sender_email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // content
  description_nl?: string | null;
  description_en?: string | null;
  description_de?: string | null;
  opening_hours?: Record<string, { open: string; close: string; closed: boolean }> | null;
  hero_image?: string | null;
  default_seller_id?: number | null;
  default_seller?: { id: number; name: string; email: string } | null;
  lead_assignment_mode?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  // counts
  staff_total?: number;
  clients_total?: number;
  boats_total?: number;
  yachts_total?: number;
  open_leads?: number;
  open_conversations?: number;
  open_tasks?: number;
};

type Stats = {
  active_yachts: number;
  total_yachts: number;
  sold_yachts: number;
  revenue: number;
  active_boats: number;
  new_leads_month: number;
  open_leads: number;
  open_chats: number;
  total_chats: number;
  open_viewing_requests: number;
  open_offers: number;
  upcoming_bookings: number;
  staff_count: number;
  client_count: number;
  open_tasks: number;
  conversion_rate: number;
  avg_response_time_minutes: number | null;
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

type TimelineEntry = {
  id: number;
  action: string;
  risk_level: string;
  result: string;
  actor_id?: number | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
};

type InboxLead = { id: number; name?: string | null; email?: string | null; phone?: string | null; yacht_id?: number | null; created_at: string };
type InboxConversation = { id: string; boat_id?: number | null; status: string; created_at?: string; last_customer_message_at?: string };
type InboxOffer = { id: number; yacht_id?: number | null; buyer_name?: string | null; amount?: number | null; status: string; created_at: string };

type Inbox = {
  counts: {
    new_leads: number;
    unread_chats: number;
    viewing_requests: number;
    questions: number;
    callback_requests: number;
    offers: number;
  };
  new_leads: InboxLead[];
  unread_chats: InboxConversation[];
  viewing_requests: InboxConversation[];
  questions: InboxConversation[];
  callback_requests: InboxConversation[];
  offers: InboxOffer[];
};

type Tab =
  | "overview"
  | "employees"
  | "boats"
  | "leads"
  | "chats"
  | "offers"
  | "bookings"
  | "calendar"
  | "stats"
  | "timeline"
  | "inbox"
  | "calls"
  | "settings";

type CallRow = {
  id: string;
  provider: string | null;
  direction: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  cost_eur: string | null;
  created_at: string;
  seller?: { name: string } | null;
  yacht?: { boat_name: string } | null;
  campaign?: { name: string } | null;
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Ma", tue: "Di", wed: "Wo", thu: "Do", fri: "Vr", sat: "Za", sun: "Zo",
};

// ── Role helpers ───────────────────────────────────────────────────────────────

function roleLabel(type: string, locationRole?: string | null): string {
  if (locationRole === "LOCATION_MANAGER") return "Vestigingsmanager";
  if (locationRole === "BROKER") return "Makelaar";
  if (locationRole === "LOCATION_EMPLOYEE") return "Medewerker";
  if (type === "ADMIN") return "Admin";
  if (type === "EMPLOYEE") return "Medewerker";
  if (type === "PARTNER") return "Vestigingsmanager";
  return type;
}

function roleColor(locationRole?: string | null, type?: string): string {
  if (locationRole === "LOCATION_MANAGER") return "bg-blue-100 text-blue-700";
  if (locationRole === "BROKER") return "bg-teal-100 text-teal-700";
  if (type === "ADMIN") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-600";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LocationDetailPage({
  locale,
  role,
  locationId,
}: {
  locale: string;
  role: string;
  locationId: number;
}) {
  const isNl = locale === "nl";
  const router = useRouter();
  const { user: sessionUser } = useClientSession();

  const [location, setLocation] = useState<Location | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<LocationUser[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; type: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [addUserId, setAddUserId] = useState("");
  const [addUserRole, setAddUserRole] = useState("LOCATION_EMPLOYEE");
  const [addingUser, setAddingUser] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const res = await api.get(`/admin/locations/${locationId}/stats`);
    setLocation(res.data?.location ?? null);
    setStats(res.data?.stats ?? null);
  }, [locationId]);

  const loadUsers = useCallback(async () => {
    const res = await api.get(`/admin/locations/${locationId}/users`);
    setUsers(Array.isArray(res.data?.data) ? res.data.data : []);
  }, [locationId]);

  const loadTimeline = useCallback(async () => {
    const res = await api.get(`/admin/locations/${locationId}/timeline`);
    setTimeline(Array.isArray(res.data?.data) ? res.data.data : []);
  }, [locationId]);

  const loadCalls = useCallback(async () => {
    const res = await api.get(`/admin/voice-ai/calls`, { params: { location_id: locationId, per_page: 25 } });
    setCalls(Array.isArray(res.data?.data) ? res.data.data : []);
  }, [locationId]);

  const loadInbox = useCallback(async () => {
    const res = await api.get(`/admin/locations/${locationId}/inbox`);
    setInbox(res.data ?? null);
  }, [locationId]);

  const loadAllUsers = useCallback(async () => {
    const res = await api.get("/admin/users");
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    setAllUsers(list.map((u: { id: number; name: string; type: string }) => ({ id: u.id, name: u.name, type: u.type })));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadTimeline(), loadInbox(), loadAllUsers(), loadCalls()])
      .catch(() => toast.error("Laden mislukt."))
      .finally(() => setLoading(false));
  }, [loadStats, loadUsers, loadTimeline, loadInbox, loadAllUsers, loadCalls]);

  // ── User management ───────────────────────────────────────────────────────────

  const handleAddUser = async () => {
    if (!addUserId) return;
    setAddingUser(true);
    try {
      await api.post(`/admin/locations/${locationId}/users`, {
        user_id: Number(addUserId),
        role: addUserRole,
      });
      toast.success("Gebruiker toegevoegd.");
      setAddUserId("");
      await loadUsers();
    } catch {
      toast.error("Toevoegen mislukt.");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId: number, name: string) => {
    try {
      await api.delete(`/admin/locations/${locationId}/users/${userId}`);
      toast.success(`${name} verwijderd.`);
      setUsers((p) => p.filter((u) => u.id !== userId));
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  };

  const handleImpersonate = async (u: LocationUser) => {
    setImpersonating(true);
    try {
      const password = prompt("Voer je beheerderswachtwoord in om te imiteren:");
      if (!password) { setImpersonating(false); return; }

      const res = await api.post(
        `/admin/impersonate/${u.id}`,
        { password },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      const token = res.data?.token;
      const imp = res.data?.impersonated;
      if (!token || !imp) throw new Error("failed");

      const roleMap: Record<string, string> = {
        ADMIN: "admin", EMPLOYEE: "employee", PARTNER: "partner",
        CLIENT: "client", SELLER: "seller", BUYER: "buyer",
      };
      const nextRole = roleMap[imp.type] ?? "client";

      setClientSession(token, {
        id: String(imp.id), name: imp.name, email: imp.email,
        role: nextRole as Parameters<typeof setClientSession>[1]["role"],
        type: imp.type, status: imp.status, phone: imp.phone ?? null,
        location_id: imp.location_id ?? null, location_role: imp.location_role ?? null,
        client_location_id: imp.client_location_id ?? null,
        has_location_assignment: imp.has_location_assignment ?? false,
        can_access_board: imp.can_access_board ?? false,
        location: imp.location ?? null, locations: imp.locations ?? [],
      });

      localStorage.setItem("impersonation_session", JSON.stringify({
        started_at: res.data?.session?.started_at,
        impersonated_id: imp.id,
        impersonated_name: imp.name,
      }));

      toast.success(`Imitatie gestart: ${imp.name}`);
      setTimeout(() => {
        router.push(`/${locale}/dashboard/${nextRole}`);
        router.refresh();
      }, 300);
    } catch {
      toast.error("Imitatie mislukt.");
    } finally {
      setImpersonating(false);
    }
  };

  // ── Formatters ────────────────────────────────────────────────────────────────

  const fmt = (v: string) =>
    new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      "location.created": "Locatie aangemaakt",
      "location.updated": "Locatie bijgewerkt",
      "location.archived": "Locatie gearchiveerd",
      "location.user_added": "Gebruiker toegevoegd",
      "location.user_removed": "Gebruiker verwijderd",
      "admin.user.create": "Gebruiker aangemaakt",
      "admin.user.locations": "Locatie-toewijzing gewijzigd",
    };
    return map[action] ?? action;
  };

  const availableToAdd = allUsers.filter((u) => !users.find((lu) => lu.id === u.id));

  const accentColor = location?.location_color ?? "#003566";

  const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "overview",   label: "Overzicht",    icon: <Activity className="h-4 w-4" /> },
    { key: "inbox",      label: "Inbox",        icon: <InboxIcon className="h-4 w-4" /> },
    { key: "employees",  label: "Medewerkers",  icon: <Users className="h-4 w-4" /> },
    { key: "boats",      label: "Boten",        icon: <Ship className="h-4 w-4" /> },
    { key: "leads",      label: "Leads",        icon: <MessageSquare className="h-4 w-4" /> },
    { key: "chats",      label: "Chats",        icon: <MessageSquare className="h-4 w-4" /> },
    { key: "offers",     label: "Biedingen",    icon: <Euro className="h-4 w-4" /> },
    { key: "bookings",   label: "Boekingen",    icon: <CalendarCheck className="h-4 w-4" /> },
    { key: "calendar",   label: "Kalender",     icon: <CalendarIcon className="h-4 w-4" /> },
    { key: "stats",      label: "Statistieken", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "timeline",   label: "Tijdlijn",     icon: <History className="h-4 w-4" /> },
    { key: "calls",      label: "Voice calls",  icon: <Phone className="h-4 w-4" /> },
    { key: "settings",   label: "Instellingen", icon: <Settings className="h-4 w-4" /> },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-slate-500">Locatie niet gevonden.</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/dashboard/${role}/locations`}><ArrowLeft className="mr-2 h-4 w-4" />Terug</Link>
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Back + header */}
      <div>
        <Link href={`/${locale}/dashboard/${role}/locations`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Alle locaties
        </Link>

        <div
          className="rounded-[28px] p-8 text-white shadow-xl"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)` }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Anchor className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/60">
                    {location.code} · {location.status === "ACTIVE" ? "Actief" : "Inactief"}
                  </p>
                  <h1 className="text-3xl font-serif italic text-white">{location.name}</h1>
                </div>
              </div>
              {location.city && (
                <p className="flex items-center gap-1.5 text-sm text-white/70 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[location.address_line1, location.city, location.country].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-3">
                {location.phone && (
                  <a href={`tel:${location.phone}`} className="flex items-center gap-1 text-xs text-white/70 hover:text-white">
                    <Phone className="h-3 w-3" />{location.phone}
                  </a>
                )}
                {location.email && (
                  <a href={`mailto:${location.email}`} className="flex items-center gap-1 text-xs text-white/70 hover:text-white">
                    <Mail className="h-3 w-3" />{location.email}
                  </a>
                )}
                {location.website && (
                  <a href={location.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-white/70 hover:text-white">
                    <Globe className="h-3 w-3" />{location.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void Promise.all([loadStats(), loadUsers(), loadTimeline(), loadInbox(), loadCalls()])}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />Verversen
              </Button>
              <Button asChild size="sm" className="rounded-xl bg-white text-slate-800 hover:bg-white/90">
                <Link href={`/${locale}/dashboard/${role}/locations/${locationId}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Bewerken</Link>
              </Button>
            </div>
          </div>

          {/* Quick stats bar */}
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {[
                { label: "Actieve jachten",  value: stats.active_yachts },
                { label: "Actieve boten",    value: stats.active_boats },
                { label: "Nieuwe leads",     value: stats.new_leads_month, suffix: "/mnd" },
                { label: "Open chats",       value: stats.open_chats },
                { label: "Medewerkers",      value: stats.staff_count },
                { label: "Open taken",       value: stats.open_tasks },
              ].map(({ label, value, suffix }) => (
                <div key={label} className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-white">{value}{suffix}</p>
                  <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 overflow-x-auto">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === key
                ? "bg-[#003566] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Actieve jachten",  value: stats.active_yachts,    total: stats.total_yachts,    color: "blue" },
            { label: "Actieve boten",    value: stats.active_boats,      total: null,                  color: "blue" },
            { label: "Open leads",       value: stats.open_leads,        total: stats.new_leads_month, color: "amber" },
            { label: "Open chats",       value: stats.open_chats,        total: stats.total_chats,     color: "teal" },
            { label: "Medewerkers",      value: stats.staff_count,       total: null,                  color: "purple" },
            { label: "Klanten",          value: stats.client_count,      total: null,                  color: "slate" },
          ].map(({ label, value, total, color }) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
              <p className={cn("mt-2 text-4xl font-bold", `text-${color}-600`)}>{value}</p>
              {total !== null && (
                <p className="mt-1 text-sm text-slate-400">{total} totaal</p>
              )}
            </div>
          ))}

          {/* Opening hours */}
          {location.opening_hours && (
            <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                <CalendarDays className="h-3.5 w-3.5" /> Openingstijden
              </p>
              <div className="space-y-1.5">
                {DAYS.map((day) => {
                  const h = location.opening_hours?.[day];
                  return (
                    <div key={day} className="flex items-center justify-between text-sm">
                      <span className="w-8 font-semibold text-slate-600">{DAY_LABELS[day]}</span>
                      {h?.closed
                        ? <span className="text-slate-400 italic text-xs">Gesloten</span>
                        : <span className="text-slate-700">{h?.open ?? "–"} – {h?.close ?? "–"}</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline preview */}
          {timeline.length > 0 && (
            <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                <Activity className="h-3.5 w-3.5" /> Recente activiteit
              </p>
              <div className="space-y-2">
                {timeline.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <span className="shrink-0 w-36 text-xs text-slate-400 tabular-nums">{fmt(entry.created_at)}</span>
                    <span className="text-slate-700">{actionLabel(entry.action)}</span>
                    {entry.meta && typeof entry.meta === "object" && "name" in entry.meta && (
                      <span className="text-slate-500 text-xs">· {String(entry.meta.name)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Employees ─────────────────────────────────────────────── */}
      {tab === "employees" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          {/* Add user */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />Gebruiker koppelen
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="">— Selecteer gebruiker —</option>
                {availableToAdd.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                ))}
              </select>
              <select
                value={addUserRole}
                onChange={(e) => setAddUserRole(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="LOCATION_MANAGER">Vestigingsmanager</option>
                <option value="LOCATION_EMPLOYEE">Medewerker</option>
                <option value="BROKER">Makelaar</option>
              </select>
              <Button
                type="button"
                className="h-10 rounded-xl bg-[#003566] text-white hover:bg-[#0B4A8B]"
                disabled={!addUserId || addingUser}
                onClick={() => void handleAddUser()}
              >
                {addingUser ? <Loader2 className="animate-spin h-4 w-4" /> : <><UserPlus className="h-4 w-4 mr-1" />Toevoegen</>}
              </Button>
            </div>
          </div>

          {/* User list */}
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Geen gebruikers gekoppeld.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{u.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", roleColor(u.location_role, u.type))}>
                        {roleLabel(u.type, u.location_role)}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", u.status === "ACTIVE" ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500")}>
                        {u.status === "ACTIVE" ? "Actief" : "Inactief"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-2">
                      <Mail className="h-3 w-3 shrink-0" />{u.email}
                      {u.last_login_at && (
                        <span className="text-slate-400">· Ingelogd: {new Date(u.last_login_at).toLocaleDateString("nl-NL")}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <Button
                      type="button" size="icon" variant="outline"
                      className="h-8 w-8 rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50"
                      title="Imiteer gebruiker"
                      disabled={impersonating}
                      onClick={() => void handleImpersonate(u)}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" size="icon" variant="outline"
                      className="h-8 w-8 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
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
        </div>
      )}

      {/* ── Inbox ─────────────────────────────────────────────────── */}
      {tab === "inbox" && (
        <div className="space-y-6">
          {inbox && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Nieuwe leads",       value: inbox.counts.new_leads },
                { label: "Ongelezen chats",    value: inbox.counts.unread_chats },
                { label: "Bezichtigingen",     value: inbox.counts.viewing_requests },
                { label: "Vragen",             value: inbox.counts.questions },
                { label: "Terugbelverzoeken",  value: inbox.counts.callback_requests },
                { label: "Biedingen",          value: inbox.counts.offers },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
                  <p className={cn("text-2xl font-bold", value > 0 ? "text-[#003566]" : "text-slate-300")}>{value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          <InboxSection
            title="Nieuwe leads"
            emptyText="Geen nieuwe leads."
            items={inbox?.new_leads ?? []}
            renderItem={(lead) => (
              <>
                <span className="font-semibold text-slate-800">{lead.name || lead.email || `Lead #${lead.id}`}</span>
                {lead.phone && <span className="text-slate-400"> · {lead.phone}</span>}
              </>
            )}
            timestamp={(lead) => lead.created_at}
          />

          <InboxSection
            title="Ongelezen chats"
            emptyText="Geen ongelezen chats."
            items={inbox?.unread_chats ?? []}
            renderItem={(c) => <span className="font-semibold text-slate-800">Boot #{c.boat_id ?? "—"}</span>}
            timestamp={(c) => c.last_customer_message_at ?? c.created_at ?? ""}
          />

          <InboxSection
            title="Bezichtigingsverzoeken"
            emptyText="Geen openstaande bezichtigingen."
            items={inbox?.viewing_requests ?? []}
            renderItem={(c) => <span className="font-semibold text-slate-800">Boot #{c.boat_id ?? "—"}</span>}
            timestamp={(c) => c.created_at ?? ""}
          />

          <InboxSection
            title="Vragen"
            emptyText="Geen openstaande vragen."
            items={inbox?.questions ?? []}
            renderItem={(c) => <span className="font-semibold text-slate-800">Boot #{c.boat_id ?? "—"}</span>}
            timestamp={(c) => c.created_at ?? ""}
          />

          <InboxSection
            title="Terugbelverzoeken"
            emptyText="Geen openstaande terugbelverzoeken."
            items={inbox?.callback_requests ?? []}
            renderItem={(c) => <span className="font-semibold text-slate-800">Boot #{c.boat_id ?? "—"}</span>}
            timestamp={(c) => c.created_at ?? ""}
          />

          <InboxSection
            title="Biedingen"
            emptyText="Geen openstaande biedingen."
            items={inbox?.offers ?? []}
            renderItem={(o) => (
              <>
                <span className="font-semibold text-slate-800">{o.buyer_name || `Bod #${o.id}`}</span>
                {o.amount != null && (
                  <span className="text-slate-400"> · €{Number(o.amount).toLocaleString("nl-NL")}</span>
                )}
              </>
            )}
            timestamp={(o) => o.created_at}
          />
        </div>
      )}

      {/* ── Boats ─────────────────────────────────────────────────── */}
      {tab === "boats" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <Ship className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Bekijk alle boten die gekoppeld zijn aan {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/yachts?location=${locationId}`}>Boten bekijken</Link>
          </Button>
        </div>
      )}

      {/* ── Leads ─────────────────────────────────────────────────── */}
      {tab === "leads" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Bekijk alle leads voor {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/chat?location=${locationId}`}>Leads bekijken</Link>
          </Button>
        </div>
      )}

      {/* ── Chats ─────────────────────────────────────────────────── */}
      {tab === "chats" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Bekijk alle chats voor {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/chat?location=${locationId}`}>Chats bekijken</Link>
          </Button>
        </div>
      )}

      {/* ── Offers ────────────────────────────────────────────────── */}
      {tab === "offers" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <Euro className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Bekijk alle biedingen voor {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/offers?location=${locationId}`}>Biedingen bekijken</Link>
          </Button>
        </div>
      )}

      {/* ── Bookings ──────────────────────────────────────────────── */}
      {tab === "bookings" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Bekijk alle boekingen en bezichtigingen voor {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/bookings?location=${locationId}&view=list`}>Boekingen bekijken</Link>
          </Button>
        </div>
      )}

      {/* ── Calendar ──────────────────────────────────────────────── */}
      {tab === "calendar" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm text-center">
          <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 text-sm mb-4">Open de kalenderweergave met bezichtigingen voor {location.name}.</p>
          <Button asChild className="rounded-xl bg-[#003566] text-white">
            <Link href={`/${locale}/dashboard/${role}/bookings?location=${locationId}&view=calendar`}>Kalender openen</Link>
          </Button>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────── */}
      {tab === "stats" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Totale jachten",      value: String(stats.total_yachts) },
            { label: "Actieve jachten",     value: String(stats.active_yachts) },
            { label: "Verkocht",            value: String(stats.sold_yachts) },
            { label: "Omzet (verkocht)",    value: `€${stats.revenue.toLocaleString("nl-NL")}` },
            { label: "Conversieratio",      value: `${stats.conversion_rate}%` },
            {
              label: "Gem. reactietijd",
              value:
                stats.avg_response_time_minutes == null
                  ? "—"
                  : stats.avg_response_time_minutes < 60
                    ? `${stats.avg_response_time_minutes} min`
                    : `${Math.floor(stats.avg_response_time_minutes / 60)}u ${stats.avg_response_time_minutes % 60}m`,
            },
            { label: "Nieuwe leads (mnd)",  value: String(stats.new_leads_month) },
            { label: "Open leads",          value: String(stats.open_leads) },
            { label: "Totale chats",        value: String(stats.total_chats) },
            { label: "Open chats",          value: String(stats.open_chats) },
            { label: "Open bezichtigingen", value: String(stats.open_viewing_requests) },
            { label: "Open biedingen",      value: String(stats.open_offers) },
            { label: "Aankomende boekingen",value: String(stats.upcoming_bookings) },
            { label: "Open taken",          value: String(stats.open_tasks) },
            { label: "Medewerkers",         value: String(stats.staff_count) },
            { label: "Klanten",             value: String(stats.client_count) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-2 text-4xl font-bold text-[#003566]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Timeline ──────────────────────────────────────────────── */}
      {tab === "timeline" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nog geen activiteit voor deze locatie.</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 text-sm last:border-0">
                  <span className="shrink-0 w-36 text-xs text-slate-400 tabular-nums">{fmt(entry.created_at)}</span>
                  <span className="text-slate-700">{actionLabel(entry.action)}</span>
                  {entry.meta && typeof entry.meta === "object" && "name" in entry.meta && (
                    <span className="text-slate-500 text-xs">· {String(entry.meta.name)}</span>
                  )}
                  {entry.result === "FAIL" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">Mislukt</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Voice calls ───────────────────────────────────────────── */}
      {tab === "calls" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          {calls.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nog geen gesprekken voor deze locatie.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {calls.map((call) => (
                <div key={call.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
                        call.provider === "retell" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {call.provider ?? "onbekend"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {call.seller?.name ?? call.yacht?.boat_name ?? "Onbekend"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {call.direction} {call.campaign ? `· ${call.campaign.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-slate-600">{call.outcome ?? call.status}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">{fmt(call.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings ──────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Locatie-instellingen</h2>
            <Button asChild className="rounded-xl bg-[#003566] text-white">
              <Link href={`/${locale}/dashboard/${role}/locations/${locationId}/edit`}><Pencil className="h-4 w-4 mr-1.5" />Bewerken</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Naam" value={location.name} />
            <Field label="Code" value={location.code} />
            <Field label="Slug" value={location.slug} />
            <Field label="Status" value={location.status} />
            <Field label="Standaard verkoper" value={location.default_seller?.name} />
            <Field
              label="Lead-toewijzing"
              value={
                location.lead_assignment_mode === "round_robin"
                  ? "Rondgaand over medewerkers"
                  : location.lead_assignment_mode === "unassigned"
                    ? "Altijd onbeheerd (inbox)"
                    : "Standaard verkoper"
              }
            />
            <Field label="WhatsApp" value={location.whatsapp_number} />
            <Field label="Afzender e-mail" value={location.sender_email} />
            <Field label="Publiek zichtbaar" value={location.public_visible ? "Ja" : "Nee"} />
            <Field label="Locatiekleur" value={location.location_color} color={location.location_color} />
          </div>

          {location.description_nl && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Omschrijving (NL)</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{location.description_nl}</p>
            </div>
          )}

          {location.seo_title && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">SEO</p>
              <Field label="Titel" value={location.seo_title} />
              <Field label="Beschrijving" value={location.seo_description} />
              <Field label="Trefwoorden" value={location.seo_keywords} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InboxSection<T extends { id: number | string }>({
  title,
  emptyText,
  items,
  renderItem,
  timestamp,
}: {
  title: string;
  emptyText: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  timestamp: (item: T) => string;
}) {
  const fmtShort = (v: string) =>
    v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "—";

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
        {title} {items.length > 0 && <span className="text-slate-300">· {items.length}</span>}
      </p>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-50 py-2 text-sm last:border-0">
              <span>{renderItem(item)}</span>
              <span className="shrink-0 text-xs text-slate-400 tabular-nums">{fmtShort(timestamp(item))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, color }: { label: string; value?: string | null; color?: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {color && <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ background: color }} />}
        <p className="text-sm text-slate-700">{value ?? <span className="text-slate-300 italic">—</span>}</p>
      </div>
    </div>
  );
}
