"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Globe2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Rss,
  Code2,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Platform {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  platform_type: string;
  export_method: string;
  feed_url: string | null;
  api_url: string | null;
  is_active: boolean;
  is_openmarine_enabled: boolean;
  supported_countries: string[];
  supported_languages: string[];
  contact_person: string | null;
  contact_email: string | null;
  notes: string | null;
  priority: number;
  boats_count?: number;
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  marketplace: "Marktplaats",
  portal: "Portaal",
  own_website: "Eigen website",
  partner: "Partner",
  aggregator: "Aggregator",
  social: "Social",
  other: "Overig",
};

const TYPE_COLORS: Record<string, string> = {
  marketplace: "bg-blue-50 border-blue-200 text-blue-700",
  portal: "bg-purple-50 border-purple-200 text-purple-700",
  own_website: "bg-green-50 border-green-200 text-green-700",
  partner: "bg-orange-50 border-orange-200 text-orange-700",
  aggregator: "bg-teal-50 border-teal-200 text-teal-700",
  social: "bg-pink-50 border-pink-200 text-pink-700",
  other: "bg-slate-50 border-slate-200 text-slate-600",
};

const EXPORT_METHOD_ICON: Record<string, React.ReactNode> = {
  openmarine_feed: <Rss size={12} />,
  api_push: <Code2 size={12} />,
  xml_feed: <Rss size={12} />,
  manual: <Package size={12} />,
};

export default function PlatformsPage() {
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Platform[] | { data: Platform[] }>("/admin/platforms");
      const data = Array.isArray(res.data) ? res.data : ((res.data as { data?: Platform[] })?.data ?? []);
      setPlatforms(data);
    } catch {
      toast.error("Kon platforms niet laden.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (platform: Platform) => {
    setTogglingId(platform.id);
    try {
      await api.patch(`/admin/platforms/${platform.id}`, { is_active: !platform.is_active });
      setPlatforms((prev) =>
        prev.map((p) => p.id === platform.id ? { ...p, is_active: !p.is_active } : p)
      );
      toast.success(platform.is_active ? "Platform gedeactiveerd." : "Platform geactiveerd.");
    } catch {
      toast.error("Kon platform status niet bijwerken.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (platform: Platform) => {
    if (!confirm(`Weet je zeker dat je "${platform.name}" wilt verwijderen? Dit verwijdert ook alle gerelateerde publicatie-instellingen per boot.`)) return;
    setDeletingId(platform.id);
    try {
      await api.delete(`/admin/platforms/${platform.id}`);
      setPlatforms((prev) => prev.filter((p) => p.id !== platform.id));
      toast.success("Platform verwijderd.");
    } catch {
      toast.error("Kon platform niet verwijderen.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = platforms.filter((p) => {
    const matchSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.platform_type.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || p.platform_type === filterType;
    const matchActive = filterActive === "all" || (filterActive === "active" ? p.is_active : !p.is_active);
    return matchSearch && matchType && matchActive;
  });

  const allTypes = Array.from(new Set(platforms.map((p) => p.platform_type)));
  const activeCount = platforms.filter((p) => p.is_active).length;
  const openMarineCount = platforms.filter((p) => p.is_openmarine_enabled).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#003566] tracking-tight flex items-center gap-3">
            <Globe2 size={24} className="text-blue-500" />
            Platform Netwerk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Beheer externe publicatieplatformen voor boot-export en synchronisatie.
          </p>
        </div>
        <Button
          onClick={() => router.push(`${root}/platforms/new`)}
          className="bg-[#003566] hover:bg-[#002244] text-white gap-2 shrink-0"
        >
          <Plus size={16} /> Nieuw Platform
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Totaal platforms", value: platforms.length, color: "text-slate-700" },
          { label: "Actief", value: activeCount, color: "text-green-600" },
          { label: "Inactief", value: platforms.length - activeCount, color: "text-slate-400" },
          { label: "OpenMarine", value: openMarineCount, color: "text-blue-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{card.label}</p>
            <p className={cn("text-3xl font-black mt-1", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Zoek platform..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
        >
          <option value="all">Alle types</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
        >
          <option value="all">Alle statussen</option>
          <option value="active">Actief</option>
          <option value="inactive">Inactief</option>
        </select>
        <button
          onClick={() => void load()}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Platform list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" /> Laden...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Globe2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{platforms.length === 0 ? "Nog geen platforms aangemaakt." : "Geen platforms gevonden."}</p>
          {platforms.length === 0 && (
            <Button
              onClick={() => router.push(`${root}/platforms/new`)}
              className="mt-4 bg-[#003566] text-white gap-2"
            >
              <Plus size={14} /> Eerste platform aanmaken
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((platform) => (
            <div
              key={platform.id}
              className={cn(
                "bg-white border rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 transition-all",
                platform.is_active ? "border-slate-200 hover:border-blue-200" : "border-slate-100 opacity-60"
              )}
            >
              {/* Logo / Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                {platform.logo_url ? (
                  <img src={platform.logo_url} alt={platform.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Globe2 size={20} className="text-slate-400" />
                )}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{platform.name}</h3>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide", TYPE_COLORS[platform.platform_type] ?? TYPE_COLORS.other)}>
                    {TYPE_LABELS[platform.platform_type] ?? platform.platform_type}
                  </span>
                  {platform.is_openmarine_enabled && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-50 border-indigo-200 text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                      <Rss size={9} /> OpenMarine
                    </span>
                  )}
                  {!platform.is_active && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-500 uppercase tracking-wide">
                      Inactief
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {platform.website_url && (
                    <a href={platform.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600">
                      <ExternalLink size={10} /> {platform.website_url.replace(/^https?:\/\//, "").split("/")[0]}
                    </a>
                  )}
                  <span className="flex items-center gap-1">
                    {EXPORT_METHOD_ICON[platform.export_method] ?? <Package size={10} />}
                    {platform.export_method === "openmarine_feed" ? "OpenMarine Feed"
                      : platform.export_method === "api_push" ? "API Push"
                      : platform.export_method === "xml_feed" ? "XML Feed"
                      : platform.export_method === "manual" ? "Handmatig"
                      : platform.export_method}
                  </span>
                  {typeof platform.boats_count === "number" && (
                    <span>{platform.boats_count} boten</span>
                  )}
                  {platform.last_sync_at && (
                    <span>Gesynchroniseerd: {new Date(platform.last_sync_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </div>
                {platform.supported_countries.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Landen: {platform.supported_countries.join(", ")}
                  </p>
                )}
              </div>

              {/* Priority badge */}
              <div className="flex-shrink-0 hidden sm:flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Prioriteit</span>
                <span className="text-xl font-black text-slate-300">{platform.priority}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => void handleToggleActive(platform)}
                  disabled={togglingId === platform.id}
                  title={platform.is_active ? "Deactiveren" : "Activeren"}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                    platform.is_active
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {togglingId === platform.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : platform.is_active ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  {platform.is_active ? "Actief" : "Inactief"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`${root}/platforms/${platform.id}`)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Pencil size={12} /> Bewerken
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(platform)}
                  disabled={deletingId === platform.id}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  {deletingId === platform.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
