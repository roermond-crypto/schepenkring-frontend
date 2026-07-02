"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Globe2,
  ArrowLeft,
  Save,
  Loader2,
  Rss,
  Code2,
  Package,
  UploadCloud,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlatformForm {
  name: string;
  slug: string;
  logo_url: string;
  website_url: string;
  platform_type: string;
  export_method: string;
  feed_url: string;
  api_url: string;
  api_key: string;
  api_secret: string;
  is_active: boolean;
  is_openmarine_enabled: boolean;
  supported_countries: string;
  supported_languages: string;
  contact_person: string;
  contact_email: string;
  notes: string;
  priority: number;
  openmarine_version: string;
  openmarine_dealer_id: string;
  openmarine_category_map: string;
}

const EMPTY_FORM: PlatformForm = {
  name: "",
  slug: "",
  logo_url: "",
  website_url: "",
  platform_type: "marketplace",
  export_method: "openmarine_feed",
  feed_url: "",
  api_url: "",
  api_key: "",
  api_secret: "",
  is_active: true,
  is_openmarine_enabled: true,
  supported_countries: "NL",
  supported_languages: "nl",
  contact_person: "",
  contact_email: "",
  notes: "",
  priority: 10,
  openmarine_version: "2.0",
  openmarine_dealer_id: "",
  openmarine_category_map: "",
};

const PLATFORM_TYPE_OPTIONS = [
  { value: "marketplace", label: "Marktplaats" },
  { value: "portal", label: "Portaal" },
  { value: "own_website", label: "Eigen website" },
  { value: "partner", label: "Partner" },
  { value: "aggregator", label: "Aggregator" },
  { value: "social", label: "Social media" },
  { value: "other", label: "Overig" },
];

const EXPORT_METHOD_OPTIONS = [
  { value: "openmarine_feed", label: "OpenMarine 2.0 Feed", icon: <Rss size={14} /> },
  { value: "xml_feed", label: "XML Feed", icon: <Rss size={14} /> },
  { value: "api_push", label: "API Push", icon: <Code2 size={14} /> },
  { value: "manual", label: "Handmatig / CSV", icon: <Package size={14} /> },
];

const KNOWN_PLATFORMS = [
  { name: "Obato", slug: "obato", website_url: "https://obato.nl", platform_type: "marketplace", export_method: "openmarine_feed", supported_countries: "NL,BE", supported_languages: "nl" },
  { name: "HISWA", slug: "hiswa", website_url: "https://hiswa.nl", platform_type: "portal", export_method: "openmarine_feed", supported_countries: "NL", supported_languages: "nl" },
  { name: "Boat24", slug: "boat24", website_url: "https://boat24.com", platform_type: "marketplace", export_method: "openmarine_feed", supported_countries: "NL,DE,FR,BE,CH,AT", supported_languages: "nl,de,fr,en" },
  { name: "YachtFocus", slug: "yachtfocus", website_url: "https://yachtfocus.com", platform_type: "marketplace", export_method: "openmarine_feed", supported_countries: "NL,BE", supported_languages: "nl" },
  { name: "Marktplaats", slug: "marktplaats", website_url: "https://marktplaats.nl", platform_type: "marketplace", export_method: "xml_feed", supported_countries: "NL", supported_languages: "nl" },
  { name: "YachtWorld", slug: "yachtworld", website_url: "https://yachtworld.com", platform_type: "marketplace", export_method: "openmarine_feed", supported_countries: "US,NL,GB,DE,FR", supported_languages: "en" },
  { name: "YachtShift", slug: "yachtshift", website_url: "https://yachtshift.nl", platform_type: "partner", export_method: "api_push", supported_countries: "NL,BE", supported_languages: "nl" },
];

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="text-[11px] font-black text-[#003566] uppercase tracking-[0.25em] border-b border-slate-100 pb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

