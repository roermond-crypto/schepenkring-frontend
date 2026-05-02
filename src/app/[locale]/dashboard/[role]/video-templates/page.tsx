"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Settings2, Workflow, Music, Upload, Trash2, Play, Pause, Loader2 } from "lucide-react";

interface VideoTemplate {
  id: number;
  name: string;
  slug: string;
  video_type: string;
  is_active: boolean;
  is_default: boolean;
  settings_json: TemplateConfig;
  ai_rules_json: TemplateConfig;
}

type TemplateValue = string | number | boolean | string[] | undefined;
type TemplateConfig = Record<string, TemplateValue>;
type ApiErrorLike = {
  response?: { data?: { errors?: Record<string, string[]>; message?: string } };
  friendlyMessage?: string;
  message?: string;
};

const configString = (value: TemplateValue, fallback = "") =>
  typeof value === "string" ? value : fallback;
const configNumber = (value: TemplateValue, fallback = 0) =>
  typeof value === "number" ? value : fallback;
const normalizeMediaUrl = (url: string) => {
  if (typeof window === "undefined") return url;

  try {
    const parsed = new URL(url);
    const apiBase = typeof api.defaults.baseURL === "string" ? new URL(api.defaults.baseURL) : null;
    if (apiBase && parsed.hostname === "localhost" && parsed.pathname.startsWith("/api/")) {
      parsed.protocol = apiBase.protocol;
      parsed.host = apiBase.host;
      return parsed.toString();
    }
  } catch {}

  return url;
};

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const defaultSettings = {
  // Section 1 - Global Style
  pacing_profile: "balanced",
  style_name: "luxury",
  target_platforms: ["facebook", "instagram"],
  // Section 2 - Duration Rules
  hero_image_duration: 5.0,
  feature_image_duration: 4.0,
  detail_image_duration: 2.0,
  min_duration_per_scene: 1.5,
  max_duration_per_scene: 6.0,
  total_max_duration_sec: 90,
  preferred_transitions: ["fade", "crossfade"],
  default_transition_duration: 0.8,
  motion_style: "slow_zoom_in",
  // Section 3 - Content Rules
  exterior_before_interior: true,
  engine_at_end: true,
  skip_weak_images: true,
  // Section 4 - Intro/Outro
  intro_enabled: true,
  intro_type: "title_card",
  outro_enabled: true,
  cta_text: "Contact Schepenkring for a viewing",
  logo_enabled: true,
  whatsapp_url: "",
  website_url: "",
  // Section 5 - Audio
  music_family: "luxury_calm",
  music_intensity: "medium",
  ducking_enabled: true,
  // Section 6 - Overlay
  show_title_on_hero_only: true,
  overlay_show_price: true,
  overlay_show_specs: true,
};

const defaultRules = {
  // Section 7 - AI Rules
  ai_enabled: true,
  auto_apply: false,
  let_ai_suppress_low_quality: true,
  let_ai_reorder: true,
  let_ai_generate_overlay_text: true,
  prefer_order: ["hero_exterior", "secondary_exterior", "deck_cockpit", "saloon", "galley", "master_cabin", "bathroom", "helm_station", "engine_machinery", "detail_finish", "lifestyle_ambiance"],
  premium_price_threshold: 300000,
};

