"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, User, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
    LOCKSCREEN_EVENT,
    LOCKSCREEN_STORAGE_KEY,
    isScreenLocked,
    lockScreenNow,
    unlockScreenNow,
} from "@/lib/lockscreen";
import { api } from "@/lib/api/http";
import { clearClientSession } from "@/lib/auth/client-session";
import { getDictionary, type AppLocale } from "@/lib/i18n";

const LOCK_BG_IMAGE =
    "https://images.unsplash.com/photo-1674606867042-2aa3581c1bb5?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

interface LockscreenOverlayProps {
    children: React.ReactNode;
    locale: AppLocale;
    userName: string;
}

export default function LockscreenOverlay({
    children,
    locale,
    userName,
}: LockscreenOverlayProps) {
    const router = useRouter();
    const t = getDictionary(locale).lockscreen;
    const [hasMounted, setHasMounted] = useState(false);
    const [isLocked, setIsLocked] = useState(() => isScreenLocked());

    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const [pinError, setPinError] = useState<string | null>(null);
    const [shakeCount, setShakeCount] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [lockTime, setLockTime] = useState<Date>(() => new Date());

    // Default to 10 minutes for now (user can configure via DB)
    const timeoutDuration = 10 * 60 * 1000;

    const lockScreen = () => {
        lockScreenNow("timeout");
    };

    // Listen for lock/unlock events (cross-tab sync)
    useEffect(() => {
        const syncLockedState = () => setIsLocked(isScreenLocked());

        const handleStorage = (event: StorageEvent) => {
            if (event.key === LOCKSCREEN_STORAGE_KEY) {
                syncLockedState();
            }
        };

        const handleLockscreenEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ locked?: boolean }>;
            if (typeof customEvent.detail?.locked === "boolean") {
                setIsLocked(customEvent.detail.locked);
                return;
            }
            syncLockedState();
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(LOCKSCREEN_EVENT, handleLockscreenEvent);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(LOCKSCREEN_EVENT, handleLockscreenEvent);
        };
    }, []);

    // Inactivity timer
    const resetTimer = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!isLocked) {
            timeoutRef.current = setTimeout(() => lockScreen(), timeoutDuration);
        }
    };

    useEffect(() => {
        if (isLocked) return;
        const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
        const handleActivity = () => resetTimer();
        events.forEach((e) => window.addEventListener(e, handleActivity));
        resetTimer();
        return () => {
            events.forEach((e) => window.removeEventListener(e, handleActivity));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [timeoutDuration, isLocked]);

    // Clear errors when PIN changes
    useEffect(() => {
        if (password.length < 4) {
            setShakeCount(0);
            setPinError(null);
        }
    }, [password]);

    // Clock when locked
    useEffect(() => {
        if (!isLocked) return;
        setLockTime(new Date());
        const interval = setInterval(() => setLockTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [isLocked]);

    // Submit PIN
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/verify-password", { password });
            setIsLocked(false);
            unlockScreenNow();
            setPassword("");
            setPinError(null);
            toast.success(t.welcomeBack);
            resetTimer();
        } catch (err: any) {
            const message = err.response?.data?.message || t.incorrectPin;
            setPinError(message);
            setShakeCount((c) => c + 1);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Logout from lockscreen
    const handleLogout = () => {
        setIsLocked(false);
        unlockScreenNow();
        clearClientSession();
        router.push(`/${locale}/login`);
        router.refresh();
    };

    const displayName = userName || t.fallbackUser;
    const initials = displayName
        .split(" ")
        .map((s: string) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    if (!hasMounted) {
        return <>{children}</>;
    }

    return (
        <>
            <AnimatePresence>
                {isLocked && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
                    >
                        {/* Background image + blur + gradient */}
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
                            style={{ backgroundImage: `url(${LOCK_BG_IMAGE})` }}
                        />
                        <div className="absolute inset-0 backdrop-blur-lg" />
                        <div
                            className="absolute inset-0 bg-gradient-to-br from-teal-900/50 via-transparent to-indigo-900/50"
                            aria-hidden
                        />
                        <div className="absolute inset-0 bg-black/30" aria-hidden />

                        <div className="relative flex flex-col items-center w-full max-w-2xl">
                            {/* Clock */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                                className="text-center mb-2"
                            >
                                <div className="text-6xl sm:text-7xl font-extralight tabular-nums tracking-tight text-white">
                                    {lockTime
                                        .toLocaleTimeString(locale, {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: false,
                                        })
                                        .replace(":", " · ")}
                                </div>
                                <div className="text-white/90 text-sm sm:text-base font-light uppercase tracking-[0.2em] mt-2">
                                    {lockTime.toLocaleDateString(locale, {
                                        weekday: "long",
                                        month: "long",
                                        year: "numeric",
                                        day: "2-digit",
                                    })}
                                </div>
                            </motion.div>

                            {/* Name + Avatar + PIN row */}
                            <motion.form
                                onSubmit={handleSubmit}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.3 }}
                                className="mt-12 sm:mt-16 flex flex-col items-center w-full"
                            >
                                <motion.div
                                    key={shakeCount}
                                    initial={{ x: 0 }}
                                    animate={{
                                        x: shakeCount >= 1 ? [0, -10, 10, -10, 10, 0] : 0,
                                    }}
                                    transition={{ duration: 0.4 }}
                                    className="flex flex-col items-center w-full"
                                >
                                    <div className="flex flex-row items-center justify-center w-full gap-4 sm:gap-0">
                                        {/* Left: name */}
                                        <div className="w-full sm:w-56 h-12 rounded-xl sm:rounded-r-none bg-white/20 shadow-lg border border-white/50 flex items-center px-4 text-white font-medium text-base">
                                            <span className="truncate">{displayName}</span>
                                        </div>

                                        {/* Center: avatar */}
                                        <div className="shrink-0 w-20 sm:-ml-2 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-xl z-10 flex items-center justify-center overflow-hidden border-[6px] border-white">
                                            <div className="flex h-full w-full items-center justify-center bg-[#E7F0FF] text-lg font-bold text-[#0B1F3A]">
                                                {initials || <User className="w-10 h-10 text-slate-400" />}
                                            </div>
                                        </div>

                                        {/* Right: PIN input */}
                                        <div
                                            className={`relative w-full sm:w-56 h-12 sm:-ml-2 rounded-xl sm:rounded-l-none shadow-lg flex items-center overflow-hidden border ${pinError
                                                ? "bg-red-500/20 border-red-400/70"
                                                : "bg-white/20 border-white/50"
                                                }`}
                                        >
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={4}
                                                value={password}
                                                onChange={(e) => {
                                                    const v = e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 4);
                                                    setPassword(v);
                                                }}
                                                placeholder={t.pinPlaceholder}
                                                className="flex-1 h-full px-4 pl-6 pr-10 text-white placeholder:text-slate-400 outline-none bg-transparent text-lg tracking-widest"
                                                autoFocus
                                                autoComplete="off"
                                            />
                                            <button
                                                type="submit"
                                                disabled={loading || password.length < 4}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                aria-label={t.unlock}
                                            >
                                                {loading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Error message */}
                                <div className="min-h-[20px] mt-2 flex justify-center items-center">
                                    {pinError && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-red-300 text-sm font-medium"
                                        >
                                            {pinError}
                                        </motion.p>
                                    )}
                                </div>
                            </motion.form>
                        </div>

                        {/* Logout at bottom */}
                        <motion.button
                            type="button"
                            onClick={handleLogout}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/80 hover:text-white text-xl font-medium transition-colors cursor-pointer"
                        >
                            <LogOut size={18} />
                            {t.logout}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className={`transition-all duration-300 ${isLocked
                    ? "blur-sm pointer-events-none select-none h-screen overflow-hidden"
                    : ""
                    }`}
            >
                {children}
            </div>
        </>
    );
}
