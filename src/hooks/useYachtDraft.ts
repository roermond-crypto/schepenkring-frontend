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
    [key: string]: unknown;
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

type DraftOverride = Partial<Omit<YachtDraft, "data">> & {
    data?: Partial<YachtDraft["data"]>;
};

type UseYachtDraftOptions = {
    scopeKey?: string | null;
};

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

function normalizeScopeKey(scopeKey?: string | null): string {
    const trimmed = scopeKey?.trim();
    if (!trimmed) {
        return "";
    }

    return trimmed.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function legacyDraftKey(yachtId: string) {
    return `yacht_draft_${yachtId}`;
}

function draftKey(yachtId: string, scopeKey?: string | null) {
    const normalizedScope = normalizeScopeKey(scopeKey);
    if (!normalizedScope) {
        return legacyDraftKey(yachtId);
    }

    return `yacht_draft_${normalizedScope}_${yachtId}`;
}

function imageDraftPrefix(yachtId: string, scopeKey?: string | null) {
    const normalizedScope = normalizeScopeKey(scopeKey);
    if (!normalizedScope) {
        return `yacht_${yachtId}_`;
    }

    return `yacht_${normalizedScope}_${yachtId}_`;
}

function readDraftFromStorage(yachtId: string, scopeKey?: string | null): YachtDraft {
    if (typeof window === "undefined") {
        return { ...EMPTY_DRAFT, id: yachtId };
    }

    const scopedKey = draftKey(yachtId, scopeKey);
    const fallbackLegacyKey =
        yachtId !== "new" && scopedKey !== legacyDraftKey(yachtId)
            ? legacyDraftKey(yachtId)
            : null;
    const stored =
        localStorage.getItem(scopedKey) ??
        (fallbackLegacyKey ? localStorage.getItem(fallbackLegacyKey) : null);
    if (!stored) {
        return { ...EMPTY_DRAFT, id: yachtId };
    }

    try {
        const parsed = JSON.parse(stored) as YachtDraft;
        return {
            ...EMPTY_DRAFT,
            ...parsed,
            id: yachtId,
            data: {
                ...EMPTY_DRAFT.data,
                ...(parsed.data || {}),
            },
        };
    } catch {
        return { ...EMPTY_DRAFT, id: yachtId };
    }
}

// ─── Hook ────────────────────────────────────────────────────────

export function useYachtDraft(yachtId: string, options?: UseYachtDraftOptions) {
    const scopeKey = options?.scopeKey;
    const scopedDraftKey = draftKey(yachtId, scopeKey);
    const scopedImagePrefix = imageDraftPrefix(yachtId, scopeKey);
    const legacyKey = legacyDraftKey(yachtId);
    const legacyImagePrefix = imageDraftPrefix(yachtId);

    const [draft, setDraft] = useState<YachtDraft>(() => readDraftFromStorage(yachtId, scopeKey));
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isLoaded = true;

    useEffect(() => {
        setDraft(readDraftFromStorage(yachtId, scopeKey));
    }, [yachtId, scopeKey]);

    // ── Persist to localStorage ──────────────────────────────────
    const persistDraft = useCallback(
        (updated: YachtDraft): YachtDraft => {
            const withTimestamp: YachtDraft = {
                ...updated,
                lastSaved: new Date().toISOString(),
                pendingSync: true,
            };
            localStorage.setItem(scopedDraftKey, JSON.stringify(withTimestamp));
            return withTimestamp;
        },
        [scopedDraftKey]
    );

    const mergeDraft = useCallback((base: YachtDraft, override?: DraftOverride): YachtDraft => {
        if (!override) return base;

        return {
            ...base,
            ...override,
            data: {
                ...base.data,
                ...(override.data || {}),
            },
        };
    }, []);

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
                return persistDraft(updated);
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
                return persistDraft(updated);
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
                return persistDraft(updated);
            });
        },
        [persistDraft]
    );

    // ── Set active step ─────────────────────────────────────────
    const setActiveStep = useCallback(
        (step: number) => {
            setDraft((prev) => {
                const updated: YachtDraft = { ...prev, currentStep: step };
                return persistDraft(updated);
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
            await storeImage(`${scopedImagePrefix}main`, file);
        },
        [scopedImagePrefix]
    );

    // ── Load main image from IndexedDB ──────────────────────────
    const loadMainImage = useCallback(async (): Promise<File | null> => {
        return loadImage(`${scopedImagePrefix}main`);
    }, [scopedImagePrefix]);

    // ── Save gallery image to IndexedDB ─────────────────────────
    const saveGalleryImage = useCallback(
        async (category: string, index: number, file: File) => {
            await storeImage(
                `${scopedImagePrefix}gallery_${category}_${index}`,
                file
            );
        },
        [scopedImagePrefix]
    );

    // ── Load gallery images from IndexedDB ──────────────────────
    const loadGalleryImages = useCallback(
        async (category: string) => {
            return loadImagesByPrefix(
                `${scopedImagePrefix}gallery_${category}_`
            );
        },
        [scopedImagePrefix]
    );

    // ── Clear draft (after successful submit) ───────────────────
    const clearDraft = useCallback(async () => {
        localStorage.removeItem(scopedDraftKey);
        if (legacyKey !== scopedDraftKey) {
            localStorage.removeItem(legacyKey);
        }
        await deleteImagesByPrefix(scopedImagePrefix);
        if (legacyImagePrefix !== scopedImagePrefix) {
            await deleteImagesByPrefix(legacyImagePrefix);
        }
        setDraft({ ...EMPTY_DRAFT, id: yachtId });
    }, [legacyImagePrefix, legacyKey, scopedDraftKey, scopedImagePrefix, yachtId]);

    // ── Force an immediate draft flush ──────────────────────────
    const flushDraft = useCallback(
        (override?: DraftOverride) => {
            setDraft((prev) => {
                const merged = mergeDraft(prev, override);
                return persistDraft(merged);
            });
        },
        [mergeDraft, persistDraft]
    );

    // ── Save on page close / visibility change ──────────────────
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Synchronous save to localStorage
            localStorage.setItem(
                scopedDraftKey,
                JSON.stringify({
                    ...draft,
                    lastSaved: new Date().toISOString(),
                    pendingSync: true,
                })
            );
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
    }, [draft, scopedDraftKey]);

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
        flushDraft,
        isStepComplete,
        saveMainImage,
        loadMainImage,
        saveGalleryImage,
        loadGalleryImages,
    };
}
