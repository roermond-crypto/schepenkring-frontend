"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface PipelineImage {
    id: number;
    yacht_id: number;
    url: string;
    client_preview_url?: string | null;
    original_temp_url: string | null;
    optimized_master_url: string | null;
    thumb_url: string | null;
    original_kept_url: string | null;
    status: "processing" | "ready_for_review" | "approved" | "deleted" | "processing_failed";
    keep_original: boolean;
    quality_score: number | null;
    quality_flags: {
        too_dark?: boolean;
        too_bright?: boolean;
        blurry?: boolean;
        low_res?: boolean;
        ai_rotation_angle?: number;
        ai_adjustments?: string[];
        ai_category_source?: string;
    } | null;
    quality_label: string;
    category: string;
    original_name: string | null;
    sort_order: number;
    optimized_url: string;
    thumb_full_url: string;
    full_url: string;
    enhancement_method: "cloudinary" | "local" | "local_fallback" | "none" | "pending" | null;
    created_at: string;
    updated_at: string;
}

export interface PipelineStats {
    total: number;
    approved: number;
    processing: number;
    ready: number;
    min_required: number;
}

interface UseImagePipelineReturn {
    images: PipelineImage[];
    stats: PipelineStats;
    isStep2Unlocked: boolean;
    isProcessing: boolean;
    isUploading: boolean;
    isLoading: boolean;
    uploadImages: (files: File[]) => Promise<void>;
    approveImage: (imageId: number) => Promise<void>;
    deleteImage: (imageId: number) => Promise<void>;
    deleteImages: (imageIds: number[]) => Promise<{ deleted: number; failed: number }>;
    toggleKeepOriginal: (imageId: number) => Promise<void>;
    reorderImages: (imageIds: number[]) => Promise<void>;
    autoClassifyImages: () => Promise<PipelineImage[]>;
    approveAll: () => Promise<{ step2_unlocked: boolean }>;
    refreshImages: () => Promise<void>;
    setImagesDirectly?: (data: { images: PipelineImage[]; stats: PipelineStats; step2_unlocked: boolean }) => void;
}

const POLL_INTERVAL = 5000;