export default function PlatformDetailPage() {
  const locale = useLocale();
  const params = useParams<{ role?: string; id: string }>();
  const role = params?.role ?? "admin";
  const id = params?.id;
  const isNew = id === "new";
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [form, setForm] = useState<PlatformForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (!isNew) void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<PlatformForm & { supported_countries: string[] | string; supported_languages: string[] | string }>(`/admin/platforms/${id}`);
      const d = res.data;
      setForm({
        ...EMPTY_FORM,
        ...d,
        supported_countries: Array.isArray(d.supported_countries) ? d.supported_countries.join(",") : (d.supported_countries ?? ""),
        supported_languages: Array.isArray(d.supported_languages) ? d.supported_languages.join(",") : (d.supported_languages ?? ""),
        api_key: (d as any).api_key ?? "",
        api_secret: (d as any).api_secret ?? "",
        openmarine_dealer_id: (d as any).openmarine_dealer_id ?? "",
        openmarine_category_map: (d as any).openmarine_category_map ?? "",
        openmarine_version: (d as any).openmarine_version ?? "2.0",
      });
    } catch {
      toast.error("Kon platform niet laden.");
      router.push(`${root}/platforms`);
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof PlatformForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const applyTemplate = (template: typeof KNOWN_PLATFORMS[0]) => {
    setForm((prev) => ({
      ...prev,
      name: template.name,
      slug: template.slug,
      website_url: template.website_url,
      platform_type: template.platform_type,
      export_method: template.export_method,
      supported_countries: template.supported_countries,
      supported_languages: template.supported_languages,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Naam is verplicht."); return; }
    if (!form.slug.trim()) { toast.error("Slug is verplicht."); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        supported_countries: form.supported_countries.split(",").map((s) => s.trim()).filter(Boolean),
        supported_languages: form.supported_languages.split(",").map((s) => s.trim()).filter(Boolean),
        priority: Number(form.priority),
      };

      if (isNew) {
        const res = await api.post<{ id: number }>("/admin/platforms", payload);
        toast.success("Platform aangemaakt.");
        router.push(`${root}/platforms/${res.data.id}`);
      } else {
        await api.put(`/admin/platforms/${id}`, payload);
        toast.success("Platform opgeslagen.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Opslaan mislukt.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin" /> Platform laden...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`${root}/platforms`)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={16} /> Terug
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-xl font-black text-[#003566] flex items-center gap-2">
            <Globe2 size={20} className="text-blue-500" />
            {isNew ? "Nieuw Platform" : form.name || "Platform bewerken"}
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#003566] hover:bg-[#002244] text-white gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Opslaan
        </Button>
      </div>

      {/* Quick templates (only for new) */}
      {isNew && (
        <FormSection title="Snel starten — Bekende platforms">
          <p className="text-xs text-slate-500">Klik op een platform om de basisinstellingen automatisch in te vullen.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {KNOWN_PLATFORMS.map((tpl) => (
              <button
                key={tpl.slug}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
                  form.slug === tpl.slug
                    ? "bg-[#003566] text-white border-[#003566]"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </FormSection>
      )}

      {/* Basic info */}
      <FormSection title="Basisinformatie">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Platformnaam *">
            <Input
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (isNew || !form.slug) set("slug", generateSlug(e.target.value));
              }}
              placeholder="bijv. Boat24"
              className="text-sm"
            />
          </Field>
          <Field label="Slug *" hint="Unieke identifier, kleine letters, koppeltekens">
            <Input
              value={form.slug}
              onChange={(e) => set("slug", generateSlug(e.target.value))}
              placeholder="bijv. boat24"
              className="text-sm font-mono"
            />
          </Field>
          <Field label="Website URL">
            <Input
              value={form.website_url}
              onChange={(e) => set("website_url", e.target.value)}
              placeholder="https://..."
              type="url"
              className="text-sm"
            />
          </Field>
          <Field label="Logo URL" hint="Directe URL naar logo afbeelding">
            <Input
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://..."
              type="url"
              className="text-sm"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Type platform">
            <select
              value={form.platform_type}
              onChange={(e) => set("platform_type", e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400"
            >
              {PLATFORM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioriteit" hint="Lager = hogere prioriteit">
            <Input
              value={form.priority}
              onChange={(e) => set("priority", Number(e.target.value) || 10)}
              type="number"
              min={1}
              max={999}
              className="text-sm"
            />
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-3 h-9">
              <button
                type="button"
                onClick={() => set("is_active", !form.is_active)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  form.is_active ? "bg-green-500" : "bg-slate-200"
                )}
              >
                <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", form.is_active ? "translate-x-6" : "translate-x-1")} />
              </button>
              <span className="text-sm text-slate-700">{form.is_active ? "Actief" : "Inactief"}</span>
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ondersteunde landen" hint="Komma-gescheiden, bijv. NL,BE,DE">
            <Input
              value={form.supported_countries}
              onChange={(e) => set("supported_countries", e.target.value)}
              placeholder="NL,BE,DE"
              className="text-sm font-mono"
            />
          </Field>
          <Field label="Ondersteunde talen" hint="Komma-gescheiden, bijv. nl,de,en">
            <Input
              value={form.supported_languages}
              onChange={(e) => set("supported_languages", e.target.value)}
              placeholder="nl,en,de"
              className="text-sm font-mono"
            />
          </Field>
        </div>
      </FormSection>

      {/* Export method */}
      <FormSection title="Export methode & verbinding">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPORT_METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("export_method", opt.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                form.export_method === opt.value
                  ? "border-[#003566] bg-blue-50 text-[#003566]"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className={cn("shrink-0", form.export_method === opt.value ? "text-blue-600" : "text-slate-400")}>
                {opt.icon}
              </div>
              <span className="text-sm font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 mt-2">
          <Field label="Feed URL" hint="URL van de XML/OpenMarine feed die het platform ophaalt">
            <Input
              value={form.feed_url}
              onChange={(e) => set("feed_url", e.target.value)}
              placeholder="https://..."
              type="url"
              className="text-sm"
            />
          </Field>
          <Field label="API URL" hint="Base URL voor API-push integratie">
            <Input
              value={form.api_url}
              onChange={(e) => set("api_url", e.target.value)}
              placeholder="https://api.platform.com/v1"
              type="url"
              className="text-sm"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="API Key / Username">
              <Input
                value={form.api_key}
                onChange={(e) => set("api_key", e.target.value)}
                placeholder="API sleutel of gebruikersnaam"
                className="text-sm font-mono"
              />
            </Field>
            <Field label="API Secret / Wachtwoord">
              <div className="relative">
                <Input
                  value={form.api_secret}
                  onChange={(e) => set("api_secret", e.target.value)}
                  type={showSecret ? "text" : "password"}
                  placeholder="Geheime sleutel"
                  className="text-sm font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>
        </div>
      </FormSection>

      {/* OpenMarine settings */}
      <FormSection title="OpenMarine 2.0 instellingen">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => set("is_openmarine_enabled", !form.is_openmarine_enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              form.is_openmarine_enabled ? "bg-indigo-500" : "bg-slate-200"
            )}
          >
            <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", form.is_openmarine_enabled ? "translate-x-6" : "translate-x-1")} />
          </button>
          <span className="text-sm text-slate-700 font-medium">OpenMarine 2.0 export ingeschakeld</span>
          <Rss size={14} className={form.is_openmarine_enabled ? "text-indigo-500" : "text-slate-300"} />
        </div>

        {form.is_openmarine_enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <Field label="OpenMarine versie">
              <select
                value={form.openmarine_version}
                onChange={(e) => set("openmarine_version", e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="2.0">OpenMarine 2.0</option>
                <option value="1.0">OpenMarine 1.0 (legacy)</option>
              </select>
            </Field>
            <Field label="Dealer ID" hint="Unieke dealer-ID bij dit platform">
              <Input
                value={form.openmarine_dealer_id}
                onChange={(e) => set("openmarine_dealer_id", e.target.value)}
                placeholder="bijv. SK-0042"
                className="text-sm font-mono"
              />
            </Field>
            <Field label="Categorie mapping" hint="JSON mapping van interne categorieën naar platform-codes" className="sm:col-span-2">
              <textarea
                value={form.openmarine_category_map}
                onChange={(e) => set("openmarine_category_map", e.target.value)}
                placeholder='{"motorboat": "MB", "sailboat": "SB", "catamaran": "CAT"}'
                rows={3}
                className="w-full text-xs font-mono rounded-md border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
              />
            </Field>
          </div>
        )}
      </FormSection>

      {/* Contact */}
      <FormSection title="Contactpersoon & notities">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contactpersoon">
            <Input
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
              placeholder="Naam contactpersoon"
              className="text-sm"
            />
          </Field>
          <Field label="Contact e-mail">
            <Input
              value={form.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              placeholder="contact@platform.com"
              type="email"
              className="text-sm"
            />
          </Field>
        </div>
        <Field label="Notities & instructies">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Interne notities, instructies of bijzonderheden..."
            rows={4}
            className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
          />
        </Field>
      </FormSection>

      {/* Save footer */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#003566] hover:bg-[#002244] text-white gap-2 px-8"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isNew ? "Platform aanmaken" : "Wijzigingen opslaan"}
        </Button>
      </div>
    </div>
  );
}
