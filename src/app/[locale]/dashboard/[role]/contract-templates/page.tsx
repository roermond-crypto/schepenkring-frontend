"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  FileText,
  Plus,
  Copy,
  Archive,
  Star,
  Globe2,
  MapPin,
  Loader2,
  Search,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface ContractTemplate {
  id: number;
  name: string;
  type: string;
  location_id: number | null;
  location?: { id: number; name: string } | null;
  language: string;
  is_global: boolean;
  is_default: boolean;
  is_active: boolean;
  is_archived: boolean;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

interface TemplateType {
  value: string;
  label: string;
}

interface LocationOption {
  id: number;
  name: string;
}

const LANG_FLAG: Record<string, string> = { nl: "🇳🇱", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷" };

const TYPE_COLORS: Record<string, string> = {
  purchase_contract: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-200",
  seller_assignment: "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/30 dark:border-purple-900/60 dark:text-purple-200",
  viewing_agreement: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900/60 dark:text-green-200",
  offer_agreement: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-900/60 dark:text-orange-200",
  delivery_document: "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/30 dark:border-teal-900/60 dark:text-teal-200",
  brokerage_agreement: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/60 dark:text-rose-200",
};

export default function ContractTemplatesPage() {
  const t = useTranslations("ContractTemplates");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [types, setTypes] = useState<TemplateType[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);
  const [settingDefault, setSettingDefault] = useState<number | null>(null);

  useEffect(() => { void loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, typesRes, locRes] = await Promise.all([
        api.get<ContractTemplate[]>("/admin/contract-templates"),
        api.get<{ types: TemplateType[] }>("/admin/contract-templates/types"),
        api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200"),
      ]);
      setTemplates(Array.isArray(tRes.data) ? tRes.data : (Array.isArray((tRes.data as { data?: unknown })?.data) ? (tRes.data as { data: ContractTemplate[] }).data : []));
      setTypes(typesRes.data?.types ?? []);
      setLocations(locRes.data?.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await api.post<{ template: ContractTemplate }>("/admin/contract-templates", {
        name: "Nieuw sjabloon",
        type: "purchase_contract",
        language: "nl",
        content_html: `<h1>Koopovereenkomst</h1>
<p>Datum: <strong>{{contract_date}}</strong></p>
<h2>Partijen</h2>
<p><strong>Verkoper:</strong> {{seller_name}}, {{seller_address}}</p>
<p><strong>Koper:</strong> {{buyer_name}}, {{buyer_address}}</p>
<h2>Vaartuig</h2>
<p>{{boat_brand}} {{boat_model}}, bouwjaar {{boat_year}}, ligplaats {{boat_location}}</p>
<h2>Koopprijs</h2>
<p>De koopprijs bedraagt <strong>{{boat_price}}</strong></p>
<h2>Handtekeningen</h2>
<p>Verkoper: _________________________ &nbsp;&nbsp; Koper: _________________________</p>
<p>{{location_name}} · {{location_address}}</p>`,
      });
      const t = res.data?.template;
      if (t?.id) router.push(`${root}/contract-templates/${t.id}`);
      else await loadData();
    } catch {
      toast.error(t("createFailed"));
    }
  };

  const handleDuplicate = async (template: ContractTemplate) => {
    setDuplicating(template.id);
    try {
      await api.post(`/admin/contract-templates/${template.id}/duplicate`);
      toast.success(t("duplicateSuccess"));
      await loadData();
    } catch {
      toast.error(t("duplicateFailed"));
    } finally {
      setDuplicating(null);
    }
  };

  const handleArchive = async (template: ContractTemplate) => {
    if (!confirm(t("archiveConfirm", { name: template.name }))) return;
    setArchiving(template.id);
    try {
      await api.delete(`/admin/contract-templates/${template.id}`);
      toast.success(t("archiveSuccess"));
      await loadData();
    } catch {
      toast.error(t("archiveFailed"));
    } finally {
      setArchiving(null);
    }
  };

  const handleSetDefault = async (template: ContractTemplate) => {
    setSettingDefault(template.id);
    try {
      await api.post(`/admin/contract-templates/${template.id}/set-default`);
      toast.success(t("setDefaultSuccess"));
      await loadData();
    } catch {
      toast.error(t("setDefaultFailed"));
    } finally {
      setSettingDefault(null);
    }
  };

  const typeLabel = (type: string) => types.find((t) => t.value === type)?.label ?? type;

  const filtered = templates.filter((t) => {
    if (!showArchived && t.is_archived) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterScope === "global" && !t.is_global) return false;
    if (filterScope === "location" && t.is_global) return false;
    if (filterLocationId && String(t.location_id) !== filterLocationId) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped: Record<string, ContractTemplate[]> = {};
  filtered.forEach((template) => {
    const key = template.is_global ? t("globalMasterTemplates") : (template.location?.name ?? t("unknownLocation"));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(template);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003566] text-white">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t("title")}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
            </div>
          </div>
          <Button onClick={() => void handleCreate()} className="bg-[#003566] text-white hover:bg-blue-900 rounded-xl">
            <Plus size={16} className="mr-2" />
            {t("newTemplate")}
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="h-9 pl-8 w-52 rounded-xl text-sm" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            <option value="all">{t("allTypes")}</option>
            {types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            <option value="all">{t("scopeAll")}</option>
            <option value="global">{t("scopeGlobal")}</option>
            <option value="location">{t("scopeLocation")}</option>
          </select>
          {filterScope !== "global" && locations.length > 0 && (
            <select value={filterLocationId} onChange={(e) => setFilterLocationId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="">{t("allLocations")}</option>
              {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
            {t("showArchived")}
          </label>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <FileText size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">{t("emptyState")}</p>
            <Button onClick={() => void handleCreate()} className="mt-4 bg-[#003566] text-white hover:bg-blue-900 rounded-xl">
              <Plus size={16} className="mr-2" /> {t("createFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{group}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((template) => (
                    <div
                      key={template.id}
                      className={cn(
                        "group relative rounded-2xl border bg-white p-5 transition hover:shadow-md cursor-pointer dark:bg-slate-900",
                        template.is_archived ? "opacity-60 border-slate-200 dark:border-slate-700" : template.is_global ? "border-[#003566]/20 dark:border-blue-900/40" : "border-slate-200 dark:border-slate-700",
                      )}
                      onClick={() => router.push(`${root}/contract-templates/${template.id}`)}
                    >
                      {/* Type pill */}
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", TYPE_COLORS[template.type] ?? "bg-slate-50 border-slate-200 text-slate-600")}>
                          {typeLabel(template.type)}
                        </span>
                        {template.is_global ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                            <Globe2 size={9} /> {t("global")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            <MapPin size={9} /> {template.location?.name ?? t("locationFallback")}
                          </span>
                        )}
                        {template.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                            <Star size={9} /> {t("default")}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{LANG_FLAG[template.language] ?? template.language}</span>
                      </div>

                      <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{template.name}</p>
                      {template.description && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">{template.description}</p>}

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">v{template.current_version} · {new Date(template.updated_at).toLocaleDateString(locale)}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`${root}/contract-templates/${template.id}`); }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title={t("edit")}
                          >
                            <Pencil size={13} />
                          </button>
                          {!template.is_default && !template.is_global && (
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleSetDefault(template); }}
                              disabled={settingDefault === template.id}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 disabled:opacity-50"
                              title={t("setDefaultTitle")}
                            >
                              {settingDefault === template.id ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleDuplicate(template); }}
                            disabled={duplicating === template.id}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 disabled:opacity-50"
                            title={t("duplicateTitle")}
                          >
                            {duplicating === template.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                          </button>
                          {!template.is_archived && (
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleArchive(template); }}
                              disabled={archiving === template.id}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950/40 disabled:opacity-50"
                              title={t("archiveTitle")}
                            >
                              {archiving === template.id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
