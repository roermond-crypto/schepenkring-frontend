"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Mail,
  Plus,
  Copy,
  Archive,
  Pencil,
  Eye,
  Send,
  Globe2,
  MapPin,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface EmailTemplate {
  id: number;
  type: string;
  name: string;
  description: string | null;
  is_global: boolean;
  location_id: number | null;
  location?: { id: number; name: string } | null;
  language_default: string;
  subject: Record<string, string>;
  preheader?: string | null;
  is_active: boolean;
  is_archived: boolean;
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

const LANG_LABELS: Record<string, string> = { nl: "NL", en: "EN", de: "DE", fr: "FR" };

type SortKey = "type" | "location" | "language_default" | "updated_at" | "current_version";

export default function EmailTemplatesPage() {
  const t = useTranslations("EmailTemplates");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const router = useRouter();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [types, setTypes] = useState<TemplateType[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);

  // Per-row action state
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);

  const root = `/${locale}/dashboard/${role}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, typesRes, locRes] = await Promise.all([
        api.get("/admin/email-templates"),
        api.get("/admin/email-templates/types"),
        api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200"),
      ]);
      const rawTemplates = tRes.data as { data?: EmailTemplate[] } | EmailTemplate[];
      setTemplates(Array.isArray(rawTemplates) ? rawTemplates : (rawTemplates as { data?: EmailTemplate[] })?.data ?? []);
      const rawTypes = typesRes.data;
      setTypes(Array.isArray(rawTypes) ? (rawTypes as TemplateType[]) : []);
      setLocations(locRes.data?.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDuplicate = async (template: EmailTemplate) => {
    setDuplicating(template.id);
    try {
      await api.post(`/admin/email-templates/${template.id}/duplicate`);
      toast.success(t("duplicateSuccess"));
      await loadData();
    } catch {
      toast.error(t("duplicateFailed"));
    } finally {
      setDuplicating(null);
    }
  };

  const handleArchive = async (template: EmailTemplate) => {
    if (!confirm(t("archiveConfirm", { name: template.name }))) return;
    setArchiving(template.id);
    try {
      await api.delete(`/admin/email-templates/${template.id}`);
      toast.success(t("archiveSuccess"));
      await loadData();
    } catch {
      toast.error(t("archiveFailed"));
    } finally {
      setArchiving(null);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await api.post<{ template: EmailTemplate }>("/admin/email-templates", {
        type: "offer_received_buyer",
        name: "Nieuw sjabloon",
        subject: { nl: "Onderwerp", en: "Subject", de: "Betreff", fr: "Sujet" },
        blocks: [
          { id: "1", type: "logo", settings: { src: "{{location_logo}}", alt: "{{location_name}}", height: 50 } },
          { id: "2", type: "header", settings: { content: { nl: "Hallo {{buyer_name}},", en: "Hello {{buyer_name}}," } } },
          { id: "3", type: "text", settings: { content: { nl: "Dit is een nieuw e-mailsjabloon.", en: "This is a new email template." } } },
          { id: "4", type: "footer", settings: { content: { nl: "{{location_name}} · {{location_email}}", en: "{{location_name}} · {{location_email}}" } } },
        ],
      });
      const newId = res.data?.template?.id;
      if (newId) {
        router.push(`${root}/email-templates/${newId}`);
      } else {
        await loadData();
      }
    } catch {
      toast.error(t("createFailed"));
    }
  };

  // ── Filtering ──

  const filtered = templates.filter((tmpl) => {
    if (!showArchived && tmpl.is_archived) return false;
    if (filterType !== "all" && tmpl.type !== filterType) return false;
    if (filterScope === "global" && !tmpl.is_global) return false;
    if (filterScope === "location" && tmpl.is_global) return false;
    if (filterLocationId && String(tmpl.location_id) !== filterLocationId) return false;
    if (search) {
      const q = search.toLowerCase();
      const label = types.find((tp) => tp.value === tmpl.type)?.label ?? "";
      if (
        !tmpl.name.toLowerCase().includes(q) &&
        !tmpl.type.toLowerCase().includes(q) &&
        !label.toLowerCase().includes(q) &&
        !(tmpl.location?.name ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Sorting ──

  const sorted = [...filtered].sort((a, b) => {
    let av = "";
    let bv = "";
    if (sortKey === "type") {
      av = types.find((tp) => tp.value === a.type)?.label ?? a.type;
      bv = types.find((tp) => tp.value === b.type)?.label ?? b.type;
    } else if (sortKey === "location") {
      av = a.is_global ? t("global") : (a.location?.name ?? "");
      bv = b.is_global ? t("global") : (b.location?.name ?? "");
    } else if (sortKey === "language_default") {
      av = a.language_default;
      bv = b.language_default;
    } else if (sortKey === "updated_at") {
      av = a.updated_at;
      bv = b.updated_at;
    } else if (sortKey === "current_version") {
      return sortAsc ? a.current_version - b.current_version : b.current_version - a.current_version;
    }
    const cmp = av.localeCompare(bv);
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? null : sortAsc ? (
      <ChevronUp size={12} className="ml-0.5 inline-block" />
    ) : (
      <ChevronDown size={12} className="ml-0.5 inline-block" />
    );

  const typeLabel = (type: string) => {
    try {
      return t(`types.${type}` as Parameters<typeof t>[0]);
    } catch {
      return types.find((tp) => tp.value === type)?.label ?? type;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003566] text-white">
              <Mail size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t("title")}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("tableSubtitle", { count: filtered.length })}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void handleCreate()}
            className="bg-[#003566] text-white hover:bg-blue-900 rounded-xl"
          >
            <Plus size={16} className="mr-2" /> {t("newTemplate")}
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 pl-8 w-56 rounded-xl text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">{t("allTypes")}</option>
            {types.map((tp) => {
              let label = tp.label;
              try { label = t(`types.${tp.value}` as Parameters<typeof t>[0]); } catch {}
              return <option key={tp.value} value={tp.value}>{label}</option>;
            })}
          </select>
          <select
            value={filterScope}
            onChange={(e) => { setFilterScope(e.target.value); setFilterLocationId(""); }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">{t("scopeAll")}</option>
            <option value="global">{t("scopeGlobal")}</option>
            <option value="location">{t("scopeLocation")}</option>
          </select>
          {filterScope !== "global" && locations.length > 0 && (
            <select
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">{t("allLocations")}</option>
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            {t("showArchived")}
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <Mail size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">{t("emptyState")}</p>
            <Button onClick={() => void handleCreate()} className="mt-4 bg-[#003566] text-white hover:bg-blue-900 rounded-xl">
              <Plus size={16} className="mr-2" /> {t("createFirst")}
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                    <Th onClick={() => toggleSort("type")}>
                      {t("colEvent")} <SortIcon col="type" />
                    </Th>
                    <Th onClick={() => toggleSort("location")}>
                      {t("colLocation")} <SortIcon col="location" />
                    </Th>
                    <Th onClick={() => toggleSort("language_default")}>
                      {t("colLanguage")} <SortIcon col="language_default" />
                    </Th>
                    <Th onClick={() => toggleSort("updated_at")}>
                      {t("colUpdated")} <SortIcon col="updated_at" />
                    </Th>
                    <Th onClick={() => toggleSort("current_version")}>
                      {t("colVersion")} <SortIcon col="current_version" />
                    </Th>
                    <Th>{t("colStatus")}</Th>
                    <Th>{t("colActions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sorted.map((template) => (
                    <tr
                      key={template.id}
                      className={cn(
                        "group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        template.is_archived && "opacity-60",
                      )}
                    >
                      {/* Event / type */}
                      <td className="px-4 py-3">
                        <div
                          className="cursor-pointer"
                          onClick={() => router.push(`${root}/email-templates/${template.id}`)}
                        >
                          <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight hover:text-[#003566] dark:hover:text-blue-400 transition-colors">
                            {typeLabel(template.type)}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{template.name}</p>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3">
                        {template.is_global ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                            <Globe2 size={9} /> {t("global")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <MapPin size={9} /> {template.location?.name ?? "—"}
                          </span>
                        )}
                      </td>

                      {/* Language */}
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {LANG_LABELS[template.language_default] ?? template.language_default}
                        </span>
                      </td>

                      {/* Updated at */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(template.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
                      </td>

                      {/* Version */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                        v{template.current_version}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {template.is_archived ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-700">
                            {t("archived")}
                          </span>
                        ) : template.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> {t("statusActive")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <XCircle size={12} /> {t("statusDraft")}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <ActionBtn
                            title={t("edit")}
                            onClick={() => router.push(`${root}/email-templates/${template.id}`)}
                          >
                            <Pencil size={13} />
                          </ActionBtn>
                          <ActionBtn
                            title={t("previewAction")}
                            onClick={() => router.push(`${root}/email-templates/${template.id}`)}
                          >
                            <Eye size={13} />
                          </ActionBtn>
                          <ActionBtn
                            title={t("testSendAction")}
                            onClick={() => router.push(`${root}/email-templates/${template.id}`)}
                          >
                            <Send size={13} />
                          </ActionBtn>
                          <ActionBtn
                            title={t("duplicateTitle")}
                            loading={duplicating === template.id}
                            onClick={() => void handleDuplicate(template)}
                          >
                            {duplicating === template.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                          </ActionBtn>
                          {!template.is_archived && (
                            <ActionBtn
                              title={t("archiveTitle")}
                              loading={archiving === template.id}
                              onClick={() => void handleArchive(template)}
                              danger
                            >
                              {archiving === template.id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                            </ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none",
        onClick && "cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors",
      )}
    >
      {children}
    </th>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  loading,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={loading}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "rounded-lg p-1.5 transition-colors disabled:opacity-40",
        danger
          ? "text-slate-400 hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950/40 dark:hover:text-orange-300"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}
