"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Paintbrush, Globe, LayoutTemplate, Save, Power } from "lucide-react";
import { api } from "@/lib/api";
import { toast, Toaster } from "react-hot-toast";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import { useParams } from "next/navigation";

type LocationItem = {
    id: number;
    name: string;
    code: string;
};

export default function ChatWidgetPreviewPage() {
    const params = useParams();
    const locale = params.locale as AppLocale;
    const dictionary = getDictionary(locale);
    const t = (dictionary as any).widgetConfig || {
        title: "Chat Widget Configuration",
        subtitle: "Embed Live Chat on Public Websites",
        enableWidget: "Enable Widget",
        welcomeText: "Welcome Text",
        welcomePlaceholder: "e.g. Hi! How can we help you?",
        saveSuccess: "Widget settings saved",
        saveError: "Failed to save settings",
        copyCode: "Copy Code"
    };

    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [selectedHarbor, setSelectedHarbor] = useState<string>("");
    const [harborName, setHarborName] = useState<string>("");
    const [accentColor, setAccentColor] = useState<string>("#2563eb");
    const [themePreset, setThemePreset] = useState<string>("ocean");
    const [tenant, setTenant] = useState<string>("schepenkring");
    const [enabled, setEnabled] = useState<boolean>(true);
    const [welcomeText, setWelcomeText] = useState<string>("");
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const res = await api.get('/public/locations');
                const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                setLocations(data);
                if (data.length > 0) {
                    const first = data[0];
                    setSelectedHarbor(first.id.toString());
                    setHarborName(first.name);
                    fetchSettings(first.id);
                }
            } catch (err) {
                toast.error("Failed to load locations");
                console.error(err);
            }
        };
        fetchLocations();
    }, []);

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

    const handleHarborChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedHarbor(id);
        const loc = locations.find(l => l.id.toString() === id);
        if (loc) {
            setHarborName(loc.name);
            fetchSettings(parseInt(id));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/admin/locations/${selectedHarbor}/widget-settings`, {
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

    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://app.schepen-kring.nl';

    const embedCode = `<!-- NauticSecure Chat Widget -->
<script 
  src="${domain}/api/widget/chat.js"
  data-harbor-id="${selectedHarbor}"
  data-harbor-name="${harborName}"
  data-tenant="${tenant}"
  data-accent-color="${accentColor}"
  data-theme="${themePreset}"
  defer
></script>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        toast.success(t.copyCode + " " + (locale === 'nl' ? 'gekopieerd' : 'copied'));
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <Toaster position="top-right" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    {saving ? <span className="animate-spin mr-2">...</span> : <Save size={18} />}
                    {locale === 'nl' ? 'Opslaan' : 'Save Settings'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Globe size={18} className="text-blue-600" />
                            Location Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Select Harbor</label>
                                <select
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                                    value={selectedHarbor}
                                    onChange={handleHarborChange}
                                >
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                    {locations.length === 0 && <option value="">Loading...</option>}
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div
                                        onClick={() => setEnabled(!enabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : ''}`} />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.enableWidget}</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t.welcomeText}</label>
                                <textarea
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                                    rows={3}
                                    placeholder={t.welcomePlaceholder}
                                    value={welcomeText}
                                    onChange={(e) => setWelcomeText(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tenant ID</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                                    value={tenant}
                                    onChange={(e) => setTenant(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Paintbrush size={18} className="text-blue-600" />
                            Appearance
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Theme Preset</label>
                                <select
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                                    value={themePreset}
                                    onChange={(e) => setThemePreset(e.target.value)}
                                >
                                    <option value="ocean">Ocean Blue</option>
                                    <option value="sunset">Sunset Orange</option>
                                    <option value="violet">Violet Purple</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                                    Accent Color
                                    <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{accentColor}</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 uppercase font-mono"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Code Output & Live Preview wrapper */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#0a0f1c] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0d1323]">
                            <div className="flex items-center gap-2">
                                <LayoutTemplate size={16} className="text-blue-400" />
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Embed Code</span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors text-xs font-medium"
                            >
                                {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                {copied ? (locale === 'nl' ? "Gekopieerd!" : "Copied!") : t.copyCode}
                            </button>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <pre className="text-sm font-mono text-slate-300">
                                <code>{embedCode}</code>
                            </pre>
                        </div>
                        <div className="px-4 py-3 bg-[#0d1323] border-t border-slate-800/60 flex items-start gap-3">
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse"></div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                {locale === 'nl'
                                    ? "Kopieer en plak dit fragment in de <head> of net voor de sluitende </body>-tag van je website. De chat-widget verschijnt automatisch in de rechterbenedenhoek."
                                    : "Copy and paste this snippet into the <head> or just before the closing </body> tag of your website. The chat widget will automatically appear in the bottom right corner."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[800px] lg:min-h-[1000px] flex flex-col items-center justify-center relative overflow-hidden">
                        <h3 className="absolute top-6 left-6 text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Live Preview
                            {!enabled && (
                                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full uppercase">Hidden</span>
                            )}
                        </h3>
                        <div className="text-center max-w-sm mt-8">
                            <p className="text-sm text-slate-500 mb-4">
                                The widget will appear in the bottom right corner of this container just like it would on your website.
                            </p>
                        </div>

                        {/* The actual iframe preview - Seamless & Floating - MAXIMIZED */}
                        {enabled && (
                            <div className="absolute right-0 bottom-0 w-[500px] h-[950px] max-w-full pointer-events-none origin-bottom-right scale-[0.6] sm:scale-[0.8] md:scale-95 lg:scale-110 xl:scale-125 transition-transform duration-500">
                                <iframe
                                    src={`/en/widget?harborId=${selectedHarbor}&harborName=${harborName}&tenant=${tenant}&accentColor=${encodeURIComponent(accentColor)}&themePreset=${themePreset}&welcomeText=${encodeURIComponent(welcomeText)}`}
                                    className="w-full h-full border-0 pointer-events-auto"
                                    title="Chat Widget Preview"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