export function useImagePipeline(
    yachtId: string | number | null,
    options: { pausePolling?: boolean } = {}
): UseImagePipelineReturn {
    const { pausePolling = false } = options;
    const [images, setImages] = useState<PipelineImage[]>([]);
    const [stats, setStats] = useState<PipelineStats>({
        total: 0,
        approved: 0,
        processing: 0,
        ready: 0,
        min_required: 1,
    });
    const [isStep2Unlocked, setIsStep2Unlocked] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Each refreshImages() call cancels the previous in-flight request via this
    // ref. Only the most recently dispatched GET ever commits its response,
    // which prevents stale responses (e.g. the initial mount GET) from wiping
    // images that were just uploaded.
    const refreshAbortRef = useRef<AbortController | null>(null);

    const isProcessing = stats.processing > 0;

    const refreshImages = useCallback(async () => {
        if (!yachtId || yachtId === "new") return;

        // Cancel any in-flight request — only the latest response should commit.
        if (refreshAbortRef.current) {
            refreshAbortRef.current.abort();
        }
        const controller = new AbortController();
        refreshAbortRef.current = controller;

        try {
            const res = await api.get(`/yachts/${yachtId}/images`, {
                signal: controller.signal,
            });
            const data = res.data;
            setImages(data.images || []);
            setStats(data.stats || { total: 0, approved: 0, processing: 0, ready: 0, min_required: 1 });
            setIsStep2Unlocked(data.step2_unlocked || false);
        } catch (err: any) {
            // Axios throws ERR_CANCELED / CanceledError when an AbortController
            // aborts a request. Silence those — the newer request will commit.
            if (
                err?.code === "ERR_CANCELED" ||
                err?.name === "CanceledError" ||
                err?.name === "AbortError"
            ) {
                return;
            }
            console.error("[ImagePipeline] Failed to fetch images:", err);
        } finally {
            // Only clear the ref if we are still the active controller.
            if (refreshAbortRef.current === controller) {
                refreshAbortRef.current = null;
            }
        }
    }, [yachtId]);

    // Initial load
    useEffect(() => {
        if (yachtId && yachtId !== "new") {
            setIsLoading(true);
            refreshImages().finally(() => setIsLoading(false));
        }
    }, [yachtId, refreshImages]);

    // Auto-poll while processing
    useEffect(() => {
        if (isProcessing && yachtId && yachtId !== "new" && !pausePolling) {
            pollRef.current = setInterval(() => {
                refreshImages();
            }, POLL_INTERVAL);
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [isProcessing, yachtId, refreshImages, pausePolling]);

    // Upload images
    const uploadImages = useCallback(
        async (files: File[]) => {
            if (!yachtId || yachtId === "new") {
                console.warn("[ImagePipeline] Cannot upload — no yacht ID yet.");
                return;
            }

            setIsUploading(true);

            try {
                const formData = new FormData();
                files.forEach((file) => {
                    formData.append("images[]", file);
                });

                await api.post(`/yachts/${yachtId}/images/upload`, formData);
                await refreshImages();
            } finally {
                setIsUploading(false);
            }
        },
        [yachtId, refreshImages]
    );

    const approveImage = useCallback(
        async (imageId: number) => {
            if (!yachtId) return;
            await api.post(`/yachts/${yachtId}/images/${imageId}/approve`);
            await refreshImages();
        },
        [yachtId, refreshImages]
    );

    const deleteImage = useCallback(
        async (imageId: number) => {
            if (!yachtId) return;
            await api.post(`/yachts/${yachtId}/images/${imageId}/delete`);
            await refreshImages();
        },
        [yachtId, refreshImages]
    );

    const deleteImages = useCallback(
        async (imageIds: number[]) => {
            if (!yachtId || imageIds.length === 0) {
                return { deleted: 0, failed: 0 };
            }

            const results = await Promise.allSettled(
                imageIds.map((imageId) =>
                    api.post(`/yachts/${yachtId}/images/${imageId}/delete`)
                )
            );

            const failed = results.filter((result) => result.status === "rejected").length;
            await refreshImages();

            return {
                deleted: imageIds.length - failed,
                failed,
            };
        },
        [yachtId, refreshImages]
    );

    const toggleKeepOriginal = useCallback(
        async (imageId: number) => {
            if (!yachtId) return;
            await api.post(`/yachts/${yachtId}/images/${imageId}/toggle-keep-original`);
            await refreshImages();
        },
        [yachtId, refreshImages]
    );

    const reorderImages = useCallback(
        async (imageIds: number[]) => {
            if (!yachtId) return;
            await api.post(`/yachts/${yachtId}/images/reorder`, {
                image_ids: imageIds,
            });
            await refreshImages();
        },
        [yachtId, refreshImages]
    );

    const autoClassifyImages = useCallback(async () => {
        if (!yachtId) return [];

        const res = await api.post(`/yachts/${yachtId}/images/auto-classify`);
        const data = res.data ?? {};
        const nextImages = Array.isArray(data.images) ? data.images : [];

        if (nextImages.length > 0) {
            setImages(nextImages);
        }

        if (data.stats) {
            setStats(data.stats);
        }

        if (typeof data.step2_unlocked === "boolean") {
            setIsStep2Unlocked(data.step2_unlocked);
        }

        return nextImages;
    }, [yachtId]);

    const approveAll = useCallback(async () => {
        if (!yachtId) return { step2_unlocked: false };

        const res = await api.post(`/yachts/${yachtId}/images/approve-all`);
        await refreshImages();
        return { step2_unlocked: res.data.step2_unlocked || false };
    }, [yachtId, refreshImages]);

    // Direct state injection used for optimistic updates during upload.
    // Does NOT cancel in-flight refreshImages() requests — call refreshImages()
    // explicitly after upload completes to get the authoritative backend state.
    const setImagesDirectly = useCallback((data: { images: PipelineImage[]; stats: PipelineStats; step2_unlocked: boolean }) => {
        setImages(data.images || []);
        if (data.stats) setStats(data.stats);
        if (data.step2_unlocked !== undefined) setIsStep2Unlocked(data.step2_unlocked);
    }, []);

    return {
        images,
        stats,
        isStep2Unlocked,
        isProcessing,
        isUploading,
        isLoading,
        uploadImages,
        approveImage,
        deleteImage,
        deleteImages,
        toggleKeepOriginal,
        reorderImages,
        autoClassifyImages,
        approveAll,
        refreshImages,
        setImagesDirectly,
    };
}
