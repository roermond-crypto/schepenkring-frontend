"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, User, Bot, Clock, AlertCircle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type HistoryEntry = {
    id: number;
    old_value: string | null;
    new_value: string | null;
    changed_by_type: "ai" | "user" | "admin" | "import" | "scraper";
    changed_by_id: number | null;
    confidence_before: number | null;
    reason: string | null;
    correction_label: string | null;
    created_at: string;
    meta?: {
        ai_proposed_value?: unknown;
        ai_field_source?: string | null;
        model_version?: string | null;
    } | null;
    user?: {
        name: string;
        avatar?: string;
    };
};

interface FieldHistoryPopoverProps {
    yachtId: number;
    fieldName: string;
    label: string;
}

export function FieldHistoryPopover({ yachtId, fieldName, label }: FieldHistoryPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/yachts/${yachtId}/fields/${fieldName}/history`);
            setHistory(response.data.history || []);
        } catch (error) {
            console.error("Failed to fetch field history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    const parseValue = (val: string | null) => {
        if (val === null || val === "null") return <span className="text-slate-400 italic">empty</span>;
        try {
            const parsed = JSON.parse(val);
            if (typeof parsed === "boolean") return parsed ? "Yes" : "No";
            return String(parsed);
        } catch {
            return val;
        }
    };

    return (
        <div className="relative inline-block ml-2">
            <button
                type="button"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-blue-600"
                title="View field history"
            >
                <History size={14} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden pointer-events-none"
                    >
                        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <History size={12} className="text-blue-500" /> {label} History
                            </span>
                        </div>

                        <div className="max-h-80 overflow-y-auto p-4 space-y-4">
                            {isLoading && (
                                <div className="flex items-center justify-center py-8">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    >
                                        <History size={20} className="text-slate-300" />
                                    </motion.div>
                                </div>
                            )}

                            {!isLoading && history.length === 0 && (
                                <p className="text-center text-slate-400 text-xs py-4 italic">
                                    No changes recorded yet.
                                </p>
                            )}

                            {!isLoading && history.map((entry, idx) => (
                                <div key={entry.id} className="relative pl-6 pb-4 border-l border-slate-100 last:pb-0">
                                    <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white" />

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                {entry.changed_by_type === "ai" ? (
                                                    <><Bot size={10} className="text-violet-500" /> AI Agent</>
                                                ) : (
                                                    <><User size={10} className="text-blue-500" /> {entry.user?.name || "System"}</>
                                                )}
                                            </span>
                                            <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                                <Clock size={8} /> {format(new Date(entry.created_at), "MMM d, HH:mm")}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 rounded-lg p-2 text-xs flex items-center gap-2">
                                            <div className="line-through text-slate-400 truncate max-w-[80px]">
                                                {parseValue(entry.old_value)}
                                            </div>
                                            <ChevronRight size={10} className="text-slate-300" />
                                            <div className="font-bold text-slate-800 truncate">
                                                {parseValue(entry.new_value)}
                                            </div>
                                        </div>

                                        {entry.meta?.ai_proposed_value !== undefined && (
                                            <div className="text-[9px] text-slate-500">
                                                AI suggested: <span className="font-semibold text-slate-700">{parseValue(JSON.stringify(entry.meta.ai_proposed_value) ?? null)}</span>
                                                {entry.meta.ai_field_source ? (
                                                    <span className="ml-1 text-slate-400">from {entry.meta.ai_field_source}</span>
                                                ) : null}
                                            </div>
                                        )}

                                        {entry.correction_label && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-100 w-fit">
                                                <AlertCircle size={10} className="text-red-500" />
                                                <span className="text-[9px] font-bold text-red-600 uppercase">
                                                    {entry.correction_label.replace(/_/g, " ")}
                                                </span>
                                            </div>
                                        )}

                                        {entry.confidence_before !== null && entry.changed_by_type === "ai" && (
                                            <div className="text-[9px] font-medium text-slate-400">
                                                AI Confidence: <span className={cn(entry.confidence_before > 0.8 ? "text-emerald-500" : "text-amber-500")}>
                                                    {Math.round(entry.confidence_before * 100)}%
                                                </span>
                                            </div>
                                        )}

                                        {entry.reason && (
                                            <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                                "{entry.reason}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-blue-50 p-2 text-center border-t border-blue-100">
                            <p className="text-[9px] text-blue-600 font-medium">
                                AI learns from your manual corrections.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
