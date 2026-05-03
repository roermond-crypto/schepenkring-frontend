"use client";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getStorageUrl } from "@/lib/storage-url";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Loader2, Sparkles, RefreshCw, Trash2, Play, Pause, GripVertical, MoreVertical } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TemplateConfig = Record<string, string | number | boolean | string[] | undefined>;
type VideoVariation = "horizontal" | "vertical" | "square" | "teaser";
type ApiErrorLike = { response?: { data?: { error?: string; message?: string } }; message?: string };
const templateString = (value: TemplateConfig[string], fallback = "") =>
  typeof value === "string" ? value : fallback;
const normalizeMediaUrl = (url: string) => {
  if (typeof window === "undefined") return url;

  try {
    const parsed = new URL(url);
    const apiBase = typeof api.defaults.baseURL === "string" ? new URL(api.defaults.baseURL) : null;
    if (apiBase && parsed.hostname === "localhost") {
      parsed.protocol = apiBase.protocol;
      parsed.host = apiBase.host;
      return parsed.toString();
    }
  } catch {}

  return url;
};
interface VideoTemplate { id: number; name: string; slug: string; is_default: boolean; settings_json: TemplateConfig; ai_rules_json: TemplateConfig; }
interface Scene {
  image_id: number; scene_type: string; importance: string;
  duration: number; transition_in: string; transition_out: string;
  motion: { enabled: boolean; style?: string };
  overlay: { enabled: boolean; headline?: string; subline?: string };
  exclude?: boolean;
}
interface VideoPlanJson {
  scenes?: Scene[];
  intro?: Record<string, string | boolean | undefined>;
  outro?: Record<string, string | boolean | undefined>;
  audio?: Record<string, string | number | boolean | undefined>;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function apiOrigin(): string {
  try {
    const base = typeof api.defaults.baseURL === "string" ? api.defaults.baseURL : "";
    // base is expected to end in /api
    return base.replace(/\/api\/?$/, "");
  } catch {
    return "";
  }
}
interface AiInputJson {
  images?: unknown[];
  template?: Record<string, unknown>;
  rules?: { prefer_order?: string[] };
}
interface VideoPlan {
  id: number; status: string; variation: string;
  validation_errors: string[];
  render_output_url: string | null;
  ai_input_json: AiInputJson;
  ai_output_json: unknown;
  final_plan_json: VideoPlanJson | null;
  created_at: string;
}
interface YachtImage { id: number; url: string; full_url: string; category: string; }
interface YachtInfo {
  id: number;
  boat_name?: string;
  manufacturer?: string;
  model?: string;
  year?: number | string;
  length_overall?: number | string;
  location_city?: string;
  main_image?: string;
}

const TRANSITIONS = ["fade","crossfade","fadeblack","dissolve","slideright","slideleft"];
const MOTIONS     = ["slow_zoom_in","slow_zoom_out","pan_left","pan_right","very_subtle_pan","static"];
const SCENE_TYPES = ["hero_exterior","secondary_exterior","deck_cockpit","saloon","galley","master_cabin","bathroom","helm_station","engine_machinery","detail_finish","lifestyle_ambiance","general"];
const MOTION_LABELS: Record<string,string> = { slow_zoom_in:"Slow Zoom In", slow_zoom_out:"Slow Zoom Out", pan_left:"Pan Left", pan_right:"Pan Right", very_subtle_pan:"Subtle Pan", static:"Static" };
const SCENE_LABEL: Record<string,string> = {
  hero_exterior:"Hero Exterior", secondary_exterior:"Exterior", deck_cockpit:"Cockpit",
  saloon:"Interior (Saloon)", galley:"Interior (Galley)", master_cabin:"Master Cabin",
  bathroom:"Interior (Other)", helm_station:"Detail / Close-up", engine_machinery:"Engine / Technical",
  detail_finish:"Detail / Close-up", lifestyle_ambiance:"Lifestyle / Ambience", general:"General",
};

function sceneTypeCounts(scenes: Scene[]) {
  const map: Record<string,number> = {};
  for (const s of scenes) { const l = SCENE_LABEL[s.scene_type] ?? s.scene_type; map[l] = (map[l]??0)+1; }
  return map;
}
function totalDuration(plan: VideoPlan|null) {
  if (!plan?.final_plan_json?.scenes) return "0:00";
  const secs = plan.final_plan_json.scenes.filter(s=>!s.exclude).reduce((a,s)=>a+s.duration,0);
  return `${Math.floor(secs/60)}:${Math.round(secs%60).toString().padStart(2,"0")}`;
}

export default function VideoSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const tv = useTranslations("VideoSettings");
  const tvRef = useRef(tv);
  const yachtId = params.id as string;
  const locale = (params.locale as string) || "en";
  const role = (params.role as string) || "admin";

  const [templates, setTemplates]           = useState<VideoTemplate[]>([]);
  const [plans, setPlans]                   = useState<VideoPlan[]>([]);
  const [imageMap, setImageMap]             = useState<Record<number,YachtImage>>({});
  const [yachtInfo, setYachtInfo]           = useState<YachtInfo | null>(null);
  const [allYachts, setAllYachts]           = useState<YachtInfo[]>([]);
  const [yachtImageCount, setYachtImageCount] = useState<number | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [variation, setVariation]           = useState<VideoVariation>("horizontal");
  const [outputType, setOutputType]         = useState("listing");
  const [activeTab, setActiveTab]           = useState(0);
  const [styleProfile, setStyleProfile]     = useState("luxury");
  const [activePlanId, setActivePlanId]     = useState<number|null>(null);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState<number|null>(null);
  const [editingScenes, setEditingScenes]   = useState<Scene[]>([]);
  const [previewingPlan, setPreviewingPlan]   = useState(false);
  const [previewThumb, setPreviewThumb]       = useState<string|null>(null);
  const [generatingPlan, setGeneratingPlan]   = useState(false);
  const [approvingPlan, setApprovingPlan]   = useState(false);
  const [renderingPlan, setRenderingPlan]   = useState(false);
  const [retryingPlan, setRetryingPlan]     = useState(false);
  const [deletingPlan, setDeletingPlan]     = useState<number|null>(null);
  const [savingScenes, setSavingScenes]     = useState(false);
  const [openRowMenu, setOpenRowMenu]       = useState<number|null>(null);
  const [lastRenderError, setLastRenderError] = useState<string|null>(null);
  const [showRenderTechDetails, setShowRenderTechDetails] = useState(false);

