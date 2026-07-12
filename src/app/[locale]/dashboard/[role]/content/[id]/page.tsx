"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Clock,
  History,
  Loader2,
  Plus,
  Save,
  Send,
  Trash,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────

const LOCALES = ["nl", "en", "de", "fr"] as const;
type Locale = (typeof LOCALES)[number];
type LocaleValue = Partial<Record<Locale, string>>;

type FieldDef = {
  key: string;
  type: "text" | "textarea" | "richtext" | "cta" | "list" | "image" | "url" | "number" | "boolean";
  translatable: boolean;
  required: boolean;
};

type ComponentDef = { label: string; variants: string[]; fields: FieldDef[] };
type ComponentRegistry = Record<string, ComponentDef>;

type CmsSectionRow = {
  id?: number;
  component: string;
  variant: string | null;
  content: Record<string, any>;
  sort_order: number;
  is_enabled: boolean;
};

type CmsPageDetail = {
  id: number;
  slug: string;
  name: string;
  status: string;
  seo: { title?: LocaleValue; description?: LocaleValue } | null;
  current_version: number;
  sections: CmsSectionRow[];
};

type CmsPageVersionRow = {
  id: number;
  version: number;
  change_note: string | null;
  created_at: string;
  created_by: { name: string } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyLocaleValue(): LocaleValue {
  return { nl: "", en: "", de: "", fr: "" };
}

function defaultContentFor(fields: FieldDef[]): Record<string, any> {
  const content: Record<string, any> = {};
  for (const field of fields) {
    if (field.translatable) {
      content[field.key] = field.type === "list" ? { nl: [], en: [], de: [], fr: [] } : emptyLocaleValue();
    } else {
      content[field.key] = field.type === "list" ? [] : field.type === "boolean" ? false : "";
    }
  }
  return content;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CmsPageEditor() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const role = params.role as string;
  const pageId = params.id as string;

  const [page, setPage] = useState<CmsPageDetail | null>(null);
  const [registry, setRegistry] = useState<ComponentRegistry>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<CmsSectionRow[]>([]);
  const [seoTitle, setSeoTitle] = useState<LocaleValue>(emptyLocaleValue());
  const [seoDescription, setSeoDescription] = useState<LocaleValue>(emptyLocaleValue());
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CmsPageVersionRow[]>([]);
  const [addingComponent, setAddingComponent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pageRes, registryRes] = await Promise.all([
        api.get<{ data: CmsPageDetail }>(`/admin/cms/pages/${pageId}`),
        api.get<{ data: ComponentRegistry }>("/admin/cms/component-registry"),
      ]);
      const data = pageRes.data.data;
      setPage(data);
      setSections(data.sections);
      setSeoTitle({ ...emptyLocaleValue(), ...(data.seo?.title ?? {}) });
      setSeoDescription({ ...emptyLocaleValue(), ...(data.seo?.description ?? {}) });
      setRegistry(registryRes.data.data);
      setAddingComponent(Object.keys(registryRes.data.data)[0] ?? "");
    } catch {
      toast.error("Kon pagina niet laden");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadVersions = async () => {
    try {
      const res = await api.get<{ data: CmsPageVersionRow[] }>(`/admin/cms/pages/${pageId}/versions`);
      setVersions(res.data.data);
      setShowVersions(true);
    } catch {
      toast.error("Kon versiegeschiedenis niet laden");
    }
  };

  const restoreVersion = async (version: number) => {
    try {
      await api.post(`/admin/cms/pages/${pageId}/restore-version`, { version });
      toast.success(`Versie ${version} hersteld`);
      setShowVersions(false);
      await load();
    } catch {
      toast.error("Herstellen mislukt");
    }
  };

  const saveAll = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await api.put(`/admin/cms/pages/${pageId}`, {
        name: page?.name,
        seo: { title: seoTitle, description: seoDescription },
      });
      await api.put(`/admin/cms/pages/${pageId}/sections`, {
        sections: sections.map((s, index) => ({ ...s, sort_order: index })),
      });
      toast.success("Opgeslagen");
      await load();
      return true;
    } catch (e: any) {
      const errors = e?.response?.data?.errors;
      toast.error(errors ? "Een of meer secties zijn ongeldig" : "Opslaan mislukt");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    const ok = await saveAll();
    if (!ok) return;
    try {
      await api.post(`/admin/cms/pages/${pageId}/publish`);
      toast.success("Gepubliceerd");
      await load();
    } catch {
      toast.error("Publiceren mislukt");
    }
  };

  const addSection = () => {
    const def = registry[addingComponent];
    if (!def) return;
    setSections((prev) => [
      ...prev,
      {
        component: addingComponent,
        variant: def.variants[0] ?? null,
        content: defaultContentFor(def.fields),
        sort_order: prev.length,
        is_enabled: true,
      },
    ]);
  };

  const updateSection = (index: number, patch: Partial<CmsSectionRow>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const updateSectionField = (index: number, fieldKey: string, value: any) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, content: { ...s.content, [fieldKey]: value } } : s)),
    );
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading || !page) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/dashboard/${role}/content`)}
            className="text-slate-400 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{page.name}</h1>
            <p className="text-xs text-slate-400 font-mono">/{page.slug} · v{page.current_version} · {page.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadVersions()}>
            <History className="h-3.5 w-3.5 mr-2" /> Geschiedenis
          </Button>
          <Button variant="outline" size="sm" onClick={() => void saveAll()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Concept opslaan
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={saving}>
            <Send className="h-3.5 w-3.5 mr-2" /> Publiceren
          </Button>
        </div>
      </div>

      {showVersions && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Versiegeschiedenis</h2>
            <button onClick={() => setShowVersions(false)} className="text-xs text-slate-400">Sluiten</button>
          </div>
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm py-2 border-t border-slate-100">
              <div>
                <span className="font-semibold">v{v.version}</span>
                <span className="text-slate-400 ml-2">{v.change_note}</span>
                <span className="text-slate-300 ml-2 text-xs">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {new Date(v.created_at).toLocaleString("nl-NL")}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void restoreVersion(v.version)}>
                Herstellen
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* SEO */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">SEO</h2>
        {LOCALES.map((loc) => (
          <div key={loc} className="grid grid-cols-[3rem_1fr] gap-3 items-start">
            <span className="text-[10px] font-bold uppercase text-slate-400 pt-2.5">{loc}</span>
            <div className="space-y-2">
              <Input
                placeholder="SEO titel"
                value={seoTitle[loc] ?? ""}
                onChange={(e) => setSeoTitle((prev) => ({ ...prev, [loc]: e.target.value }))}
              />
              <textarea
                placeholder="SEO beschrijving"
                value={seoDescription[loc] ?? ""}
                onChange={(e) => setSeoDescription((prev) => ({ ...prev, [loc]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Sections */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Secties</h2>
          <div className="flex items-center gap-2">
            <select
              value={addingComponent}
              onChange={(e) => setAddingComponent(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {Object.entries(registry).map(([key, def]) => (
                <option key={key} value={key}>{def.label}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={addSection}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Sectie toevoegen
            </Button>
          </div>
        </div>

        {sections.map((section, index) => (
          <SectionCard
            key={section.id ?? `new-${index}`}
            section={section}
            def={registry[section.component]}
            onChangeField={(key, value) => updateSectionField(index, key, value)}
            onChangeVariant={(variant) => updateSection(index, { variant })}
            onToggleEnabled={() => updateSection(index, { is_enabled: !section.is_enabled })}
            onMoveUp={() => moveSection(index, -1)}
            onMoveDown={() => moveSection(index, 1)}
            onRemove={() => removeSection(index)}
            canMoveUp={index > 0}
            canMoveDown={index < sections.length - 1}
          />
        ))}
      </section>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  def,
  onChangeField,
  onChangeVariant,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  section: CmsSectionRow;
  def?: ComponentDef;
  onChangeField: (key: string, value: any) => void;
  onChangeVariant: (variant: string) => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5 space-y-4",
        section.is_enabled ? "border-slate-200" : "border-slate-100 opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{def?.label ?? section.component}</span>
          {def && def.variants.length > 1 && (
            <select
              value={section.variant ?? ""}
              onChange={(e) => onChangeVariant(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              {def.variants.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 px-2">
            <input type="checkbox" checked={section.is_enabled} onChange={onToggleEnabled} />
            Actief
          </label>
          <button onClick={onRemove} className="p-1 text-slate-400 hover:text-red-600">
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {def?.fields.map((field) => (
        <FieldEditor
          key={field.key}
          field={field}
          value={section.content?.[field.key]}
          onChange={(value) => onChangeField(field.key, value)}
        />
      ))}
    </div>
  );
}

// ── Field editor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (value: any) => void;
}) {
  const hint = field.type === "image" ? " (media-ID)" : field.type === "cta" ? " (labeltekst — koppel de URL later via de Media/CTA-editor)" : "";
  const label = `${field.key}${field.required ? " *" : ""}${hint}`;

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }

  if (field.translatable) {
    const localeValue: LocaleValue | Record<Locale, string[]> = value ?? {};
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {LOCALES.map((loc) => (
          <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-start">
            <span className="text-[10px] font-bold uppercase text-slate-400 pt-2">{loc}</span>
            {field.type === "list" ? (
              <textarea
                rows={3}
                placeholder="Eén item per regel"
                value={((localeValue as Record<Locale, string[]>)[loc] ?? []).join("\n")}
                onChange={(e) =>
                  onChange({ ...(localeValue as object), [loc]: e.target.value.split("\n").filter((v) => v.trim() !== "") })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            ) : field.type === "textarea" || field.type === "richtext" ? (
              <textarea
                rows={2}
                value={(localeValue as LocaleValue)[loc] ?? ""}
                onChange={(e) => onChange({ ...(localeValue as object), [loc]: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            ) : (
              <Input
                value={(localeValue as LocaleValue)[loc] ?? ""}
                onChange={(e) => onChange({ ...(localeValue as object), [loc]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "list") {
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">{label} <span className="font-normal text-slate-400">(media-ID per regel)</span></p>
        <textarea
          rows={2}
          value={(Array.isArray(value) ? value : []).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n").filter((v) => v.trim() !== ""))}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
