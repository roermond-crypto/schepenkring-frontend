"use client";

import { useSyncService } from "@/hooks/useSyncService";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, RefreshCw, Loader2 } from "lucide-react";

/**
 * NetworkStatusBar — Thin banner at the top of the CRM showing
 * connection status: Offline (red) / Syncing (amber) / Online (green).
 */
export function NetworkStatusBar() {
    const { syncStatus, pendingCount, syncNow } = useSyncService();

    // Don't show bar when everything is normal (online, nothing pending)
    if (syncStatus === "online" && pendingCount === 0) {
        return null;
    }

    const config = {
        offline: {
            bg: "bg-red-600",
            icon: <CloudOff size={14} />,
            text: "You are offline",
            subtext: pendingCount > 0 ? `${pendingCount} action${pendingCount > 1 ? "s" : ""} pending` : "Changes will sync when you reconnect",
        },
        syncing: {
            bg: "bg-amber-500",
            icon: <Loader2 size={14} className="animate-spin" />,
            text: "Syncing...",
            subtext: `${pendingCount} item${pendingCount !== 1 ? "s" : ""} remaining`,
        },
        online: {
            bg: "bg-emerald-600",
            icon: <Cloud size={14} />,
            text: "Online",
            subtext: pendingCount > 0 ? `${pendingCount} pending — ` : "",
        },
    };

    const current = config[syncStatus];

    return (
        <div
            className={cn(
                "fixed left-0 right-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-1.5 text-white text-xs font-medium transition-all duration-300",
                current.bg,
            )}
        >
            {current.icon}
            <span>{current.text}</span>
            <span className="text-white/75">
                {current.subtext}
            </span>

            {syncStatus === "online" && pendingCount > 0 && (
                <button
                    onClick={syncNow}
                    className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider hover:bg-white/30 transition"
                >
                    <RefreshCw size={10} />
                    Sync now
                </button>
            )}

            {syncStatus === "offline" && (
                <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-red-300 animate-pulse" />
            )}
        </div>
    );
}
