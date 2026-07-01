"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Mail,
  Plus,
  Copy,
  Archive,
  Eye,
  Globe2,
  MapPin,
  Loader2,
  Search,
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
  const [filterScope, setFilterScope] = useState("all"); // all | global | location
  const [filterLocationId, setFilterLocationId] = useState("");
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const root = `/${locale}/dashboard/${role}`;

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
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
      setTypes(Array.isArray(rawTypes) ? rawTypes as TemplateType[] : []);
      setLocations(locRes.data?.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

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
          { id: "1", type: "logo", settings: { source: "location_logo" } },
          { id: "2", type: "header", settings: { content: { nl: "Hallo {{buyer_name}},", en: "Hello {{buyer_name}},", de: "Hallo {{buyer_name}},", fr: "Bonjour {{buyer_name}}," } } },
          { id: "3", type: "text", settings: { content: { nl: "Dit is een nieuw e-mailsjabloon.", en: "This is a new email template.", de: "Dies ist eine neue E-Mail-Vorlage.", fr: "Ceci est un nouveau modèle d'e-mail." } } },
          { id: "4", type: "button", settings: { label: { nl: "Bekijk", en: "View", de: "Ansehen", fr: "Voir" }, url: "{{offer_link}}" } },
          { id: "5", type: "footer", settings: { content: { nl: "{{location_name}} · {{location_email}}", en: "{{location_name}} · {{location_email}}", de: "{{location_name}} · {{location_email}}", fr: "{{location_name}} · {{location_email}}" } } },
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

  const grouped: Record<string, EmailTemplate[]> = {};
  filtered.forEach((template) => {
    const key = template.is_global ? t("globalMasterTemplates") : (template.location?.name ?? t("unknownLocation"));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(template);
  });

  const typeLabel = (type: string) =>
    types.find((tp) => tp.value === type)?.label ?? type;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003566] text-white">
              <Mail size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t("title")}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
            </div>
          </div>
          <Button
            onClick={() => void handleCreate()}
            className="bg-[#003566] text-white hover:bg-blue-900 rounded-xl"
          >
            <Plus size={16} className="mr-2" />
            {t("newTemplate")}
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="h-9 pl-8 w-56 rounded-xl text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">{t("allTypes")}</option>
            {types.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
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

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <Mail size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">{t("emptyState")}</p>
            <Button onClick={() => void handleCreate()} className="mt-4 bg-[#003566] text-white hover:bg-blue-900 rounded-xl">
              <Plus size={16} className="mr-2" /> {t("createFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {group}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      typeLabel={typeLabel(template.type)}
                      root={root}
                      locale={locale}
                      onDuplicate={() => void handleDuplicate(template)}
                      onArchive={() => void handleArchive(template)}
                      duplicating={duplicating === template.id}
                      archiving={archiving === template.id}
                    />
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

function TemplateCard({
  template,
  typeLabel,
  root,
  locale,
  onDuplicate,
  onArchive,
  duplicating,
  archiving,
}: {
  template: EmailTemplate;
  typeLabel: string;
  root: string;
  locale: string;
  onDuplicate: () => void;
  onArchive: () => void;
  duplicating: boolean;
  archiving: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("EmailTemplates");

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-white p-5 transition hover:shadow-md cursor-pointer dark:bg-slate-900",
        template.is_archived
          ? "border-slate-200 opacity-60 dark:border-slate-700"
          : template.is_global
            ? "border-[#003566]/20 dark:border-blue-900/40"
            : "border-slate-200 dark:border-slate-700",
      )}
      onClick={() => router.push(`${root}/email-templates/${template.id}`)}
    >
      {/* Badges */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {template.is_global ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            <Globe2 size={9} /> {t("global")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <MapPin size={9} /> {template.location?.name ?? t("locationFallback")}
          </span>
        )}
        <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
          {LANG_LABELS[template.language_default] ?? template.language_default}
        </span>
        {template.is_archived && (
          <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-700">
            {t("archived")}
          </span>
        )}
      </div>

      {/* Name & type */}
      <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{template.name}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{typeLabel}</p>
      {template.description && (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">{template.description}</p>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          v{template.current_version} · {new Date(template.updated_at).toLocaleDateString(locale)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`${root}/email-templates/${template.id}`); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={t("edit")}
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            disabled={duplicating}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-50"
            title={t("duplicateTitle")}
          >
            {duplicating ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
          </button>
          {!template.is_archived && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              disabled={archiving}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950/40 dark:hover:text-orange-300 disabled:opacity-50"
              title={t("archiveTitle")}
            >
              {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
