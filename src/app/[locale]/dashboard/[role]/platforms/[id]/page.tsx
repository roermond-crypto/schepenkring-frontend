"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Globe2,
  ArrowLeft,
  Save,
  Loader2,
  Settings2,
  Rss,
  UserRound,
  SlidersHorizontal,
  BarChart3,
  History,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EMPTY_PLATFORM_FORM, MASK_PLACEHOLDER, type PlatformForm } from "./_types";
import { GeneralTab } from "./_components/GeneralTab";
import { ExportTab } from "./_components/ExportTab";
import { OpenMarineTab } from "./_components/OpenMarineTab";
import { ContactTab } from "./_components/ContactTab";
import { AdvancedTab } from "./_components/AdvancedTab";
import { ComingSoonTab } from "./_components/ComingSoonTab";

type TabId = "general" | "export" | "openmarine" | "contact" | "advanced" | "statistics" | "audit";
const TAB_IDS: TabId[] = ["general", "export", "openmarine", "contact", "advanced", "statistics", "audit"];

const TAB_ICONS: Record<TabId, typeof Settings2> = {
  general: Settings2,
  export: Rss,
  openmarine: Rss,
  contact: UserRound,
  advanced: SlidersHorizontal,
  statistics: BarChart3,
  audit: History,
};

export default function PlatformDetailPage() {
  const locale = useLocale();
  const params = useParams<{ role?: string; id: string }>();
  const searchParams = useSearchParams();
  const role = params?.role ?? "admin";
  const id = params?.id;
  const isNew = id === "new";
  const platformId = isNew ? null : Number(id);
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;
  const t = useTranslations("Platforms");

  const initialTab = TAB_IDS.includes(searchParams?.get("tab") as TabId) ? (searchParams!.get("tab") as TabId) : "general";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [form, setForm] = useState<PlatformForm>(EMPTY_PLATFORM_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Record<string, unknown>>(`/admin/platforms/${id}`);
      const d = res.data;
      const credentials = (d.credentials as PlatformForm["credentials"] | null) ?? {};
      setForm({
        ...EMPTY_PLATFORM_FORM,
        ...(d as unknown as PlatformForm),
        credentials: { api_key: credentials.api_key ?? "", webhook_url: credentials.webhook_url ?? "", debug_mode: !!credentials.debug_mode },
        has_api_secret: !!d.has_api_secret,
        has_webhook_secret: !!d.has_webhook_secret,
        supported_countries: Array.isArray(d.supported_countries) ? (d.supported_countries as string[]) : [],
        supported_languages: Array.isArray(d.supported_languages) ? (d.supported_languages as string[]) : [],
        openmarine_category_map: d.openmarine_category_map ? JSON.stringify(d.openmarine_category_map, null, 2) : "",
      });
    } catch {
      toast.error(t("loadFailed"));
      router.push(`${root}/platforms`);
    } finally {
      setLoading(false);
    }
  };

  const set = <K extends keyof PlatformForm>(key: K, value: PlatformForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const changeTab = (next: TabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t("nameRequired")); return; }
    if (!form.slug.trim()) { toast.error(t("slugRequired")); return; }

    let categoryMap: Record<string, string> | undefined;
    if (form.openmarine_category_map.trim()) {
      try {
        categoryMap = JSON.parse(form.openmarine_category_map);
      } catch {
        toast.error(t("openmarine.categoryMapLabel") + ": " + t("saveFailed"));
        return;
      }
    }

    const credentials: Record<string, string | boolean> = {};
    if (form.credentials.api_key !== undefined) credentials.api_key = form.credentials.api_key;
    if (form.credentials.webhook_url !== undefined) credentials.webhook_url = form.credentials.webhook_url;
    credentials.debug_mode = !!form.credentials.debug_mode;
    credentials.api_secret = form.credentials.api_secret
      ? form.credentials.api_secret
      : form.has_api_secret ? MASK_PLACEHOLDER : "";
    credentials.webhook_secret = form.credentials.webhook_secret
      ? form.credentials.webhook_secret
      : form.has_webhook_secret ? MASK_PLACEHOLDER : "";

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        logo_url: form.logo_url,
        website_url: form.website_url,
        category: form.category,
        export_method: form.export_method,
        feed_url: form.feed_url,
        api_url: form.api_url,
        credentials,
        openmarine_enabled: form.is_openmarine_enabled,
        openmarine_dealer_id: form.openmarine_dealer_id,
        openmarine_version: form.openmarine_version,
        openmarine_category_map: categoryMap ?? {},
        supported_countries: form.supported_countries,
        supported_languages: form.supported_languages,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        notes: form.notes,
        priority: Number(form.priority),
        is_active: form.is_active,
      };

      if (isNew) {
        const res = await api.post<{ id: number }>("/admin/platforms", payload);
        toast.success(t("createSuccess"));
        router.push(`${root}/platforms/${res.data.id}`);
      } else {
        await api.put(`/admin/platforms/${id}`, payload);
        toast.success(t("saveSuccess"));
        void load();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`${root}/platforms`)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={16} /> {t("back")}
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-xl font-black text-[#003566] flex items-center gap-2">
            <Globe2 size={20} className="text-blue-500" />
            {isNew ? t("newTitle") : form.name || t("editTitle")}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#003566] hover:bg-[#002244] text-white gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? t("saving") : t("save")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 bg-slate-100 rounded-xl p-1.5">
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id];
          const disabled = isNew && (id === "statistics" || id === "audit");
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => changeTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                tab === id ? "bg-white text-[#003566] shadow-sm" : "text-slate-500 hover:text-slate-700",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              <Icon size={14} />
              {t(`tabs.${id}`)}
            </button>
          );
        })}
      </div>

      {tab === "general" && <GeneralTab form={form} set={set} platformId={platformId} isNew={isNew} />}
      {tab === "export" && <ExportTab form={form} set={set} />}
      {tab === "openmarine" && <OpenMarineTab form={form} set={set} />}
      {tab === "contact" && <ContactTab form={form} set={set} />}
      {tab === "advanced" && <AdvancedTab form={form} set={set} platformId={platformId} />}
      {tab === "statistics" && (
        <ComingSoonTab icon={BarChart3} title={t("statistics.comingSoonTitle")} body={t("statistics.comingSoonBody")} />
      )}
      {tab === "audit" && (
        <ComingSoonTab icon={History} title={t("audit.comingSoonTitle")} body={t("audit.comingSoonBody")} />
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-[#003566] hover:bg-[#002244] text-white gap-2 px-8">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
