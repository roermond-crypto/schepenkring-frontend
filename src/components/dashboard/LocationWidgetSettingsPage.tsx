"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Globe,
  LayoutTemplate,
  Paintbrush,
  Save,
} from "lucide-react";
import { useParams } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { getDictionary, type AppLocale, type Dictionary } from "@/lib/i18n";

type LocationItem = {
  id: number;
  name: string;
  code: string;
};

type WidgetConfigText = {
  title: string;
  subtitle: string;
  enableWidget: string;
  welcomeText: string;
  welcomePlaceholder: string;
  saveSuccess: string;
  saveError: string;
  copyCode: string;
  copied: string;
  save: string;
  loadLocationsError: string;
  locationSettings: string;
  selectLocation: string;
  loading: string;
  tenantId: string;
  appearance: string;
  themePreset: string;
  accentColor: string;
  themeOcean: string;
  themeSunset: string;
  themeViolet: string;
  embedCode: string;
  embedHelp: string;
  livePreview: string;
  hidden: string;
  previewHelp: string;
  previewTitle: string;
};

export function LocationWidgetSettingsPage() {
  const params = useParams();
  const locale = params.locale as AppLocale;
  const dictionary = getDictionary(locale);
  const fallbackWidgetConfig: WidgetConfigText = {
    title: "Chat Widget Configuration",
    subtitle: "Embed Live Chat on Public Websites",
    enableWidget: "Enable Widget",
    welcomeText: "Welcome Text",
    welcomePlaceholder: "e.g. Hi! How can we help you?",
    saveSuccess: "Widget settings saved",
    saveError: "Failed to save settings",
    copyCode: "Copy Code",
    copied: "Copied!",
    save: "Save Settings",
    loadLocationsError: "Failed to load locations",
    locationSettings: "Location Settings",
    selectLocation: "Select Location",
    loading: "Loading...",
    tenantId: "Tenant ID",
    appearance: "Appearance",
    themePreset: "Theme Preset",
    accentColor: "Accent Color",
    themeOcean: "Ocean Blue",
    themeSunset: "Sunset Orange",
    themeViolet: "Violet Purple",
    embedCode: "Embed Code",
    embedHelp:
      "Copy and paste this snippet into the <head> or just before the closing </body> tag of your website. The chat widget will automatically appear in the bottom right corner.",
    livePreview: "Live Preview",
    hidden: "Hidden",
    previewHelp:
      "The widget will appear in the bottom right corner of this container just like it would on your website.",
    previewTitle: "Chat Widget Preview",
  };
  const t =
    (dictionary as Dictionary & { widgetConfig?: WidgetConfigText }).widgetConfig ??
    fallbackWidgetConfig;

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [themePreset, setThemePreset] = useState("ocean");
  const [tenant, setTenant] = useState("schepenkring");
  const [enabled, setEnabled] = useState(true);
  const [welcomeText, setWelcomeText] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await api.get("/public/locations");
        const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setLocations(data);
        if (data.length > 0) {
          const first = data[0];
          setSelectedLocationId(first.id.toString());
          setLocationName(first.name);
          void fetchSettings(first.id);
        }
      } catch (err) {
        toast.error(t.loadLocationsError);
        console.error(err);
      }
    };

    void fetchLocations();
  }, [t.loadLocationsError]);

  const fetchSettings = async (locationId: number) => {
    try {
      const res = await api.get(`/admin/locations/${locationId}/widget-settings`);
      const settings = res.data;
      setEnabled(settings.enabled ?? true);
      setWelcomeText(settings.welcome_text ?? "");
      setThemePreset(settings.theme ?? "ocean");
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  const handleLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocationId = event.target.value;
    setSelectedLocationId(nextLocationId);
    const nextLocation = locations.find(
      (location) => location.id.toString() === nextLocationId,
    );

    if (nextLocation) {
      setLocationName(nextLocation.name);
      void fetchSettings(Number.parseInt(nextLocationId, 10));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/locations/${selectedLocationId}/widget-settings`, {
        enabled,
        welcome_text: welcomeText,
        theme: themePreset,
      });
      toast.success(t.saveSuccess);
    } catch (err) {
      toast.error(t.saveError);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const domain =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.schepen-kring.nl";

  const embedCode = `<!-- NauticSecure Chat Widget -->
<script 
  src="${domain}/api/widget/chat.js"
  data-harbor-id="${selectedLocationId}"
  data-harbor-name="${locationName}"
  data-tenant="${tenant}"
  data-accent-color="${accentColor}"
  data-theme="${themePreset}"
  data-locale="${locale}"
  defer
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif italic text-[#003566] dark:text-slate-100 sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-300">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <span className="mr-2 animate-spin">...</span> : <Save size={18} />}
          {t.save}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <Globe size={18} className="text-blue-600" />
              {t.locationSettings}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {t.selectLocation}
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                  value={selectedLocationId}
                  onChange={handleLocationChange}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                  {locations.length === 0 && <option value="">{t.loading}</option>}
                </select>
              </div>

              <div className="pt-2">
                <label className="group flex cursor-pointer items-center gap-3">
                  <div
                    onClick={() => setEnabled(!enabled)}
                    className={`relative h-6 w-12 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : ""}`}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t.enableWidget}
                  </span>
                </label>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {t.welcomeText}
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                  rows={3}
                  placeholder={t.welcomePlaceholder}
                  value={welcomeText}
                  onChange={(event) => setWelcomeText(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {t.tenantId}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                  value={tenant}
                  onChange={(event) => setTenant(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <Paintbrush size={18} className="text-blue-600" />
              {t.appearance}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {t.themePreset}
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                  value={themePreset}
                  onChange={(event) => setThemePreset(event.target.value)}
                >
                  <option value="ocean">{t.themeOcean}</option>
                  <option value="sunset">{t.themeSunset}</option>
                  <option value="violet">{t.themeViolet}</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                  {t.accentColor}
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {accentColor}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="h-10 w-10 cursor-pointer rounded border-0 p-0"
                    value={accentColor}
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm uppercase outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                    value={accentColor}
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0a0f1c] shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/60 bg-[#0d1323] px-4 py-3">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={16} className="text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {t.embedCode}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
              >
                {copied ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
                {copied ? t.copied : t.copyCode}
              </button>
            </div>
            <div className="overflow-x-auto p-4">
              <pre className="text-sm font-mono text-slate-300">
                <code>{embedCode}</code>
              </pre>
            </div>
            <div className="flex items-start gap-3 border-t border-slate-800/60 bg-[#0d1323] px-4 py-3">
              <div className="mt-0.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                {t.embedHelp}
              </p>
            </div>
          </div>

          <div className="relative flex min-h-[800px] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:min-h-[1000px]">
            <h3 className="absolute left-6 top-6 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              {t.livePreview}
              {!enabled && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] uppercase text-red-600">
                  {t.hidden}
                </span>
              )}
            </h3>
            <div className="mt-8 max-w-sm text-center">
              <p className="mb-4 text-sm text-slate-500">
                {t.previewHelp}
              </p>
            </div>

            {enabled && (
              <div className="pointer-events-none absolute bottom-0 right-0 h-[950px] w-[500px] max-w-full origin-bottom-right scale-[0.6] transition-transform duration-500 sm:scale-[0.8] md:scale-95 lg:scale-110 xl:scale-125">
                <iframe
                  src={`/${locale}/widget?harborId=${selectedLocationId}&harborName=${encodeURIComponent(locationName)}&tenant=${tenant}&accentColor=${encodeURIComponent(accentColor)}&themePreset=${themePreset}&welcomeText=${encodeURIComponent(welcomeText)}`}
                  className="pointer-events-auto h-full w-full border-0"
                  title={t.previewTitle}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
