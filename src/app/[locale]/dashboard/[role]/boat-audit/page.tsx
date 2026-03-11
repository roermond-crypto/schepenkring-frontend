"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    ShieldCheck,
    Search,
    Bot,
    User,
    AlertCircle,
    Database,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    History,
    Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BoatFieldChange {
    id: number;
    yacht_id: number;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_type: "ai" | "user" | "admin" | "import" | "scraper";
    changed_by_id: number | null;
    source_type: string | null;
    confidence_before: number | null;
    ai_session_id: string | null;
    model_name: string | null;
    reason: string | null;
    correction_label: string | null;
    created_at: string;
    yacht?: {
        id: number;
        boat_name: string | null;
    };
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export default function BoatAuditPage() {
    const router = useRouter();
    const params = useParams<{ locale?: string; role?: string }>();
    const locale = params?.locale ?? "en";
    const role = params?.role ?? "admin";
    const [logs, setLogs] = useState<BoatFieldChange[]>([]);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchYacht, setSearchYacht] = useState("");
    const [searchField, setSearchField] = useState("");
    const [filterActor, setFilterActor] = useState("");
    const [filterLabel, setFilterLabel] = useState("");
    const [page, setPage] = useState(1);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            // For local searching we pass query params
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: "25",
            });

            if (searchField) params.append("field_name", searchField);
            if (filterActor) params.append("changed_by_type", filterActor);
            if (filterLabel) params.append("correction_label", filterLabel);

            const response = await api.get(`/admin/boat-audit?${params.toString()}`);
            if (response.data) {
                setLogs(response.data.data || []);
                setMeta({
                    current_page: response.data.current_page,
                    last_page: response.data.last_page,
                    per_page: response.data.per_page,
                    total: response.data.total,
                    from: response.data.from,
                    to: response.data.to,
                });
            }
        } catch (error) {
            console.error("Failed to load boat audit logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, searchField, filterActor, filterLabel]);

    // Debounced Search for text fields
    // (In a real app, use a proper debounce hook)

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

    const getActorIcon = (type: string) => {
        switch (type) {
            case "ai":
                return <Bot size={14} className="text-violet-500" />;
            case "user":
            case "admin":
                return <User size={14} className="text-blue-500" />;
            case "import":
            case "scraper":
                return <Database size={14} className="text-amber-500" />;
            default:
                return <Activity size={14} className="text-slate-400" />;
        }
    };

    const filteredLogs = useMemo(() => {
        // Client-side text filter for yacht name (since the backend doesn't native filter across the relation easily without a JOIN)
        if (!searchYacht) return logs;
        const lowerQ = searchYacht.toLowerCase();
        return logs.filter((log) => {
            const name = log.yacht?.boat_name || `Yacht #${log.yacht_id}`;
            return name.toLowerCase().includes(lowerQ);
        });
    }, [logs, searchYacht]);

    return (
        <div className="flex-1 space-y-6 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <History className="h-6 w-6 text-blue-600" />
                        AI Correction Audit
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Track field-level changes and monitor AI extraction accuracy across all yachts.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => router.push(`/${locale}/dashboard/${role}/yachts`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to Yachts
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search by yacht name..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={searchYacht}
                        onChange={(e) => setSearchYacht(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search by field (e.g., bimini)..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                    />
                </div>
                <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filterActor}
                    onChange={(e) => setFilterActor(e.target.value)}
                >
                    <option value="">All Actors</option>
                    <option value="ai">AI System</option>
                    <option value="admin">Admins</option>
                    <option value="user">Users (Brokers)</option>
                    <option value="import">Imports</option>
                </select>
                <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filterLabel}
                    onChange={(e) => setFilterLabel(e.target.value)}
                >
                    <option value="">All Feedback</option>
                    <option value="wrong_image_detection">Wrong Image Detection</option>
                    <option value="wrong_text_interpretation">Wrong Text Info</option>
                    <option value="guessed_too_much">AI Hallucination</option>
                    <option value="other">Other Correction</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-medium">Date & Time</th>
                                <th className="px-6 py-4 font-medium">Yacht</th>
                                <th className="px-6 py-4 font-medium">Field</th>
                                <th className="px-6 py-4 font-medium">Change</th>
                                <th className="px-6 py-4 font-medium">Actor</th>
                                <th className="px-6 py-4 font-medium">AI Feedback</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <AnimatePresence mode="popLayout">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                                >
                                                    <History size={24} className="text-slate-300" />
                                                </motion.div>
                                                <p className="text-sm">Loading audit logs...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                <ShieldCheck size={32} className="text-slate-300" />
                                                <p>No field changes found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <motion.tr
                                            key={log.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="hover:bg-slate-50/50 transition-colors group"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">
                                                        {format(new Date(log.created_at), "MMM d, yyyy")}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {format(new Date(log.created_at), "HH:mm:ss")}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <a
                                                    href={`/dashboard/admin/yachts/${log.yacht_id}`}
                                                    className="font-medium text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                                                >
                                                    {log.yacht?.boat_name || `Yacht #${log.yacht_id}`}
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                    {log.field_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 max-w-[300px]">
                                                    <div className="flex-1 truncate line-through text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100/50">
                                                        {parseValue(log.old_value)}
                                                    </div>
                                                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                                                    <div className="flex-1 truncate font-medium text-slate-900 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                        {parseValue(log.new_value)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={cn(
                                                            "p-1.5 rounded-md",
                                                            log.changed_by_type === "ai"
                                                                ? "bg-violet-100 text-violet-700"
                                                                : log.changed_by_type === "admin"
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "bg-slate-100 text-slate-700"
                                                        )}
                                                    >
                                                        {getActorIcon(log.changed_by_type)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-900 capitalize">
                                                            {log.changed_by_type}
                                                        </span>
                                                        {log.user && (
                                                            <span className="text-xs text-slate-500">{log.user.name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {log.correction_label ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertCircle size={14} className="text-red-500" />
                                                        <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                                                            {log.correction_label.replace(/_/g, " ")}
                                                        </span>
                                                    </div>
                                                ) : log.changed_by_type === "ai" && log.confidence_before !== null ? (
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        Conf: {Math.round(log.confidence_before * 100)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">-</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {/* Pagination Header */}
                {meta && meta.last_page > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                            Showing <span className="font-medium text-slate-900">{meta.from}</span> to{" "}
                            <span className="font-medium text-slate-900">{meta.to}</span> of{" "}
                            <span className="font-medium text-slate-900">{meta.total}</span> entries
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="px-3 py-1.5 text-sm font-medium text-slate-900">
                                Page {page} of {meta.last_page}
                            </div>
                            <button
                                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                disabled={page === meta.last_page}
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPage(meta.last_page)}
                                disabled={page === meta.last_page}
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
