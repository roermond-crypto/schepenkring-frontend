"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "@/shims/next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    ExternalLink,
    Loader2,
    RefreshCw,
    RotateCcw,
    Sparkles,
    Video,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface SocialVideo {
    id: number;
    boat_id?: number | null;
    yacht_id?: number | null;
    video_url?: string | null;
    thumbnail_url?: string | null;
    duration?: number | null;
    status?: string | null;
    template_type?: string | null;
    generation_trigger?: string | null;
    whatsapp_status?: string | null;
    whatsapp_sent_at?: string | null;
    whatsapp_message_id?: string | null;
    whatsapp_recipient?: string | null;
    whatsapp_error?: string | null;
    created_at?: string | null;
}

interface VideoPost {
    id: number;
    video_id?: number | null;
    yext_post_id?: string | null;
    publishers?: string[] | string | null;
    scheduled_at?: string | null;
    published_at?: string | null;
    status?: string | null;
    views?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    engagement?: number | null;
    error_message?: string | null;
    last_synced_at?: string | null;
}

type ScheduleForm = {
    start_date: string;
    cadence: "daily";
    time: string;
    publishers: string[];
    skip_weekends: boolean;
};

const PUBLISHER_OPTIONS = [
    "facebook",
    "instagram",
    "google",
    "linkedin",
    "apple",
];

function normalizeList<T>(payload: unknown, keys: string[]): T[] {
    if (Array.isArray(payload)) return payload as T[];

    const payloadObject = payload as
        | { data?: unknown; [key: string]: unknown }
        | undefined;
    if (Array.isArray(payloadObject?.data)) return payloadObject.data as T[];

    for (const key of keys) {
        if (Array.isArray(payloadObject?.[key])) {
            return payloadObject[key] as T[];
        }
        const nestedData = payloadObject?.data as
            | { [key: string]: unknown }
            | undefined;
        if (Array.isArray(nestedData?.[key])) {
            return nestedData[key] as T[];
        }
    }

    return [];
}

function formatDateTime(value: string | null | undefined, locale: string) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatMetric(value: number | null | undefined) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return Intl.NumberFormat().format(Number(value));
}

function isVideoGeneratingStatus(status: string | null | undefined) {
    return ["queued", "processing", "pending", "rendering"].includes(
        String(status || "").toLowerCase(),
    );
}

function parsePublishers(value: VideoPost["publishers"]) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
        }
    }
    return [];
}