  // Media refs for custom seek/play controls.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [videoPos, setVideoPos] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioDur, setAudioDur] = useState(0);
  const [audioPos, setAudioPos] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const [musicTracks, setMusicTracks] = useState<{ slug: string; name: string; url: string }[]>([]);
  const [activeTrack, setActiveTrack] = useState<string | null>(null);

  // AI Preferences with per-rule values
  const [aiPrefs, setAiPrefs] = useState({
    first_image_longer: true,    first_image_duration: 5.0,
    feature_images_longer: true, feature_image_duration: 4.0,
    detail_images_shorter: true, detail_image_duration: 2.0,
    interior_pacing: "moderate",
    exterior_pacing: "slow_cinematic",
    prefer_exterior_first: true,
    show_engine_details: "at_the_end",
    remove_low_quality: true,
    let_ai_reorder: true,
  });

  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const activePlan = useMemo(
    () => plans.find(p=>p.id===activePlanId) ?? plans[0] ?? null,
    [activePlanId, plans]
  );
  const activeScenes = activePlan?.final_plan_json?.scenes;

  useEffect(() => {
    tvRef.current = tv;
  }, [tv]);

  const refreshPlans = useCallback(async () => {
    const res = await api.get(`/yachts/${yachtId}/video-plans`);
    const updated: VideoPlan[] = Array.isArray(res.data) ? res.data : [];
    const sorted = [...updated].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    setPlans(sorted);
    return sorted;
  }, [yachtId]);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, pRes, yRes, allYRes, vsRes, tracksRes] = await Promise.all([
          api.get("/video-templates"),
          api.get(`/yachts/${yachtId}/video-plans`),
          api.get(`/yachts/${yachtId}`),
          api.get("/yachts?per_page=100"),
          api.get(`/yachts/${yachtId}/video-settings`),
          api.get("/video/music-tracks"),
        ]);
        const tmpl: VideoTemplate[] = Array.isArray(tRes.data) ? tRes.data : [];
        setTemplates(tmpl);
        const def = tmpl.find(t=>t.is_default) ?? tmpl[0];
        if (def) { setSelectedTemplateId(String(def.id)); setStyleProfile(templateString(def.settings_json?.style_name, "luxury")); }
        const ps: VideoPlan[] = Array.isArray(pRes.data) ? pRes.data : [];
        const sortedPlans = [...ps].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        setPlans(sortedPlans);
        if (sortedPlans.length) setActivePlanId(sortedPlans[0].id);
        setYachtInfo(yRes.data);
        const yachts = allYRes.data?.data ?? allYRes.data ?? [];
        setAllYachts(Array.isArray(yachts) ? yachts : []);
        setYachtImageCount(vsRes.data?.image_count ?? 0);
        const tracks = Array.isArray(tracksRes.data) ? tracksRes.data : [];
        setMusicTracks(tracks);
        if (tracks.length) {
          const preferred = (ps?.[0] as any)?.final_plan_json?.audio?.music_profile;
          const found = typeof preferred === "string" ? tracks.find(t => t.slug === preferred) : null;
          setActiveTrack(found ? found.slug : tracks[0].slug);
        }
        try {
          const imgRes = await api.get(`/yachts/${yachtId}/images`);
          const imgs: YachtImage[] = Array.isArray(imgRes.data) ? imgRes.data : (imgRes.data?.images??[]);
          const map: Record<number,YachtImage> = {};
          imgs.forEach((img:YachtImage) => { map[img.id]=img; });
          setImageMap(map);
        } catch {}
      } catch { toast.error(tvRef.current("toasts.loadFailed")); }
      finally { setLoading(false); }
    })();
  }, [yachtId]);

  useEffect(() => {
    if (activeScenes) {
      setEditingScenes(JSON.parse(JSON.stringify(activeScenes)));
      setSelectedSceneIdx(null);
      setPreviewThumb(null);
    }
  }, [activeScenes]);

  // Reset media UI state when switching plans/tracks
  useEffect(() => {
    setVideoDur(0);
    setVideoPos(0);
    setVideoPlaying(false);
  }, [activePlan?.id]);

  useEffect(() => {
    setAudioDur(0);
    setAudioPos(0);
    setAudioPlaying(false);
  }, [activePlan?.id, activeTrack]);

  useEffect(() => {
    const hasRendering = plans.some(p=>p.status==="rendering");
    if (hasRendering && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const u = await refreshPlans();
        if (!u.some(p=>p.status==="rendering")) { clearInterval(pollRef.current!); pollRef.current=null; }
      }, 5000);
    }
    if (!hasRendering && pollRef.current) { clearInterval(pollRef.current); pollRef.current=null; }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current=null; } };
  }, [plans, refreshPlans]);

  useEffect(() => {
    if (openRowMenu === null) return;
    const close = () => setOpenRowMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openRowMenu]);

  const handleGenerate = async () => {
    if (!selectedTemplateId) return toast.error(tv("selectTemplateFirst"));
    setGeneratingPlan(true);
    try {
      await api.post(`/yachts/${yachtId}/video-plans`, {
        template_id: Number(selectedTemplateId),
        variation,
        output_type: outputType,
      });
      const u = await refreshPlans(); if (u.length) setActivePlanId(u[0].id);
      toast.success(tv("toasts.planGenerated"));
    } catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      const message =
        apiError.response?.data?.error ||
        apiError.response?.data?.message ||
        apiError.message ||
        tv("toasts.generationFailed");
      toast.error(message);
    }
    finally { setGeneratingPlan(false); }
  };

  const handleApprove = async () => {
    if (!activePlan) return; setApprovingPlan(true);
    try { await api.post(`/video-plans/${activePlan.id}/approve`); await refreshPlans(); toast.success(tv("toasts.planApproved")); }
    catch { toast.error(tv("toasts.approvalFailed")); } finally { setApprovingPlan(false); }
  };

  const handleRender = async () => {
    if (!activePlan) return; setRenderingPlan(true);
    setLastRenderError(null);
    try { await api.post(`/video-plans/${activePlan.id}/render`); toast.success(tv("toasts.renderQueued")); await refreshPlans(); }
    catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      const message = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message || null;
      setLastRenderError(message);
      toast.error(apiError.message ?? tv("toasts.renderFailed"));
    } finally { setRenderingPlan(false); }
  };

  const handleRetry = async () => {
    if (!activePlan) return; setRetryingPlan(true);
    setLastRenderError(null);
    try { await api.post(`/video-plans/${activePlan.id}/retry`); toast.success(tv("toasts.requeued")); await refreshPlans(); }
    catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      const message = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message || null;
      setLastRenderError(message);
      toast.error(apiError.message ?? tv("toasts.retryFailed"));
    } finally { setRetryingPlan(false); }
  };

  function summarizeRenderFailure(raw?: string | null): { headline: string; explanation: string; tech?: string } {
    const text = (raw || "").trim();
    if (!text) {
      return {
        headline: tv("status.renderFailed"),
        explanation:
          "The video could not be rendered. Please try Retry. If it keeps failing, share the technical details with support.",
      };
    }

    const isFfmpeg = text.toLowerCase().includes("ffmpeg");
    const shortened = text.length > 900 ? `${text.slice(0, 900)}…` : text;

    return {
      headline: tv("status.renderFailed"),
      explanation: isFfmpeg
        ? "The video builder (FFmpeg) failed while combining the clips. This is usually caused by a broken clip/image, an unsupported format, or not enough server resources. Try Retry once; if it fails again, share the technical details."
        : "Rendering failed. Try Retry once; if it fails again, share the technical details.",
      tech: shortened,
    };
  }

  const handlePreviewThumb = async () => {
    if (!activePlan) return; setPreviewingPlan(true);
    try {
      const res = await api.post(`/video-plans/${activePlan.id}/preview`);
      setPreviewThumb(res.data.preview_url);
      toast.success(tv("toasts.previewReady"));
    } catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      toast.error(apiError.response?.data?.error || apiError.message || tv("toasts.previewFailed"));
    }
    finally { setPreviewingPlan(false); }
  };

  const handleDelete = async (planId:number) => {
    if (!confirm(`Delete Plan #${planId}?`)) return; setDeletingPlan(planId);
    try {
      await api.delete(`/video-plans/${planId}`);
      const u = await refreshPlans(); if (activePlanId===planId) setActivePlanId(u[0]?.id??null);
      toast.success(tv("toasts.planDeleted"));
    } catch { toast.error(tv("toasts.deleteFailed")); } finally { setDeletingPlan(null); }
  };

  const handleSaveScenes = async () => {
    if (!activePlan) return; setSavingScenes(true);
    try {
      await api.patch(`/video-plans/${activePlan.id}`, { final_plan_json:{...activePlan.final_plan_json, scenes:editingScenes} });
      await refreshPlans(); toast.success(tv("toasts.scenesSaved"));
    } catch (e: unknown) {
      const apiError = e as ApiErrorLike;
      toast.error(apiError.message ?? tv("toasts.saveFailed"));
    } finally { setSavingScenes(false); }
  };

  const updateScene = (idx:number, field:string, value:string | number | boolean | undefined) => {
    setEditingScenes(prev => {
      const next=[...prev];
      if (field.includes(".")) {
        const [p,c]=field.split(".");
        const current = p === "motion" || p === "overlay" ? next[idx][p] : {};
        next[idx]={...next[idx],[p]:{...current,[c]:value}};
      }
      else next[idx]={...next[idx],[field]:value};
      return next;
    });
  };

  const selectedScene = selectedSceneIdx!==null ? editingScenes[selectedSceneIdx] : null;
  const sceneCounts = activePlan?.final_plan_json?.scenes ? sceneTypeCounts(activePlan.final_plan_json.scenes) : {};
  const imageCount = activePlan?.ai_input_json?.images?.length ?? Object.keys(imageMap).length;
  const yachtName = (yachtInfo?.boat_name ?? `${yachtInfo?.manufacturer??""} ${yachtInfo?.model??""}`.trim()) || "Yacht";
  const yachtSub = [yachtInfo?.year, yachtInfo?.length_overall?`${yachtInfo.length_overall}m`:null].filter(Boolean).join(" · ");
  const yachtLocation = yachtInfo?.location_city ? `Lying in ${yachtInfo.location_city}` : "";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={36}/></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900">

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{tv("pageTitle")}</h1>
          <p className="text-xs text-gray-500">{tv("pageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{tv("selectYacht")}</span>
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
              {yachtInfo?.main_image && (
                <Image
                  src={getStorageUrl(yachtInfo.main_image)}
                  width={32}
                  height={24}
                  unoptimized
                  className="w-8 h-6 object-cover rounded flex-shrink-0"
                  alt=""
                />
              )}
              <select className="text-sm font-medium bg-transparent outline-none pr-1"
                value={yachtId}
                onChange={e => router.push(`/${locale}/dashboard/${role}/yachts/${e.target.value}/video-settings`)}>
                {allYachts.map((y) => (
                  <option key={y.id} value={String(y.id)}>
                    {y.boat_name || `${y.manufacturer??""} ${y.model??""}`.trim() || `Yacht #${y.id}`} {y.year ? `(${y.year})` : ""}
                  </option>
                ))}
                {allYachts.length === 0 && <option value={yachtId}>{yachtName} {yachtInfo?.year ? `(${yachtInfo.year})` : ""}</option>}
              </select>
            </div>
          </div>
          {/* Preview Video — always shown */}
          <a href={activePlan?.render_output_url ? normalizeMediaUrl(activePlan.render_output_url) : "#"}
            target={activePlan?.render_output_url ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className={`flex items-center gap-2 border rounded-lg px-4 py-2 text-sm font-medium ${activePlan?.render_output_url ? "border-blue-600 text-blue-600 hover:bg-blue-50" : "border-gray-300 text-gray-400 cursor-not-allowed"}`}
            onClick={e => { if (!activePlan?.render_output_url) e.preventDefault(); }}>
            <Play size={14}/> {tv("previewVideo")}
          </a>
          {/* Render Final Video — clickable only when approved */}
          {activePlan?.status === "approved" ? (
            <button onClick={handleRender} disabled={renderingPlan}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              {renderingPlan ? <Loader2 size={14} className="animate-spin"/> : null} {tv("renderFinalVideo")}
            </button>
          ) : activePlan?.status === "ai_generated" ? (
            <button onClick={handleApprove} disabled={approvingPlan}
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
              {approvingPlan ? <Loader2 size={14} className="animate-spin"/> : null} {tv("approvePlan")}
            </button>
          ) : activePlan?.status === "rendering" ? (
            <button disabled className="bg-amber-500 text-white rounded-lg px-4 py-2 text-sm font-semibold opacity-80 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin"/> {tv("rendering")}
            </button>
          ) : (activePlan?.status === "failed") ? (
            <button onClick={handleRetry} disabled={retryingPlan}
              className="bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2">
              {retryingPlan ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} {tv("retryRender")}
            </button>
          ) : (
            <button disabled className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold opacity-40 flex items-center gap-2">
              {tv("renderFinalVideo")}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0 text-sm overflow-x-auto">
        {([
          tv("tabs.template"), tv("tabs.contentRules"), tv("tabs.audio"),
          tv("tabs.introOutro"), tv("tabs.aiPlan"), tv("tabs.reviewRender")
        ]).map((tab,i) => (
          <button key={i} onClick={()=>setActiveTab(i)}
            className={`px-4 py-3 border-b-2 font-medium whitespace-nowrap ${i===activeTab?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── 4-Column Grid (Tab 1) ── */}
      {activeTab === 0 && <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[260px_1fr_220px_300px] gap-4 items-start">

        {/* Col 1 — Template */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">{tv("template.title")}</h2>
            <Sparkles size={15} className="text-orange-400"/>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("template.selectLabel")}</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={selectedTemplateId} onChange={e => { setSelectedTemplateId(e.target.value); const t=templates.find(t=>String(t.id)===e.target.value); if(t) setStyleProfile(templateString(t.settings_json?.style_name, "luxury")); }}>
              <option value="">{tv("selectTemplate")}</option>
              {templates.map(t=><option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
            <button onClick={() => router.push(`/${locale}/dashboard/${role}/video-templates`)} className="text-xs text-blue-600 mt-1 hover:underline">{tv("manageTemplates")}</button>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-2">{tv("template.videoType")}</label>
            <div className="grid grid-cols-2 gap-1">
              {([["horizontal","Horizontal (16:9)"],["vertical","Vertical (9:16)"],["square","Square (1:1)"],["teaser","Teaser"]] as [string,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setVariation(v as VideoVariation)}
                  className={`py-2 text-xs font-medium rounded-lg border ${variation===v?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("template.outputType")}</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={outputType} onChange={e=>setOutputType(e.target.value)}>
              <option value="listing">{tv("template.outputListing")}</option>
              <option value="reel">{tv("template.outputReel")}</option>
              <option value="ad">{tv("template.outputAd")}</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-2">{tv("template.styleProfile")}</label>
            <div className="grid grid-cols-2 gap-2">
              {[["luxury","Luxury"],["modern","Modern"],["sporty","Sporty"],["social_fast","Social / Fast"]].map(([v,l])=>(
                <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="style" value={v} checked={styleProfile===v} onChange={()=>setStyleProfile(v)} className="text-blue-600"/>
                  {l}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{tv("template.styleHint")}</p>
          </div>
        </div>

        {/* Col 2 — AI Preferences */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold"><span className="text-blue-600">AI</span> {tv("aiPrefs.title")}</h2>
            <Sparkles size={15} className="text-orange-400"/>
          </div>
          <p className="text-xs text-gray-500">{tv("aiPrefs.subtitle")}</p>

          {/* Toggle + duration rows */}
          {([
            ["first_image_longer", tv("aiPrefs.firstImageLonger"), "first_image_duration"],
            ["feature_images_longer", tv("aiPrefs.featureImagesLonger"), "feature_image_duration"],
            ["detail_images_shorter", tv("aiPrefs.detailImagesShorter"), "detail_image_duration"],
          ] as [keyof typeof aiPrefs, string, keyof typeof aiPrefs][]).map(([key,label,durKey])=>(
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700 flex-1">{label}</span>
              <button onClick={()=>setAiPrefs(p=>({...p,[key]:!p[key]}))}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${aiPrefs[key]?"bg-blue-600":"bg-gray-300"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${aiPrefs[key]?"translate-x-4":"translate-x-0"}`}/>
              </button>
              <select className="border border-gray-300 rounded px-2 py-1 text-xs bg-white w-20"
                value={String(aiPrefs[durKey])}
                onChange={e=>setAiPrefs(p=>({...p,[durKey]:parseFloat(e.target.value)}))}>
                {[1.5,2,2.5,3,3.5,4,4.5,5,5.5,6].map(v=><option key={v} value={v}>{v} sec</option>)}
              </select>
            </div>
          ))}

          {/* Interior pacing dropdown */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.interiorPacing")}</span>
            <select className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              value={aiPrefs.interior_pacing} onChange={e=>setAiPrefs(p=>({...p,interior_pacing:e.target.value}))}>
              <option value="fast">{tv("aiPrefs.fast")}</option><option value="moderate">{tv("aiPrefs.moderate")}</option><option value="slow">{tv("aiPrefs.slow")}</option>
            </select>
          </div>

          {/* Exterior pacing dropdown */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.exteriorPacing")}</span>
            <select className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              value={aiPrefs.exterior_pacing} onChange={e=>setAiPrefs(p=>({...p,exterior_pacing:e.target.value}))}>
              <option value="fast">{tv("aiPrefs.fast")}</option><option value="moderate">{tv("aiPrefs.moderate")}</option><option value="slow_cinematic">{tv("aiPrefs.slowCinematic")}</option>
            </select>
          </div>

          {/* Prefer exterior first toggle */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.preferExteriorFirst")}</span>
            <button onClick={()=>setAiPrefs(p=>({...p,prefer_exterior_first:!p.prefer_exterior_first}))}
              className={`w-9 h-5 rounded-full transition-colors ${aiPrefs.prefer_exterior_first?"bg-blue-600":"bg-gray-300"} relative`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${aiPrefs.prefer_exterior_first?"translate-x-4":"translate-x-0"}`}/>
            </button>
          </div>

          {/* Show engine details dropdown */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.showEngineDetails")}</span>
            <select className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              value={aiPrefs.show_engine_details} onChange={e=>setAiPrefs(p=>({...p,show_engine_details:e.target.value}))}>
              <option value="at_the_end">{tv("aiPrefs.atTheEnd")}</option><option value="middle">{tv("aiPrefs.middle")}</option><option value="skip">{tv("aiPrefs.skip")}</option>
            </select>
          </div>

          {/* Remove low quality toggle */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.removeLowQuality")}</span>
            <button onClick={()=>setAiPrefs(p=>({...p,remove_low_quality:!p.remove_low_quality}))}
              className={`w-9 h-5 rounded-full transition-colors ${aiPrefs.remove_low_quality?"bg-blue-600":"bg-gray-300"} relative`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${aiPrefs.remove_low_quality?"translate-x-4":"translate-x-0"}`}/>
            </button>
          </div>

          {/* Allow AI to reorder toggle */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 flex-1">{tv("aiPrefs.allowReorder")}</span>
            <button onClick={()=>setAiPrefs(p=>({...p,let_ai_reorder:!p.let_ai_reorder}))}
              className={`w-9 h-5 rounded-full transition-colors ${aiPrefs.let_ai_reorder?"bg-blue-600":"bg-gray-300"} relative`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${aiPrefs.let_ai_reorder?"translate-x-4":"translate-x-0"}`}/>
            </button>
          </div>

          <button onClick={handleGenerate} disabled={generatingPlan||!selectedTemplateId||yachtImageCount===0}
            className="w-full flex items-center justify-center gap-2 border border-blue-600 text-blue-600 rounded-lg py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50 mt-1">
            {generatingPlan?<Loader2 size={14} className="animate-spin"/>:<RefreshCw size={14}/>}
            {generatingPlan ? tv("generating") : (plans.length ? tv("regeneratePlan") : tv("generatePlan"))}
          </button>
          {yachtImageCount === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              ⚠ {tv("noImages")}
            </p>
          )}
        </div>

        {/* Col 3 — AI Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold"><span className="text-blue-600">AI</span> {tv("aiSummary.title")}</h2>
            <Sparkles size={15} className="text-orange-400"/>
          </div>
          <p className="text-xs text-gray-500">{tv("aiSummary.analyzed", { count: imageCount })}</p>
          <div className="space-y-1.5">
            {Object.entries(sceneCounts).map(([type,count])=>(
              <div key={type} className="flex justify-between text-sm">
                <span className="text-gray-700">{type}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(sceneCounts).length===0 && <p className="text-xs text-gray-400">{tv("noPlanYet")}</p>}
          </div>
          {activePlan && (
            <div className={`rounded-lg p-3 text-sm ${
              activePlan.status==="rendered"?"bg-green-50 border border-green-200 text-green-800":
              activePlan.status==="failed"?"bg-red-50 border border-red-200 text-red-800":
              activePlan.status==="rendering"?"bg-amber-50 border border-amber-200 text-amber-800":
              "bg-blue-50 border border-blue-200 text-blue-800"}`}>
              <p className="font-semibold">
                {activePlan.status==="rendered"?tv("status.planGood"):
                 activePlan.status==="rendering"?tv("status.rendering"):
                 activePlan.status==="failed"?tv("status.renderFailed"):
                 activePlan.status==="approved"?tv("status.planApproved"):tv("status.planReady")}
              </p>
              <p className="text-xs mt-1 opacity-80">
                {activePlan.status==="ai_generated"?tv("status.reviewHint"):
                 activePlan.status==="approved"?tv("status.approvedHint"):
                 activePlan.status==="rendering"?tv("status.renderingHint"):""}
              </p>
              {activePlan.validation_errors?.length>0 && (
                <ul className="mt-1 text-xs space-y-0.5">{activePlan.validation_errors.map((e,i)=><li key={i}>⚠ {e}</li>)}</ul>
              )}
            </div>
          )}
        </div>

        {/* Col 4 — Video Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold">{tv("videoPreview.title")} <span className="text-xs text-gray-400 font-normal">({tv("estimated")})</span></h2>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio:"16/9"}}>
            {activePlan?.render_output_url ? (
              <>
                <video
                  ref={videoRef}
                  src={`${apiOrigin()}/api/video-plans/${activePlan.id}/stream`}
                  className="w-full h-full object-cover"
                  controls={false}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    setVideoDur(isFinite(el.duration) ? el.duration : 0);
                    setVideoPos(isFinite(el.currentTime) ? el.currentTime : 0);
                  }}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    setVideoPos(isFinite(el.currentTime) ? el.currentTime : 0);
                  }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onEnded={() => setVideoPlaying(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const el = videoRef.current;
                        if (!el) return;
                        if (el.paused) await el.play();
                        else el.pause();
                      }}
                      className="h-8 w-8 shrink-0 rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/15 flex items-center justify-center"
                      title={videoPlaying ? "Pause" : "Play"}
                    >
                      {videoPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <span className="w-[120px] shrink-0 text-[11px] font-medium text-white/90 tabular-nums text-right">
                      {formatTime(videoPos)} / {formatTime(videoDur || 0)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, videoDur || 0)}
                      step={0.1}
                      value={Math.min(videoPos, videoDur || 0)}
                      onChange={(e) => {
                        const el = videoRef.current;
                        if (!el) return;
                        const next = Number(e.target.value);
                        el.currentTime = next;
                        setVideoPos(next);
                      }}
                      className="h-1 w-full cursor-pointer accent-white"
                      aria-label="Seek"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-full h-full flex items-center justify-center">
                  {activePlan?.status==="rendering" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-white" size={24}/>
                      <span className="text-white text-xs">{tv("rendering")}</span>
                    </div>
                  ) : activePlan?.status === "failed" ? (
                    <div className="mx-4 w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-rose-950">
                      {(() => {
                        const failure = summarizeRenderFailure(
                          lastRenderError || (activePlan.validation_errors?.join("\n") ?? ""),
                        );
                        return (
                          <>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white">
                                <span className="text-rose-600 text-lg leading-none">!</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold">{failure.headline}</p>
                                <p className="mt-1 text-xs leading-5 text-rose-900/80">{failure.explanation}</p>
                              </div>
                            </div>

                            {failure.tech ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => setShowRenderTechDetails(v => !v)}
                                  className="text-[11px] font-bold uppercase tracking-widest text-rose-800 hover:underline"
                                >
                                  {showRenderTechDetails ? "Hide technical details" : "Show technical details"}
                                </button>
                                {showRenderTechDetails ? (
                                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-rose-200 bg-white p-2 text-[11px] leading-4 text-rose-950">
{failure.tech}
                                  </pre>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">{tv("noVideo")}</span>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white font-bold text-sm">{yachtName}</p>
                  {yachtSub && <p className="text-white/80 text-xs">{yachtSub}</p>}
                  {yachtLocation && <p className="text-white/60 text-xs">{yachtLocation}</p>}
                  <div className="mt-2 flex items-center gap-2 text-white/70 text-xs">
                    <Play size={12}/> <span>0:00 / {totalDuration(activePlan)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          {plans.length>1 && (
            <div className="flex flex-wrap gap-1">
              {plans.map(p=>(
                <button key={p.id} onClick={()=>setActivePlanId(p.id)}
                  className={`text-xs px-2 py-1 rounded-full border ${p.id===activePlanId?"bg-blue-600 text-white border-blue-600":"border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                  #{p.id} · {p.variation} · {p.status}
                </button>
              ))}
            </div>
          )}
          {/* Preview thumbnail */}
          {activePlan?.final_plan_json?.scenes && !activePlan.render_output_url && (
            <button onClick={handlePreviewThumb} disabled={previewingPlan}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
              {previewingPlan ? <><Loader2 size={14} className="animate-spin"/> {tv("generating")}</> : <><Play size={14}/> {tv("generatePreview")}</>}
            </button>
          )}
          {previewThumb && (
            <Image
              src={previewThumb}
              width={640}
              height={360}
              unoptimized
              alt="Preview"
              className="w-full rounded-lg border border-gray-200 object-cover"
            />
          )}
        </div>
      </div>}

      {/* ── Tab 2: Content Rules ── */}
      {activeTab === 1 && (
        <div className="p-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">{tv("contentRules.title")}</h2>
            <p className="text-sm text-gray-500">{tv("contentRules.subtitle")}</p>
            {activePlan?.ai_input_json?.template ? (
              <div className="space-y-3">
                {([
                  ["exterior_before_interior", tv("contentRules.exteriorFirst")],
                  ["engine_at_end", tv("contentRules.engineAtEnd")],
                  ["skip_weak_images", tv("contentRules.skipWeak")],
                ] as [string,string][]).map(([key,label])=>(
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${activePlan.ai_input_json.template?.[key] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {activePlan.ai_input_json.template?.[key] ? tv("enabled") : tv("disabled")}
                    </span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">{tv("contentRules.preferredOrder")}</p>
                  <div className="flex flex-wrap gap-1">
                    {(activePlan.ai_input_json.rules?.prefer_order ?? []).map((t:string, i:number) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{i+1}. {t.replace(/_/g," ")}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">{tv("contentRules.noPlan")}</p>}
          </div>
        </div>
      )}

      {/* ── Tab 3: Audio & Branding ── */}
      {activeTab === 2 && (
        <div className="p-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">{tv("audio.title")}</h2>
            {activePlan?.final_plan_json?.audio ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("audio.musicProfile")}</span>
                  <span className="text-sm font-semibold text-gray-900">{activePlan.final_plan_json.audio.music_profile ?? "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("audio.musicVolume")}</span>
                  <span className="text-sm font-semibold text-gray-900">{typeof activePlan.final_plan_json.audio.music_volume === "number" ? `${Math.round(activePlan.final_plan_json.audio.music_volume * 100)}%` : "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("audio.ducking")}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${activePlan.final_plan_json.audio.ducking ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {activePlan.final_plan_json.audio.ducking ? tv("enabled") : tv("disabled")}
                  </span>
                </div>

                {/* Shared audio element for library playback */}
                <audio
                  ref={audioRef}
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    setAudioDur(isFinite(el.duration) ? el.duration : 0);
                    setAudioPos(isFinite(el.currentTime) ? el.currentTime : 0);
                  }}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    setAudioPos(isFinite(el.currentTime) ? el.currentTime : 0);
                  }}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onEnded={() => setAudioPlaying(false)}
                />

                {/* Music library (like NauticSecure) */}
                {musicTracks.length ? (
                  <div className="pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">Music Library ({musicTracks.length} tracks)</h3>
                    </div>
                    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
                      {musicTracks.map((tr) => {
                        const isActive = activeTrack === tr.slug;
                        return (
                          <div key={tr.slug} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white">
                            <button
                              type="button"
                              onClick={async () => {
                                const el = audioRef.current;
                                // Reuse the same audio element for library preview
                                setActiveTrack(tr.slug);
                                if (!el) return;
                                const nextSrc = `${apiOrigin()}/api/video/music-tracks/${tr.slug}/stream`;
                                if (el.src !== nextSrc) {
                                  el.src = nextSrc;
                                  el.load();
                                }
                                if (el.paused) await el.play();
                                else el.pause();
                              }}
                              className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 flex items-center justify-center"
                              title={isActive && audioPlaying ? "Pause" : "Play"}
                            >
                              {isActive && audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-900 truncate">{tr.name}</div>
                              {isActive ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="w-[120px] shrink-0 text-[11px] font-medium text-gray-600 tabular-nums text-right">
                                    {formatTime(audioPos)} / {formatTime(audioDur || 0)}
                                  </span>
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
                                    aria-label="Track seek"
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <p className="text-xs text-gray-400 pt-2">{tv("audio.editHint")} <button onClick={()=>router.push(`/${locale}/dashboard/${role}/video-templates`)} className="text-blue-600 hover:underline">{tv("audio.videoTemplates")}</button>.</p>
              </div>
            ) : <p className="text-sm text-gray-400">{tv("audio.noPlan")}</p>}
          </div>
        </div>
      )}

      {/* ── Tab 4: Intro & Outro ── */}
      {activeTab === 3 && (
        <div className="p-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-bold text-gray-900">{tv("introOutro.title")}</h2>
            {activePlan?.final_plan_json ? (
              <>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-2">{tv("introOutro.intro")}</p>
                  <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.type")}</span><span className="font-semibold">{activePlan.final_plan_json.intro?.type ?? "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.introTitle")}</span><span className="font-semibold">{activePlan.final_plan_json.intro?.title ?? "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.subtitle2")}</span><span className="font-semibold text-right max-w-xs">{activePlan.final_plan_json.intro?.subtitle ?? "—"}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-2">{tv("introOutro.outro")}</p>
                  <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.ctaText")}</span><span className="font-semibold">{activePlan.final_plan_json.outro?.cta_text ?? activePlan.final_plan_json.outro?.text ?? "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.showLogo")}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activePlan.final_plan_json.outro?.show_logo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{activePlan.final_plan_json.outro?.show_logo ? tv("yes") : tv("no")}</span></div>
                    {activePlan.final_plan_json.outro?.website_url && <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.website")}</span><span className="font-semibold text-blue-600">{activePlan.final_plan_json.outro.website_url}</span></div>}
                    {activePlan.final_plan_json.outro?.whatsapp_url && <div className="flex justify-between text-sm"><span className="text-gray-600">{tv("introOutro.whatsapp")}</span><span className="font-semibold text-green-600">{activePlan.final_plan_json.outro.whatsapp_url}</span></div>}
                  </div>
                </div>
              </>
            ) : <p className="text-sm text-gray-400">{tv("introOutro.noPlan")}</p>}
          </div>
        </div>
      )}

      {/* ── Tab 5: AI Plan Preview ── */}
      {activeTab === 4 && (
        <div className="p-5">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">{tv("aiPlanPreview.title")}</h2>
            {activePlan?.ai_output_json ? (
              <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200">
                {JSON.stringify(activePlan.ai_output_json, null, 2)}
              </pre>
            ) : <p className="text-sm text-gray-400">{tv("aiPlanPreview.noPlan")}</p>}
          </div>
        </div>
      )}

      {/* ── Tab 6: Review & Render ── */}
      {activeTab === 5 && (
        <div className="p-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-bold text-gray-900">{tv("reviewRender.title")}</h2>
            {activePlan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("reviewRender.plan")}</span>
                  <span className="text-sm font-semibold">#{activePlan.id} · {activePlan.variation}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("reviewRender.status")}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    activePlan.status==="rendered"?"bg-green-100 text-green-700":
                    activePlan.status==="approved"?"bg-emerald-100 text-emerald-700":
                    activePlan.status==="rendering"?"bg-amber-100 text-amber-700":
                    activePlan.status==="failed"?"bg-red-100 text-red-700":
                    "bg-blue-100 text-blue-700"}`}>{activePlan.status}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("reviewRender.scenes")}</span>
                  <span className="text-sm font-semibold">{activePlan.final_plan_json?.scenes?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-700">{tv("reviewRender.estimatedDuration")}</span>
                  <span className="text-sm font-semibold">{totalDuration(activePlan)}</span>
                </div>
                {activePlan.render_output_url && (
                  <div className="pt-2">
                    <video
                      src={normalizeMediaUrl(activePlan.render_output_url)}
                      controls
                      className="w-full rounded-lg border border-gray-200"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  {activePlan.status === "ai_generated" && (
                    <button onClick={handleApprove} disabled={approvingPlan}
                      className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      {approvingPlan ? <Loader2 size={14} className="animate-spin"/> : null} {tv("approvePlan")}
                    </button>
                  )}
                  {activePlan.status === "approved" && (
                    <button onClick={handleRender} disabled={renderingPlan}
                      className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      {renderingPlan ? <Loader2 size={14} className="animate-spin"/> : null} {tv("renderFinalVideo")}
                    </button>
                  )}
                  {activePlan.render_output_url && (
                    <a href={normalizeMediaUrl(activePlan.render_output_url)} target="_blank" rel="noopener noreferrer"
                      className="flex-1 border border-blue-600 text-blue-600 rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-50 flex items-center justify-center gap-2">
                      <Play size={14}/> {tv("reviewRender.watchVideo")}
                    </a>
                  )}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">{tv("reviewRender.noPlan")}</p>}
          </div>
        </div>
      )}

      {/* ── Scene Table + Detail Panel ── */}
      {activeTab === 0 && activePlan?.final_plan_json?.scenes && (
        <div className="px-5 pb-6 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

          {/* Scene Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold flex items-center gap-2">{tv("sceneTable.title")} <Sparkles size={14} className="text-orange-400"/></h2>
                <p className="text-xs text-gray-500">{tv("sceneTable.subtitle")}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveScenes} disabled={savingScenes}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                  {savingScenes?<Loader2 size={12} className="animate-spin"/>:null}{savingScenes?tv("saving"):tv("saveChanges")}
                </button>
                <button onClick={()=>activePlan&&handleDelete(activePlan.id)} disabled={deletingPlan===activePlan?.id}
                  className="text-xs border border-red-300 text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1">
                  {deletingPlan===activePlan?.id?<Loader2 size={12} className="animate-spin"/>:<Trash2 size={12}/>}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="pb-2 w-4"></th>
                    <th className="pb-2 pr-2 w-6">#</th>
                    <th className="pb-2 pr-3 w-20">{tv("sceneTable.preview")}</th>
                    <th className="pb-2 pr-3">{tv("sceneTable.sceneType")}</th>
                    <th className="pb-2 pr-3">{tv("table.duration")}</th>
                    <th className="pb-2 pr-3">{tv("table.transition")}</th>
                    <th className="pb-2 pr-3">{tv("table.motion")}</th>
                    <th className="pb-2 pr-3">{tv("sceneTable.overlayText")}</th>
                    <th className="pb-2 w-16">{tv("table.include")}</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {editingScenes.map((scene,i)=>{
                    const img = imageMap[scene.image_id];
                    const isSelected = selectedSceneIdx===i;
                    return (
                      <tr key={i} onClick={()=>setSelectedSceneIdx(i)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected?"bg-blue-50":"hover:bg-gray-50"} ${scene.exclude?"opacity-40":""}`}>
                        <td className="py-2 pr-1 text-gray-300"><GripVertical size={14}/></td>
                        <td className="py-2 pr-2 text-gray-400 text-xs">{i+1}</td>
                        <td className="py-2 pr-3">
                          {img?.full_url
                            ? (
                              <Image
                                src={img.full_url}
                                width={64}
                                height={40}
                                unoptimized
                                alt=""
                                className="w-16 h-10 object-cover rounded-md"
                              />
                            )
                            : <div className="w-16 h-10 bg-gray-200 rounded-md"/>}
                        </td>
                        <td className="py-2 pr-3 font-medium">{SCENE_LABEL[scene.scene_type]??scene.scene_type}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                            <input type="number" step="0.5" min="0.5" max="15"
                              className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-xs"
                              value={scene.duration} onChange={e=>updateScene(i,"duration",parseFloat(e.target.value))}/>
                            <span className="text-xs text-gray-400">sec</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3" onClick={e=>e.stopPropagation()}>
                          <select className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white"
                            value={scene.transition_in} onChange={e=>updateScene(i,"transition_in",e.target.value)}>
                            {TRANSITIONS.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-600">{MOTION_LABELS[scene.motion?.style??""]??scene.motion?.style??(scene.motion?.enabled===false?"None":"—")}</td>
                        <td className="py-2 pr-3 max-w-[160px]">
                          <p className="text-xs text-gray-900 truncate">{scene.overlay?.headline??"—"}</p>
                          {scene.overlay?.subline&&<p className="text-xs text-gray-400 truncate">{scene.overlay.subline}</p>}
                        </td>
                        <td className="py-2" onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>updateScene(i,"exclude",!scene.exclude)}
                            className={`w-9 h-5 rounded-full transition-colors ${!scene.exclude?"bg-blue-600":"bg-gray-300"} relative`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${!scene.exclude?"translate-x-4":"translate-x-0"}`}/>
                          </button>
                        </td>
                        <td className="py-2 relative" onClick={e=>e.stopPropagation()}>
                          <button onClick={e=>{e.stopPropagation();setOpenRowMenu(openRowMenu===i?null:i);}} className="text-gray-400 hover:text-gray-600 p-1">
                            <MoreVertical size={14}/>
                          </button>
                          {openRowMenu===i && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-32">
                              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50" onClick={()=>{updateScene(i,"exclude",true);setOpenRowMenu(null);}}>{tv("sceneTable.excludeScene")}</button>
                              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-red-500" onClick={()=>{setEditingScenes(p=>p.filter((_,idx)=>idx!==i));setOpenRowMenu(null);}}>{tv("sceneTable.remove")}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scene Detail Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{tv("sceneDetail.title")}</h2>
              <Sparkles size={14} className="text-orange-400"/>
            </div>
            {selectedScene ? (
              <>
                <p className="text-xs text-gray-500">{tv("sceneDetail.subtitle")}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.sceneType")}</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      value={selectedScene.scene_type} onChange={e=>updateScene(selectedSceneIdx!,"scene_type",e.target.value)}>
                      {SCENE_TYPES.map(t=><option key={t} value={t}>{SCENE_LABEL[t]??t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.duration")}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" step="0.5" min="0.5" max="15"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={selectedScene.duration} onChange={e=>updateScene(selectedSceneIdx!,"duration",parseFloat(e.target.value))}/>
                      <span className="text-sm text-gray-400">sec</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.transition")} In</label>
                      <select className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
                        value={selectedScene.transition_in} onChange={e=>updateScene(selectedSceneIdx!,"transition_in",e.target.value)}>
                        {TRANSITIONS.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.transition")} Out</label>
                      <select className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
                        value={selectedScene.transition_out??selectedScene.transition_in} onChange={e=>updateScene(selectedSceneIdx!,"transition_out",e.target.value)}>
                        {TRANSITIONS.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.motion")}</label>
                    <select className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
                      value={selectedScene.motion?.style??"static"} onChange={e=>updateScene(selectedSceneIdx!,"motion.style",e.target.value)}>
                      {MOTIONS.map(m=><option key={m} value={m}>{MOTION_LABELS[m]??m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">{tv("sceneDetail.overlayText")}</label>
                    <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                      value={[selectedScene.overlay?.headline,selectedScene.overlay?.subline].filter(Boolean).join("\n")}
                      onChange={e=>{
                        const [headline,...rest]=e.target.value.split("\n");
                        updateScene(selectedSceneIdx!,"overlay.headline",headline);
                        updateScene(selectedSceneIdx!,"overlay.subline",rest.join(" "));
                      }}/>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedScene.overlay?.enabled??false}
                      onChange={e=>updateScene(selectedSceneIdx!,"overlay.enabled",e.target.checked)} className="rounded"/>
                    {tv("sceneDetail.showOverlay")}
                  </label>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">{tv("sceneDetail.clickHint")}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 0 && plans.length===0 && (
        <div className="px-5 pb-6">
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <Sparkles size={32} className="text-gray-300 mx-auto mb-3"/>
            <p className="text-gray-500 text-sm">{tv("noPlans")}</p>
            <p className="text-gray-400 text-xs mt-1">{tv("noPlansHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
