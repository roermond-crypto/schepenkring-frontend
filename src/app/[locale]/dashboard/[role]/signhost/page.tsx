"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    FileSignature,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RotateCcw,
    Loader2,
    ShieldAlert,
    CalendarClock,
    Webhook,
} from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminSignRequest {
    id: number;
    entity_type: string;
    entity_id: number;
    status: string;
    provider: string;
    signhost_transaction_id: string | null;
    signhost_buyer_link: string | null;
    signhost_seller_link: string | null;
    signhost_expires_at: string | null;
    signhost_last_checked_at: string | null;
    signhost_created_at: string | null;
    buyer_signed_at: string | null;
    seller_signed_at: string | null;
    completed_at: string | null;
    signed_pdf_path: string | null;
    signed_pdf_hash: string | null;
    webhook_failed: boolean;
    webhook_error: string | null;
    last_webhook_received_at: string | null;
    location_id: number | null;
    created_at: string;
    updated_at: string;
    document_count: number;
    needs_attention: boolean;
}

interface Stats {
    waiting: number;
    completed: number;
    expired: number;
    failed: number;
    needs_attention: number;
}

interface PageData {
    data: AdminSignRequest[];
    current_page: number;
    last_page: number;
    total: number;
    stats: Stats;
}

type FilterTab = "all" | "waiting" | "completed" | "expired" | "failed" | "needs_attention";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string, needsAttention: boolean) {
    if (needsAttention) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                Aandacht vereist
            </span>
        );
    }
    const map: Record<string, { label: string; cls: string }> = {
        DRAFT:  { label: "Concept",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
        SENT:   { label: "Verzonden",   cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
        VIEWED: { label: "Bekeken",     cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
        SIGNED: { label: "Ondertekend", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
        EXPIRED: { label: "Verlopen",   cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
        FAILED:  { label: "Mislukt",    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
        CANCELLED: { label: "Geannuleerd", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    };
    const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
    return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>
            {s.label}
        </span>
    );
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "dd MMM yyyy HH:mm", { locale: nl });
    } catch {
        return iso;
    }
}

function relDate(iso: string | null) {
    if (!iso) return "—";
    try {
        return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: nl });
    } catch {
        return iso;
    }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SignhostMonitorPage() {
    const params = useParams<{ locale?: string; role?: string }>();
    const locale = params?.locale ?? "nl";

    const [filter, setFilter] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [resyncing, setResyncing] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchData = useCallback(async (currentFilter: FilterTab, currentPage: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(currentPage) });
            if (currentFilter !== "all") params.set("status", currentFilter);
            const res = await api.get<PageData>(`/admin/signhost?${params.toString()}`);
            setData(res.data);
        } catch (err) {
            console.error("Failed to fetch signhost monitor data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(filter, page);
    }, [filter, page, fetchData]);

    const handleResync = async (sr: AdminSignRequest) => {
        setResyncing(sr.id);
        try {
            await api.post(`/admin/signhost/${sr.id}/resync`);
            await fetchData(filter, page);
        } catch (err) {
            console.error("Resync failed", err);
        } finally {
            setResyncing(null);
        }
    };

    const rows = useMemo(() => {
        if (!data?.data) return [];
        if (!search.trim()) return data.data;
        const q = search.toLowerCase();
        return data.data.filter(sr =>
            String(sr.entity_id).includes(q) ||
            (sr.signhost_transaction_id ?? "").toLowerCase().includes(q) ||
            sr.status.toLowerCase().includes(q)
        );
    }, [data, search]);

    const stats = data?.stats;

    const tabs: { key: FilterTab; label: string; count?: number }[] = [
        { key: "all",              label: "Alle" },
        { key: "needs_attention",  label: "Aandacht vereist", count: stats?.needs_attention },
        { key: "waiting",          label: "Wachtend",         count: stats?.waiting },
        { key: "completed",        label: "Afgerond",         count: stats?.completed },
        { key: "expired",          label: "Verlopen",         count: stats?.expired },
        { key: "failed",           label: "Mislukt",          count: stats?.failed },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <FileSignature className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            Signhost Monitor
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Overzicht van alle ondertekeningsverzoeken
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => fetchData(filter, page)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
                    Vernieuwen
                </button>
            </div>

            {/* Stat pills */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    {[
                        { label: "Wachtend",          value: stats.waiting,         icon: Clock,        cls: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
                        { label: "Afgerond",          value: stats.completed,        icon: CheckCircle2, cls: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
                        { label: "Verlopen",          value: stats.expired,          icon: CalendarClock,cls: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20" },
                        { label: "Mislukt",           value: stats.failed,           icon: XCircle,      cls: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
                        { label: "Aandacht vereist",  value: stats.needs_attention,  icon: ShieldAlert,  cls: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
                    ].map(({ label, value, icon: Icon, cls }) => (
                        <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", cls)}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs + Search */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex flex-wrap gap-1">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => { setFilter(t.key); setPage(1); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                    filter === t.key
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                )}
                            >
                                {t.label}
                                {t.count !== undefined && (
                                    <span className={cn(
                                        "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
                                        filter === t.key
                                            ? "bg-white/25 text-white"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    )}>
                                        {t.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Zoek op ID, transactie-ID, status…"
                            className="pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                                <th className="text-left px-4 py-3 font-medium">ID</th>
                                <th className="text-left px-4 py-3 font-medium">Contract</th>
                                <th className="text-left px-4 py-3 font-medium">Status</th>
                                <th className="text-left px-4 py-3 font-medium">Aangemaakt</th>
                                <th className="text-left px-4 py-3 font-medium">Verloopt</th>
                                <th className="text-left px-4 py-3 font-medium">Webhook</th>
                                <th className="text-left px-4 py-3 font-medium">Acties</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Laden…
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        Geen ondertekeningsverzoeken gevonden
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.map(sr => (
                                <>
                                    <tr
                                        key={sr.id}
                                        onClick={() => setExpandedId(expandedId === sr.id ? null : sr.id)}
                                        className={cn(
                                            "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors",
                                            sr.needs_attention && "bg-amber-50/50 dark:bg-amber-900/10"
                                        )}
                                    >
                                        <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100 text-xs">
                                            #{sr.id}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                {sr.entity_type} #{sr.entity_id}
                                            </div>
                                            {sr.signhost_transaction_id && (
                                                <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[180px]" title={sr.signhost_transaction_id}>
                                                    {sr.signhost_transaction_id.slice(0, 20)}…
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {statusBadge(sr.status, sr.needs_attention)}
                                            {sr.webhook_failed && (
                                                <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
                                                    <Webhook className="w-3 h-3" />
                                                    Webhook fout
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                            {fmtDate(sr.signhost_created_at ?? sr.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {sr.signhost_expires_at ? (
                                                <span className={cn(
                                                    new Date(sr.signhost_expires_at) < new Date()
                                                        ? "text-red-500 dark:text-red-400"
                                                        : "text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {fmtDate(sr.signhost_expires_at)}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                            {sr.last_webhook_received_at
                                                ? relDate(sr.last_webhook_received_at)
                                                : "Geen webhook ontvangen"
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleResync(sr); }}
                                                disabled={resyncing === sr.id || !sr.signhost_transaction_id}
                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Haal actuele status op bij Signhost"
                                            >
                                                {resyncing === sr.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <RotateCcw className="w-3 h-3" />
                                                }
                                                Resync
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === sr.id && (
                                        <tr key={`${sr.id}-detail`} className="bg-gray-50 dark:bg-gray-800/30">
                                            <td colSpan={7} className="px-6 py-4">
                                                <ExpandedDetail sr={sr} />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data && data.last_page > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {data.total} resultaten · Pagina {data.current_page} van {data.last_page}
                        </span>
                        <div className="flex items-center gap-1">
                            <PageBtn icon={ChevronsLeft}  onClick={() => setPage(1)}                          disabled={page === 1} />
                            <PageBtn icon={ChevronLeft}   onClick={() => setPage(p => Math.max(1, p - 1))}   disabled={page === 1} />
                            <PageBtn icon={ChevronRight}  onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page === data.last_page} />
                            <PageBtn icon={ChevronsRight} onClick={() => setPage(data.last_page)}             disabled={page === data.last_page} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PageBtn({ icon: Icon, onClick, disabled }: { icon: React.ComponentType<{ className?: string }>; onClick: () => void; disabled: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}

function ExpandedDetail({ sr }: { sr: AdminSignRequest }) {
    const grid = [
        { label: "Transactie-ID",          value: sr.signhost_transaction_id ?? "—" },
        { label: "Provider",                value: sr.provider },
        { label: "Locatie ID",              value: String(sr.location_id ?? "—") },
        { label: "Documenten",              value: String(sr.document_count) },
        { label: "Koper ondertekend",       value: sr.buyer_signed_at  ? format(parseISO(sr.buyer_signed_at),  "dd MMM yyyy HH:mm", { locale: nl }) : "Nog niet" },
        { label: "Verkoper ondertekend",    value: sr.seller_signed_at ? format(parseISO(sr.seller_signed_at), "dd MMM yyyy HH:mm", { locale: nl }) : "Nog niet" },
        { label: "Afgerond op",             value: sr.completed_at     ? format(parseISO(sr.completed_at),     "dd MMM yyyy HH:mm", { locale: nl }) : "—" },
        { label: "Laatste check Signhost",  value: sr.signhost_last_checked_at ? formatDistanceToNow(parseISO(sr.signhost_last_checked_at), { addSuffix: true, locale: nl }) : "Nooit" },
        { label: "Ondertekend PDF pad",     value: sr.signed_pdf_path  ?? "—" },
        { label: "PDF hash",                value: sr.signed_pdf_hash  ? sr.signed_pdf_hash.slice(0, 16) + "…" : "—" },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {grid.map(({ label, value }) => (
                    <div key={label}>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                        <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">{value}</p>
                    </div>
                ))}
            </div>

            {/* Signing links */}
            <div className="flex flex-wrap gap-2">
                {sr.signhost_buyer_link && (
                    <a
                        href={sr.signhost_buyer_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                        Koper ondertekeningslink →
                    </a>
                )}
                {sr.signhost_seller_link && (
                    <a
                        href={sr.signhost_seller_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                    >
                        Verkoper ondertekeningslink →
                    </a>
                )}
            </div>

            {/* Webhook error */}
            {sr.webhook_failed && sr.webhook_error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs font-medium mb-1">
                        <Webhook className="w-3.5 h-3.5" />
                        Webhook fout
                    </div>
                    <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">{sr.webhook_error}</pre>
                </div>
            )}
        </div>
    );
}