export default function VideoTemplatesPage() {
  const t = useTranslations("VideoTemplates");
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [selected, setSelected] = useState<VideoTemplate | null>(null);
  // Music tracks
  const [tracks, setTracks] = useState<{slug:string;name:string;size_kb:number;url:string;category?:string;intensity?:string;duration?:string}[]>([]);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState<string|null>(null);
  const [playingTrack, setPlayingTrack] = useState<string|null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPos, setAudioPos] = useState(0);
  const [audioDur, setAudioDur] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState<File|null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadIntensity, setUploadIntensity] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const loadTracks = async () => {
    try { const r = await api.get("/video/music-tracks"); setTracks(Array.isArray(r.data) ? r.data : []); } catch {}
  };
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [videoType, setVideoType] = useState("horizontal");
  const [isDefault, setIsDefault] = useState(false);
  const [settings, setSettings] = useState<TemplateConfig>(defaultSettings);
  const [rules, setRules] = useState<TemplateConfig>(defaultRules);

  const load = async () => {
    try { const res = await api.get("/video-templates"); setTemplates(Array.isArray(res.data) ? res.data : res.data?.data ?? []); } catch {}
  };

  useEffect(() => {
    void load(); void loadTracks();
  }, []);

  // Shared audio element for the entire library, so only one track plays at a time.
  // We keep it mounted regardless of list state.
  // eslint-disable-next-line jsx-a11y/media-has-caption
  const audioElement = (
    <audio ref={audioRef} preload="metadata" className="hidden" />
  );

  // Keep audio UI state in sync with the shared <audio> element.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => {
      setAudioDur(isFinite(el.duration) ? el.duration : 0);
      setAudioPos(isFinite(el.currentTime) ? el.currentTime : 0);
    };
    const onTime = () => setAudioPos(isFinite(el.currentTime) ? el.currentTime : 0);
    const onPlay = () => setAudioPlaying(true);
    const onPause = () => setAudioPlaying(false);
    const onEnded = () => {
      setAudioPlaying(false);
      setPlayingTrack(null);
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const reset = () => {
    setSelected(null);
    setName(""); setSlug(""); setVideoType("horizontal"); setIsDefault(false);
    setSettings(defaultSettings); setRules(defaultRules);
  };

  const edit = (t: VideoTemplate) => {
    setSelected(t);
    setName(t.name); setSlug(t.slug); setVideoType(t.video_type);
    setIsDefault(t.is_default); setSettings(t.settings_json); setRules(t.ai_rules_json);
  };

  const save = async () => {
    setSaving(true); setFeedback(null); setError(null);
    try {
      const payload = { name, slug, video_type: videoType, is_default: isDefault, settings_json: settings, ai_rules_json: rules };
      if (selected) {
        await api.put(`/video-templates/${selected.id}`, payload);
        setFeedback(t("updated"));
      } else {
        await api.post("/video-templates", payload);
        setFeedback(t("created"));
      }
      await load(); reset();
    } catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      const apiErrors = apiError.response?.data?.errors;
      if (apiErrors) {
        setError(Object.values(apiErrors).flat().join(" "));
      } else {
        setError(apiError.friendlyMessage || apiError.message || t("saveFailed"));
      }
    } finally { setSaving(false); }
  };

  const setSetting = (key: string, value: TemplateValue) => setSettings(s => ({ ...s, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900">{t("title")}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        </div>

        {feedback && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />{feedback}</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{selected ? t("editTemplate") : t("newTemplate")}</h2>
              {selected && <Button type="button" variant="outline" className="rounded-2xl text-xs" onClick={reset}>New</Button>}
            </div>

            {/* Base */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.name")}><input className="input-base" value={name} onChange={e => setName(e.target.value)} /></Field>
              <Field label={t("fields.slug")}><input className="input-base" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '_'))} /></Field>
              <Field label={t("fields.videoType")}>
                <select className="input-base" value={videoType} onChange={e => setVideoType(e.target.value)}>
                  <option value="horizontal">Horizontal (16:9)</option>
                  <option value="vertical">Vertical (9:16)</option>
                  <option value="square">Square (1:1)</option>
                </select>
              </Field>
              <Field label={t("fields.defaultTemplate")}>
                <label className="flex h-[52px] items-center gap-3 rounded-2xl border border-slate-300 px-4 text-sm">
                  <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />{t("setAsDefault")}
                </label>
              </Field>
            </div>

            {/* §1 Global Style */}
            <SectionHeader>{t("sections.globalStyle")}</SectionHeader>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("fields.pacingProfile")}>
                <select className="input-base" value={configString(settings.pacing_profile, "balanced")} onChange={e => setSetting('pacing_profile', e.target.value)}>
                  <option value="slow_cinematic">Slow Cinematic</option>
                  <option value="balanced">Balanced</option>
                  <option value="social_fast">Social Fast</option>
                </select>
              </Field>
              <Field label={t("fields.styleName")}>
                <select className="input-base" value={configString(settings.style_name, "luxury")} onChange={e => setSetting('style_name', e.target.value)}>
                  <option value="luxury">Luxury</option>
                  <option value="sporty">Sporty</option>
                  <option value="social">Social</option>
                  <option value="broker">Broker</option>
                </select>
              </Field>
              <Field label={t("fields.defaultMotion")}>
                <select className="input-base" value={configString(settings.motion_style, "slow_zoom_in")} onChange={e => setSetting('motion_style', e.target.value)}>
                  {["slow_zoom_in","slow_zoom_out","pan_left","pan_right","very_subtle_pan","static"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>

            {/* §2 Duration Rules */}
            <SectionHeader>{t("sections.durationRules")}</SectionHeader>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("fields.hero")}><input className="input-base" type="number" step="0.5" value={configNumber(settings.hero_image_duration)} onChange={e => setSetting('hero_image_duration', parseFloat(e.target.value))} /></Field>
              <Field label={t("fields.feature")}><input className="input-base" type="number" step="0.5" value={configNumber(settings.feature_image_duration)} onChange={e => setSetting('feature_image_duration', parseFloat(e.target.value))} /></Field>
              <Field label={t("fields.detail")}><input className="input-base" type="number" step="0.5" value={configNumber(settings.detail_image_duration)} onChange={e => setSetting('detail_image_duration', parseFloat(e.target.value))} /></Field>
              <Field label={t("fields.minPerScene")}><input className="input-base" type="number" step="0.5" value={configNumber(settings.min_duration_per_scene)} onChange={e => setSetting('min_duration_per_scene', parseFloat(e.target.value))} /></Field>
              <Field label={t("fields.maxPerScene")}><input className="input-base" type="number" step="0.5" value={configNumber(settings.max_duration_per_scene)} onChange={e => setSetting('max_duration_per_scene', parseFloat(e.target.value))} /></Field>
              <Field label={t("fields.totalMax")}><input className="input-base" type="number" value={configNumber(settings.total_max_duration_sec)} onChange={e => setSetting('total_max_duration_sec', parseInt(e.target.value))} /></Field>
            </div>

            {/* §3 Content Rules */}
            <SectionHeader>{t("sections.contentRules")}</SectionHeader>
            <div className="flex flex-wrap gap-5">
              {(["exterior_before_interior","engine_at_end","skip_weak_images"] as const).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!settings[k]} onChange={e => setSetting(k, e.target.checked)} />
                  {k.replace(/_/g,' ')}
                </label>
              ))}
            </div>

            {/* §4 Intro/Outro */}
            <SectionHeader>{t("sections.introOutro")}</SectionHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.introType")}>
                <select className="input-base" value={configString(settings.intro_type, "title_card")} onChange={e => setSetting('intro_type', e.target.value)}>
                  <option value="title_card">Title Card</option>
                  <option value="logo_reveal">Logo Reveal</option>
                  <option value="fade_in">Fade In</option>
                </select>
              </Field>
              <Field label={t("fields.ctaText")}><input className="input-base" value={configString(settings.cta_text)} onChange={e => setSetting('cta_text', e.target.value)} /></Field>
              <Field label="WhatsApp URL"><input className="input-base" type="url" placeholder="https://wa.me/..." value={configString(settings.whatsapp_url)} onChange={e => setSetting('whatsapp_url', e.target.value)} /></Field>
              <Field label="Website URL"><input className="input-base" type="url" placeholder="https://..." value={configString(settings.website_url)} onChange={e => setSetting('website_url', e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-5">
              {(["intro_enabled","outro_enabled","logo_enabled"] as const).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!settings[k]} onChange={e => setSetting(k, e.target.checked)} />
                  {k.replace(/_/g,' ')}
                </label>
              ))}
            </div>

            {/* §5 Audio */}
            <SectionHeader>{t("sections.audio")}</SectionHeader>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("fields.musicFamily")}>
                <select className="input-base" value={configString(settings.music_family, "luxury_calm")} onChange={e => setSetting('music_family', e.target.value)}>
                  {["luxury_calm","upbeat","cinematic","minimal"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label={t("fields.musicIntensity")}>
                <select className="input-base" value={configString(settings.music_intensity, "medium")} onChange={e => setSetting('music_intensity', e.target.value)}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </Field>
              <Field label={t("fields.ducking")}>
                <label className="flex h-[52px] items-center gap-3 rounded-2xl border border-slate-300 px-4 text-sm">
                  <input type="checkbox" checked={!!settings.ducking_enabled} onChange={e => setSetting('ducking_enabled', e.target.checked)} />Ducking enabled
                </label>
              </Field>
            </div>

            {/* §6 Overlay */}
            <SectionHeader>{t("sections.overlay")}</SectionHeader>
            <div className="flex flex-wrap gap-5">
              {(["show_title_on_hero_only","overlay_show_price","overlay_show_specs"] as const).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!settings[k]} onChange={e => setSetting(k, e.target.checked)} />
                  {k.replace(/_/g,' ')}
                </label>
              ))}
            </div>

            {/* §7 AI Rules */}
            <SectionHeader>{t("sections.aiRules")}</SectionHeader>
            <div className="flex flex-wrap gap-5">
              {(["ai_enabled","auto_apply","let_ai_suppress_low_quality","let_ai_reorder","let_ai_generate_overlay_text"] as const).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!rules[k]} onChange={e => setRules(r => ({ ...r, [k]: e.target.checked }))} />
                  {k.replace(/_/g,' ')}
                </label>
              ))}
            </div>

            <Button type="button" className="rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800" onClick={() => void save()} disabled={saving || !name || !slug}>
              <Settings2 className="mr-2 h-4 w-4" />
              {saving ? t("saving") : selected ? t("updateTemplate") : t("createTemplate")}
            </Button>
          </div>

          {/* List */}
          <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">{t("configuredTemplates")}</h2>
            {templates.length === 0
              ? <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t("noTemplates")}</p>
              : templates.map(t => (
                <button key={t.id} type="button" onClick={() => edit(t)}
                  className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{t.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.is_default ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {t.is_default ? "Default" : t.video_type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.slug} · {t.video_type} · {t.is_active ? "Active" : "Inactive"}</p>
                </button>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Music Library ── */}
      <div className="mx-auto max-w-6xl pb-10 px-4 md:px-0 space-y-4">

        {/* Upload New Music */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Upload New Music</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left — Drag & Drop */}
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f){setUploadFile(f);if(!uploadName)setUploadName(f.name.replace(/\.mp3$/i,"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()));}}}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${dragOver?"border-blue-400 bg-blue-50":"border-slate-300 bg-slate-50"}`}
              onClick={()=>document.getElementById("mp3-file-input")?.click()}>
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
                <Upload size={24} className="text-white"/>
              </div>
              <p className="text-sm font-medium text-slate-700">Drag &amp; drop your MP3 file here</p>
              <p className="text-xs text-slate-400">or</p>
              <button type="button" className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-700">
                {uploadFile ? uploadFile.name : "Choose MP3 File"}
              </button>
              <p className="text-xs text-slate-400">Max size: 50MB + Format: MP3</p>
              <input id="mp3-file-input" type="file" accept=".mp3,audio/mpeg" className="hidden"
                onChange={e=>{const f=e.target.files?.[0];if(f){setUploadFile(f);if(!uploadName)setUploadName(f.name.replace(/\.mp3$/i,"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()));}}}/>
            </div>

            {/* Right — Form fields */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Music Name</label>
                <input value={uploadName} onChange={e=>setUploadName(e.target.value)} placeholder="e.g. Luxury Calm"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Category</label>
                  <select value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-blue-400">
                    <option value="">Select category</option>
                    <option value="Lofi">Lofi</option>
                    <option value="Modern">Modern</option>
                    <option value="Sport">Sport</option>
                    <option value="Cinematic">Cinematic</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Intensity</label>
                  <select value={uploadIntensity} onChange={e=>setUploadIntensity(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-blue-400">
                    <option value="">Select intensity</option>
                    <option value="Calm">Calm</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Description (optional)</label>
                <textarea value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} rows={3}
                  placeholder="Add a short description about this music..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none"/>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={()=>{setUploadFile(null);setUploadName("");setUploadCategory("");setUploadIntensity("");setUploadDesc("");}}
                  className="flex items-center gap-2 border border-slate-300 text-slate-600 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                  ↺ Reset
                </button>
                <button type="button" disabled={uploadingTrack||!uploadFile}
                  onClick={async()=>{
                    if(!uploadFile) return;
                    setUploadingTrack(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", uploadFile);
                      const res = await api.post("/video/music-tracks", fd, {headers:{"Content-Type":"multipart/form-data"}});
                      // Store category/intensity in local state since backend doesn't persist them
                      const slug = res.data.slug;
                      setTracks(prev => prev.map(t => t.slug===slug ? {...t, category:uploadCategory||undefined, intensity:uploadIntensity||undefined} : t));
                      setUploadFile(null);setUploadName("");setUploadCategory("");setUploadIntensity("");setUploadDesc("");
                      await loadTracks();
                    } catch(e: unknown){
                      const apiError = e as ApiErrorLike;
                      alert(apiError.response?.data?.message || "Upload failed");
                    }
                    finally{setUploadingTrack(false);}
                  }}
                  className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {uploadingTrack?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}
                  {uploadingTrack?"Uploading…":"Upload Track"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Music Library */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {audioElement}
          <button type="button" onClick={()=>setLibraryOpen(o=>!o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
            <span className="text-base font-bold text-slate-900">Music Library ({tracks.length} tracks)</span>
            <span className="text-slate-400 text-lg">{libraryOpen?"∨":"∧"}</span>
          </button>
          {libraryOpen && (
            <div className="divide-y divide-slate-100">
              {tracks.length === 0 ? (
                <p className="text-sm text-slate-400 p-6 text-center">No music tracks uploaded yet.</p>
              ) : tracks.map((track, i) => {
                const colors = ["from-purple-500 to-blue-500","from-green-500 to-teal-500","from-red-500 to-pink-500","from-orange-500 to-yellow-500","from-indigo-500 to-purple-500"];
                const color = colors[i % colors.length];
                return (
                  <div key={track.slug} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                    {/* Play / Pause */}
                    <button
                      type="button"
                      onClick={async () => {
                        const el = audioRef.current;
                        if (!el) return;

                        const nextSrc = normalizeMediaUrl(track.url);

                        // Toggle pause if this track is already active
                        if (playingTrack === track.slug) {
                          if (el.paused) await el.play();
                          else el.pause();
                          return;
                        }

                        // Switch track (stop previous)
                        el.pause();
                        setAudioPlaying(false);
                        setAudioPos(0);
                        setAudioDur(0);
                        setPlayingTrack(track.slug);

                        el.src = nextSrc;
                        el.load();
                        try {
                          await el.play();
                        } catch {
                          setPlayingTrack(null);
                          alert("This music track could not be played.");
                        }
                      }}
                      className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center flex-shrink-0"
                      title={playingTrack === track.slug && audioPlaying ? "Pause" : "Play"}
                    >
                      {playingTrack === track.slug && audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    {/* Colored icon */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                      <Music size={16} className="text-white"/>
                    </div>
                    {/* Name */}
                    <span className="text-sm font-semibold text-slate-900 w-36 truncate">{track.name}</span>
                    {/* Tags */}
                    <div className="flex gap-2 flex-1">
                      {track.category && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{track.category}</span>}
                      {track.intensity && <span className={`text-xs px-2.5 py-1 rounded-full ${track.intensity==="High"?"bg-red-100 text-red-600":track.intensity==="Medium"?"bg-orange-100 text-orange-600":"bg-green-100 text-green-600"}`}>{track.intensity}</span>}
                    </div>
                    {/* Time + seek (only for the active track) */}
                    <div className="flex flex-col items-end gap-1 w-56 flex-shrink-0">
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {playingTrack === track.slug ? `${formatTime(audioPos)} / ${formatTime(audioDur || 0)}` : "—"}
                      </span>
                      {playingTrack === track.slug ? (
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, audioDur || 0)}
                          step={0.1}
                          value={Math.min(audioPos, audioDur || 0)}
                          onChange={(e) => {
                            const el = audioRef.current;
                            if (!el) return;
                            const next = Number(e.target.value);
                            el.currentTime = next;
                            setAudioPos(next);
                          }}
                          className="h-1 w-full cursor-pointer accent-blue-600"
                          aria-label="Seek audio"
                        />
                      ) : (
                        <div className="h-1 w-full rounded bg-slate-100" />
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" disabled={deletingTrack===track.slug}
                        onClick={async()=>{
                          if(!confirm(`Delete "${track.name}"?`)) return;
                          setDeletingTrack(track.slug);
                          try{await api.delete(`/video/music-tracks/${track.slug}`);await loadTracks();}
                          catch{alert("Delete failed");}
                          finally{setDeletingTrack(null);}
                        }} className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-50">
                        {deletingTrack===track.slug?<Loader2 size={16} className="animate-spin"/>:<Trash2 size={16}/>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .input-base { width:100%; border-radius:1rem; border:1px solid rgb(203 213 225); background:white; padding:0.85rem 1rem; font-size:0.9rem; color:rgb(15 23 42); outline:none; }
        .input-base:focus { border-color:rgb(14 165 233); box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-t border-slate-100 pt-4">{children}</h3>;
}
