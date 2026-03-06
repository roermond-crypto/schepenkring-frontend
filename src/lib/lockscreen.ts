"use client";

export const LOCKSCREEN_STORAGE_KEY = "is_locked";
export const LOCKSCREEN_EVENT = "app:lockscreen";

type LockReason = "manual" | "timeout" | "unlock";

interface LockscreenEventDetail {
    locked: boolean;
    reason: LockReason;
}

function dispatchLockscreenEvent(detail: LockscreenEventDetail) {
    window.dispatchEvent(
        new CustomEvent<LockscreenEventDetail>(LOCKSCREEN_EVENT, { detail }),
    );
}

export function isScreenLocked() {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LOCKSCREEN_STORAGE_KEY) === "true";
}

export function setLockscreenState(
    locked: boolean,
    reason: LockReason = locked ? "manual" : "unlock",
) {
    if (typeof window === "undefined") return;

    if (locked) {
        localStorage.setItem(LOCKSCREEN_STORAGE_KEY, "true");
    } else {
        localStorage.removeItem(LOCKSCREEN_STORAGE_KEY);
    }

    dispatchLockscreenEvent({ locked, reason });
}

export function lockScreenNow(reason: LockReason = "manual") {
    setLockscreenState(true, reason);
}

export function unlockScreenNow() {
    setLockscreenState(false, "unlock");
}
