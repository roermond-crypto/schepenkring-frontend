"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    storeImage,
    loadImage,
    loadImagesByPrefix,
    deleteImagesByPrefix,
} from "./useImageStore";

// ─── Types ───────────────────────────────────────────────────────

export interface StepData {
    [key: string]: any;
}

export interface YachtDraft {
    id: string; // "new" or yacht ID
    currentStep: number;
    completedSteps: number[];
    lastSaved: string;
    data: {
        step1: StepData;
        step2: StepData;
        step3: StepData;
        step4: StepData;
        step5: StepData;
    };
    pendingSync: boolean;
}

const EMPTY_DRAFT: YachtDraft = {
    id: "new",
    currentStep: 1,
    completedSteps: [],
    lastSaved: "",
    data: {
        step1: {},
        step2: {},
        step3: {},
        step4: {},
        step5: {},
    },
    pendingSync: false,
};

// ─── Key helpers ─────────────────────────────────────────────────

function draftKey(yachtId: string) {
    return `yacht_draft_${yachtId}`;
}

function imageDraftPrefix(yachtId: string) {
    return `yacht_${yachtId}_`;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useYachtDraft(yachtId: string) {
    const [draft, setDraft] = useState<YachtDraft>({
        ...EMPTY_DRAFT,
        id: yachtId,
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── Load draft on mount ──────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem(draftKey(yachtId));
        if (stored) {
            try {
                const parsed: YachtDraft = JSON.parse(stored);
                setDraft(parsed);
            } catch {
                // corrupted data, start fresh
            }
        }
        setIsLoaded(true);
    }, [yachtId]);

    // ── Persist to localStorage ──────────────────────────────────
    const persistDraft = useCallback(
        (updated: YachtDraft) => {
            const withTimestamp = {
                ...updated,
                lastSaved: new Date().toISOString(),
                pendingSync: true,
            };
            localStorage.setItem(draftKey(yachtId), JSON.stringify(withTimestamp));
            setDraft(withTimestamp);
        },
        [yachtId]
    );

    // ── Save step data ──────────────────────────────────────────
    const saveStepData = useCallback(
        (step: number, data: StepData) => {
            setDraft((prev) => {
                const stepKey = `step${step}` as keyof YachtDraft["data"];
                const updated: YachtDraft = {
                    ...prev,
                    currentStep: step,
                    data: {
                        ...prev.data,
                        [stepKey]: { ...prev.data[stepKey], ...data },
                    },
                };
                persistDraft(updated);
                return updated;
            });
        },
        [persistDraft]
    );

    // ── Mark step as completed ──────────────────────────────────
    const markStepComplete = useCallback(
        (step: number) => {
            setDraft((prev) => {
                const completedSteps = prev.completedSteps.includes(step)
                    ? prev.completedSteps
                    : [...prev.completedSteps, step].sort();
                const updated: YachtDraft = { ...prev, completedSteps };
                persistDraft(updated);
                return updated;
            });
        },
        [persistDraft]
    );

    // ── Mark step as incomplete ─────────────────────────────────
    const markStepIncomplete = useCallback(
        (step: number) => {
            setDraft((prev) => {
                const completedSteps = prev.completedSteps.filter((s) => s !== step);
                const updated: YachtDraft = { ...prev, completedSteps };
                persistDraft(updated);
                return updated;
            });
        },
        [persistDraft]
    );

    // ── Set active step ─────────────────────────────────────────
    const setActiveStep = useCallback(
        (step: number) => {
            setDraft((prev) => {
                const updated: YachtDraft = { ...prev, currentStep: step };
                persistDraft(updated);
                return updated;
            });
        },
        [persistDraft]
    );

    // ── Get step data ───────────────────────────────────────────
    const getStepData = useCallback(
        (step: number): StepData => {
            const stepKey = `step${step}` as keyof YachtDraft["data"];
            return draft.data[stepKey] || {};
        },
        [draft]
    );

    // ── Debounced auto-save ─────────────────────────────────────
    const debouncedSave = useCallback(
        (step: number, data: StepData) => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                saveStepData(step, data);
            }, 2000);
        },
        [saveStepData]
    );

    // ── Save main image to IndexedDB ────────────────────────────
    const saveMainImage = useCallback(
        async (file: File) => {
            await storeImage(`${imageDraftPrefix(yachtId)}main`, file);
        },
        [yachtId]
    );

    // ── Load main image from IndexedDB ──────────────────────────
    const loadMainImage = useCallback(async (): Promise<File | null> => {
        return loadImage(`${imageDraftPrefix(yachtId)}main`);
    }, [yachtId]);

    // ── Save gallery image to IndexedDB ─────────────────────────
    const saveGalleryImage = useCallback(
        async (category: string, index: number, file: File) => {
            await storeImage(
                `${imageDraftPrefix(yachtId)}gallery_${category}_${index}`,
                file
            );
        },
        [yachtId]
    );

    // ── Load gallery images from IndexedDB ──────────────────────
    const loadGalleryImages = useCallback(
        async (category: string) => {
            return loadImagesByPrefix(
                `${imageDraftPrefix(yachtId)}gallery_${category}_`
            );
        },
        [yachtId]
    );

    // ── Clear draft (after successful submit) ───────────────────
    const clearDraft = useCallback(async () => {
        localStorage.removeItem(draftKey(yachtId));
        await deleteImagesByPrefix(imageDraftPrefix(yachtId));
        setDraft({ ...EMPTY_DRAFT, id: yachtId });
    }, [yachtId]);

    // ── Save on page close / visibility change ──────────────────
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Synchronous save to localStorage
            const current = draft;
            current.lastSaved = new Date().toISOString();
            localStorage.setItem(draftKey(yachtId), JSON.stringify(current));
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                handleBeforeUnload();
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [draft, yachtId]);

    // ── Check if step has data ──────────────────────────────────
    const isStepComplete = useCallback(
        (step: number): boolean => {
            return draft.completedSteps.includes(step);
        },
        [draft.completedSteps]
    );

    return {
        draft,
        isLoaded,
        saveStepData,
        getStepData,
        markStepComplete,
        markStepIncomplete,
        setActiveStep,
        debouncedSave,
        clearDraft,
        isStepComplete,
        saveMainImage,
        loadMainImage,
        saveGalleryImage,
        loadGalleryImages,
    };
}