export default function AdminSocialAutomationPage() {
    const t = useTranslations("DashboardAdminSocial");
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [videos, setVideos] = useState<SocialVideo[]>([]);
    const [posts, setPosts] = useState<VideoPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"videos" | "posts">("videos");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);
    const [reschedulePostId, setReschedulePostId] = useState<number | null>(null);
    const [rescheduleValue, setRescheduleValue] = useState("");
    const [previewVideoId, setPreviewVideoId] = useState<number | null>(null);
    const lastLoadKeyRef = useRef<string | null>(null);
    const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() => ({
        start_date: new Date().toISOString().slice(0, 10),
        cadence: "daily",
        time: "10:30",
        publishers: ["facebook", "instagram"],
        skip_weekends: false,
    }));
    const filteredYachtId = useMemo(() => {
        const rawValue = searchParams.get("yacht_id");
        if (!rawValue || !/^\d+$/.test(rawValue)) return null;

        return Number(rawValue);
    }, [searchParams]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [videosRes, postsRes] = await Promise.all([
                api.get("/social/videos", {
                    params: filteredYachtId ? { yacht_id: filteredYachtId } : undefined,
                }),
                api.get("/social/posts"),
            ]);

            const nextVideos = normalizeList<SocialVideo>(videosRes.data, [
                "videos",
                "items",
            ]).sort(
                (left, right) =>
                    new Date(right.created_at || 0).getTime() -
                    new Date(left.created_at || 0).getTime(),
            );
            const nextPosts = normalizeList<VideoPost>(postsRes.data, [
                "posts",
                "items",
            ]);

            setVideos(nextVideos);
            setPosts(nextPosts);
            setSelectedVideoIds((current) =>
                current.filter((id) => nextVideos.some((video) => video.id === id)),
            );
        } catch {
            setError("Could not load social automation data.");
        } finally {
            setLoading(false);
        }
    }, [filteredYachtId]);

    useEffect(() => {
        const nextLoadKey = `${filteredYachtId ?? "all"}:${activeTab}`;
        if (lastLoadKeyRef.current === nextLoadKey) return;

        lastLoadKeyRef.current = nextLoadKey;
        void loadData();
    }, [activeTab, filteredYachtId, loadData]);

    const readyVideos = useMemo(
        () =>
            videos.filter((video) =>
                ["ready", "scheduled"].includes((video.status || "").toLowerCase()),
            ),
        [videos],
    );
    const hasGeneratingVideos = useMemo(
        () => videos.some((video) => isVideoGeneratingStatus(video.status)),
        [videos],
    );

    useEffect(() => {
        if (!hasGeneratingVideos) return;

        const timer = window.setInterval(() => {
            void loadData();
        }, 8000);

        return () => window.clearInterval(timer);
    }, [hasGeneratingVideos, loadData]);

    const stats = useMemo(() => {
        const scheduled = posts.filter(
            (post) => (post.status || "").toLowerCase() === "scheduled",
        ).length;
        const published = posts.filter(
            (post) => (post.status || "").toLowerCase() === "published",
        ).length;
        const failed = posts.filter((post) =>
            (post.status || "").toLowerCase().includes("fail"),
        ).length;
        const impressions = posts.reduce(
            (sum, post) => sum + Number(post.impressions || 0),
            0,
        );

        return {
            videos: videos.length,
            scheduled,
            published,
            failed,
            impressions,
        };
    }, [posts, videos]);

    const handleToggleVideo = (videoId: number) => {
        setSelectedVideoIds((current) =>
            current.includes(videoId)
                ? current.filter((id) => id !== videoId)
                : [...current, videoId],
        );
    };

    const handleSchedule = async () => {
        if (selectedVideoIds.length === 0) {
            toast.error(t("errors.selectVideos"));
            return;
        }

        setActionLoading("schedule");
        try {
            await api.post("/social/schedule", {
                start_date: scheduleForm.start_date,
                cadence: scheduleForm.cadence,
                time: scheduleForm.time,
                video_ids: selectedVideoIds,
                publishers: scheduleForm.publishers,
                skip_weekends: scheduleForm.skip_weekends,
            });
            toast.success(t("toasts.scheduleCreated"));
            await loadData();
            setSelectedVideoIds([]);
        } catch {
            toast.error(t("errors.scheduleFailed"));
        } finally {
            setActionLoading(null);
        }
    };

    const handleRegenerate = async (videoId: number) => {
        setActionLoading(`video-${videoId}`);
        try {
            await api.post(`/social/videos/${videoId}/regenerate`);
            toast.success(t("toasts.videoQueued"));
            await loadData();
        } catch {
            toast.error(t("errors.regenerateFailed"));
        } finally {
            setActionLoading(null);
        }
    };

    const handleNotifyOwner = async (videoId: number) => {
        setActionLoading(`notify-${videoId}`);
        try {
            await api.post(`/social/videos/${videoId}/notify-owner`, {
                force: true,
            });
            toast.success("Owner WhatsApp delivery queued.");
            await loadData();
        } catch {
            toast.error("Could not queue owner WhatsApp delivery.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRetry = async (postId: number) => {
        setActionLoading(`post-${postId}`);
        try {
            await api.post(`/social/posts/${postId}/retry`);
            toast.success(t("toasts.retryQueued"));
            await loadData();
        } catch {
            toast.error(t("errors.retryFailed"));
        } finally {
            setActionLoading(null);
        }
    };

    const handleReschedule = async () => {
        if (!reschedulePostId || !rescheduleValue) {
            toast.error(t("errors.invalidReschedule"));
            return;
        }

        setActionLoading(`reschedule-${reschedulePostId}`);
        try {
            await api.patch(`/social/posts/${reschedulePostId}/reschedule`, {
                scheduled_at: new Date(rescheduleValue).toISOString(),
            });
            toast.success(t("toasts.rescheduled"));
            setReschedulePostId(null);
            setRescheduleValue("");
            await loadData();
        } catch {
            toast.error(t("errors.rescheduleFailed"));
        } finally {
            setActionLoading(null);
        }
    };

    const statusClass = (value?: string | null) => {
        const status = (value || "").toLowerCase();
        if (status.includes("publish")) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
        if (status.includes("sched")) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
        if (status.includes("fail")) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
        if (status.includes("ready")) return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900";
        return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    };

    return (
        <div className="social-admin-page space-y-8">
            <Toaster position="top-center" />

            <div className="social-hero relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#EAF3FF] px-6 py-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:px-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />

                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.38em] text-blue-600">
                            {t("subtitle")}
                        </p>
                        <h1 className="mt-3 text-4xl font-serif italic text-[#003566] sm:text-5xl">
                            {t("title")}
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm text-slate-500">
                            {t("description")}
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
                    >
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {t("actions.refresh")}
                    </Button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            {t("stats.videos")}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">{stats.videos}</p>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            {t("stats.scheduled")}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">{stats.scheduled}</p>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            {t("stats.published")}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">{stats.published}</p>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            {t("stats.impressions")}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[#0B1F3A]">
                            {formatMetric(stats.impressions)}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[#003566]">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {t("scheduler.label")}
                            </p>
                            <h2 className="mt-1 text-2xl font-serif italic text-[#003566]">
                                {t("scheduler.title")}
                            </h2>
                        </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-500">{t("scheduler.description")}</p>

                    <div className="mt-6 space-y-4">
                        <label className="block space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {t("scheduler.startDate")}
                            </span>
                            <input
                                type="date"
                                value={scheduleForm.start_date}
                                onChange={(e) =>
                                    setScheduleForm((current) => ({
                                        ...current,
                                        start_date: e.target.value,
                                    }))
                                }
                                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
                            />
                        </label>

                        <label className="block space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {t("scheduler.time")}
                            </span>
                            <input
                                type="time"
                                value={scheduleForm.time}
                                onChange={(e) =>
                                    setScheduleForm((current) => ({
                                        ...current,
                                        time: e.target.value,
                                    }))
                                }
                                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
                            />
                        </label>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {t("scheduler.publishers")}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {PUBLISHER_OPTIONS.map((publisher) => {
                                    const checked = scheduleForm.publishers.includes(publisher);
                                    return (
                                        <label
                                            key={publisher}
                                            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors ${checked
                                                    ? "border-[#003566] bg-blue-50 text-[#003566]"
                                                    : "border-slate-200 bg-white text-slate-600"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    setScheduleForm((current) => ({
                                                        ...current,
                                                        publishers: checked
                                                            ? current.publishers.filter((item) => item !== publisher)
                                                            : [...current.publishers, publisher],
                                                    }))
                                                }
                                                className="rounded border-slate-300"
                                            />
                                            <span className="capitalize">{publisher}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={scheduleForm.skip_weekends}
                                onChange={(e) =>
                                    setScheduleForm((current) => ({
                                        ...current,
                                        skip_weekends: e.target.checked,
                                    }))
                                }
                                className="mt-0.5 rounded border-slate-300"
                            />
                            <span>{t("scheduler.skipWeekends")}</span>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                    {t("scheduler.selectedVideos")}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSelectedVideoIds(readyVideos.map((video) => video.id))}
                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003566]"
                                >
                                    {t("scheduler.useAllReady")}
                                </button>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                                {selectedVideoIds.length} {t("scheduler.videosChosen")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {readyVideos.length} {t("scheduler.readyAvailable")}
                            </p>
                        </div>

                        <Button
                            type="button"
                            onClick={handleSchedule}
                            disabled={actionLoading === "schedule" || selectedVideoIds.length === 0}
                            className="h-12 w-full rounded-2xl bg-[#003566] text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
                        >
                            {actionLoading === "schedule" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            {t("actions.schedule")}
                        </Button>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {t("library.label")}
                            </p>
                            <h2 className="mt-1 text-2xl font-serif italic text-[#003566]">
                                {activeTab === "videos" ? t("library.videos") : t("library.posts")}
                            </h2>
                            {filteredYachtId ? (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                                        Boat #{filteredYachtId}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => router.replace(pathname)}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003566]"
                                    >
                                        Show all boats
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("videos")}
                                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === "videos"
                                        ? "bg-[#0B1F3A] text-white"
                                        : "text-slate-500"
                                    }`}
                            >
                                {t("library.videos")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("posts")}
                                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === "posts"
                                        ? "bg-[#0B1F3A] text-white"
                                        : "text-slate-500"
                                    }`}
                            >
                                {t("library.posts")}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-[#003566]" />
                        </div>
                    ) : activeTab === "videos" ? (
                        videos.length === 0 ? (
                            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slate-500">
                                {t("empty.videos")}
                            </div>
                        ) : (
                            <div className="mt-6 space-y-4">
                                {videos.map((video) => {
                                    const checked = selectedVideoIds.includes(video.id);
                                    return (
                                        <div
                                            key={video.id}
                                            className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="flex min-w-0 items-start gap-4">
                                                    <label className="pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => handleToggleVideo(video.id)}
                                                            className="rounded border-slate-300"
                                                        />
                                                    </label>
                                                    <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                                        {video.thumbnail_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={video.thumbnail_url}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                                <Video size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-bold text-slate-900">
                                                                {t("videoCard.video")} #{video.id}
                                                            </p>
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${statusClass(
                                                                    video.status,
                                                                )}`}
                                                            >
                                                                {video.status || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                                                            <p>
                                                                {t("videoCard.boat")} #{video.boat_id || video.yacht_id || "—"}
                                                            </p>
                                                            <p>
                                                                {t("videoCard.duration")}{" "}
                                                                {video.duration ? `${video.duration}s` : "—"}
                                                            </p>
                                                            <p>
                                                                {t("videoCard.template")} {video.template_type || "—"}
                                                            </p>
                                                            <p>
                                                                {t("videoCard.created")}{" "}
                                                                {formatDateTime(video.created_at, locale)}
                                                            </p>
                                                            <p>
                                                                Trigger {video.generation_trigger || "—"}
                                                            </p>
                                                            <p>
                                                                WhatsApp {video.whatsapp_status || "—"}
                                                            </p>
                                                        </div>
                                                        {(video.whatsapp_recipient || video.whatsapp_sent_at || video.whatsapp_error) && (
                                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                                                                {video.whatsapp_recipient ? (
                                                                    <p>Recipient: {video.whatsapp_recipient}</p>
                                                                ) : null}
                                                                {video.whatsapp_sent_at ? (
                                                                    <p>
                                                                        Sent: {formatDateTime(video.whatsapp_sent_at, locale)}
                                                                    </p>
                                                                ) : null}
                                                                {video.whatsapp_message_id ? (
                                                                    <p>Message ID: {video.whatsapp_message_id}</p>
                                                                ) : null}
                                                                {video.whatsapp_error ? (
                                                                    <p className="text-red-600">Error: {video.whatsapp_error}</p>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {video.video_url && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setPreviewVideoId((current) =>
                                                                    current === video.id ? null : video.id,
                                                                )
                                                            }
                                                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566]"
                                                        >
                                                            <Video className="mr-2 h-3.5 w-3.5" />
                                                            Watch Video
                                                        </button>
                                                    )}
                                                    {video.video_url && (
                                                        <a
                                                            href={video.video_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566]"
                                                        >
                                                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                                            {t("actions.open")}
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleNotifyOwner(video.id)}
                                                        disabled={actionLoading === `notify-${video.id}` || !video.video_url}
                                                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {actionLoading === `notify-${video.id}` ? (
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                                                        )}
                                                        Send WhatsApp
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRegenerate(video.id)}
                                                        disabled={actionLoading === `video-${video.id}`}
                                                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#003566] px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                                    >
                                                        {actionLoading === `video-${video.id}` ? (
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                                        )}
                                                        {t("actions.regenerate")}
                                                    </button>
                                                </div>
                                            </div>
                                            {previewVideoId === video.id && video.video_url ? (
                                                <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-black">
                                                    <video
                                                        src={video.video_url}
                                                        controls
                                                        preload="metadata"
                                                        className="h-auto max-h-[28rem] w-full"
                                                        poster={video.thumbnail_url || undefined}
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : posts.length === 0 ? (
                        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slate-500">
                            {t("empty.posts")}
                        </div>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {posts.map((post) => {
                                const publishers = parsePublishers(post.publishers);
                                const isRescheduling = reschedulePostId === post.id;
                                return (
                                    <div
                                        key={post.id}
                                        className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {t("postCard.post")} #{post.id}
                                                    </p>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${statusClass(
                                                            post.status,
                                                        )}`}
                                                    >
                                                        {post.status || "—"}
                                                    </span>
                                                </div>
                                                <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                                                    <p>{t("postCard.video")} #{post.video_id || "—"}</p>
                                                    <p>
                                                        {t("postCard.publishers")}{" "}
                                                        {publishers.length > 0 ? publishers.join(", ") : "—"}
                                                    </p>
                                                    <p>
                                                        {t("postCard.scheduled")}{" "}
                                                        {formatDateTime(post.scheduled_at, locale)}
                                                    </p>
                                                    <p>
                                                        {t("postCard.published")}{" "}
                                                        {formatDateTime(post.published_at, locale)}
                                                    </p>
                                                    <p>
                                                        {t("postCard.impressions")} {formatMetric(post.impressions)}
                                                    </p>
                                                    <p>{t("postCard.clicks")} {formatMetric(post.clicks)}</p>
                                                </div>
                                                {post.error_message && (
                                                    <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                                        {post.error_message}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReschedulePostId(post.id);
                                                        setRescheduleValue(
                                                            post.scheduled_at
                                                                ? new Date(post.scheduled_at)
                                                                    .toISOString()
                                                                    .slice(0, 16)
                                                                : "",
                                                        );
                                                    }}
                                                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566]"
                                                >
                                                    <Calendar className="mr-2 h-3.5 w-3.5" />
                                                    {t("actions.reschedule")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRetry(post.id)}
                                                    disabled={actionLoading === `post-${post.id}`}
                                                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#003566] px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                                >
                                                    {actionLoading === `post-${post.id}` ? (
                                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                                    )}
                                                    {t("actions.retry")}
                                                </button>
                                            </div>
                                        </div>

                                        {isRescheduling && (
                                            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center">
                                                <input
                                                    type="datetime-local"
                                                    value={rescheduleValue}
                                                    onChange={(e) => setRescheduleValue(e.target.value)}
                                                    className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReschedulePostId(null);
                                                            setRescheduleValue("");
                                                        }}
                                                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600"
                                                    >
                                                        {t("actions.cancel")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleReschedule}
                                                        disabled={actionLoading === `reschedule-${post.id}`}
                                                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#003566] px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                                    >
                                                        {actionLoading === `reschedule-${post.id}` ? (
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                                        )}
                                                        {t("actions.saveReschedule")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        <style jsx global>{`
          .dark .social-admin-page {
            color: rgb(226 232 240);
          }

          .dark .social-admin-page .social-hero {
            background: linear-gradient(
              135deg,
              rgb(2 6 23) 0%,
              rgb(15 23 42) 55%,
              rgb(30 41 59) 100%
            ) !important;
          }

          .dark .social-admin-page .text-slate-900 {
            color: rgb(241 245 249) !important;
          }

          .dark .social-admin-page .text-slate-600,
          .dark .social-admin-page .text-slate-500,
          .dark .social-admin-page .text-slate-400 {
            color: rgb(148 163 184) !important;
          }

          .dark .social-admin-page .border-slate-200,
          .dark .social-admin-page [class*="border-white/80"] {
            border-color: rgb(51 65 85) !important;
          }

          .dark .social-admin-page .bg-white,
          .dark .social-admin-page [class*="bg-white/85"],
          .dark .social-admin-page .bg-blue-50,
          .dark .social-admin-page .bg-red-50,
          .dark .social-admin-page .bg-emerald-50,
          .dark .social-admin-page .bg-cyan-50,
          .dark .social-admin-page .bg-slate-50,
          .dark .social-admin-page [class*="bg-slate-50/50"],
          .dark .social-admin-page [class*="bg-slate-50/70"] {
            background: rgb(15 23 42) !important;
          }

          .dark .social-admin-page input,
          .dark .social-admin-page select {
            background: rgb(2 6 23) !important;
            color: rgb(226 232 240) !important;
            border-color: rgb(51 65 85) !important;
          }
        `}</style>
        </div>
    );
}
