"use client"

import { useTranslations } from "next-intl"
import { Search, Plus, MessageSquare, Inbox, AtSign, User } from "lucide-react"
import type { ChatType, Conversation, ConversationStatus, SendChannel } from "@/types/chat"
import { cn } from "@/lib/utils"

interface ConversationListProps {
    conversations: Conversation[]
    selectedId?: string
    loading: boolean
    statusFilter: ConversationStatus | "all"
    searchQuery: string
    onSelectConversation: (conv: Conversation) => void
    onStatusFilterChange: (status: ConversationStatus | "all") => void
    onSearchChange: (query: string) => void
    onCreateConversation?: () => void
}

function StatusDot({ status }: { status: ConversationStatus }) {
    const colors: Record<ConversationStatus, string> = {
        open: "bg-emerald-500 shadow-emerald-500/40",
        pending: "bg-amber-500 shadow-amber-500/40",
        solved: "bg-slate-400 shadow-slate-400/40",
        archived: "bg-slate-300 shadow-slate-300/40",
    }
    return <span className={cn("inline-block w-2.5 h-2.5 rounded-full shadow-md", colors[status])} />
}

const CHAT_TYPE_COLORS: Record<ChatType, string> = {
    general: "bg-slate-100 text-slate-600",
    offer: "bg-blue-50 text-blue-700",
    viewing: "bg-purple-50 text-purple-700",
    callback: "bg-amber-50 text-amber-700",
    question: "bg-teal-50 text-teal-700",
    brochure: "bg-orange-50 text-orange-700",
    seller: "bg-emerald-50 text-emerald-700",
    buyer: "bg-rose-50 text-rose-700",
}

const CHAT_TYPE_LABELS_NL: Record<ChatType, string> = {
    general: "Algemeen", offer: "Bod", viewing: "Bezichtiging",
    callback: "Terugbellen", question: "Vraag", brochure: "Brochure",
    seller: "Verkoper", buyer: "Koper",
}

function ChatTypeBadge({ type }: { type?: ChatType }) {
    if (!type || type === "general") return null
    return (
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", CHAT_TYPE_COLORS[type])}>
            {CHAT_TYPE_LABELS_NL[type]}
        </span>
    )
}

function ChannelIcon({ channel }: { channel?: SendChannel }) {
    if (channel === "email") return <AtSign size={11} className="text-indigo-500" />
    return null
}

function SlaTimer({ waitingSince }: { waitingSince?: Date }) {
    if (!waitingSince) return null
    const minutes = Math.floor((Date.now() - waitingSince.getTime()) / 60000)
    const color = minutes < 30
        ? "text-emerald-600 bg-emerald-50"
        : minutes < 120
            ? "text-amber-600 bg-amber-50"
            : "text-rose-600 bg-rose-50"
    const label = minutes < 60
        ? `${minutes}m`
        : `${Math.floor(minutes / 60)}u${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`
    return (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", color)}>
            ⏱ {label}
        </span>
    )
}

function formatRelativeTime(date: Date | undefined, t: (key: string, values?: Record<string, any>) => string) {
    if (!date) return ""
    const now = Date.now()
    const diff = now - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t("list.time.now")
    if (mins < 60) return t("list.time.minutes", { count: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t("list.time.hours", { count: hours })
    const days = Math.floor(hours / 24)
    return t("list.time.days", { count: days })
}

export function ConversationList({
    conversations,
    selectedId,
    loading,
    statusFilter,
    searchQuery,
    onSelectConversation,
    onStatusFilterChange,
    onSearchChange,
    onCreateConversation,
}: ConversationListProps) {
    const t = useTranslations("DashboardChat")
    const statusTabs: { label: string; value: ConversationStatus | "all"; color: string }[] = [
        { label: t("list.tabs.all"), value: "all", color: "" },
        { label: t("list.tabs.open"), value: "open", color: "bg-emerald-500" },
        { label: t("list.tabs.pending"), value: "pending", color: "bg-amber-500" },
        { label: t("list.tabs.solved"), value: "solved", color: "bg-slate-400" },
    ]
    return (
        <div className="flex flex-col h-full bg-white/70 backdrop-blur-sm">
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <MessageSquare size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 tracking-tight">{t("list.title")}</h1>
                            <p className="text-[11px] text-slate-400 font-medium">
                                {t("list.count", { count: conversations.length })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCreateConversation}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 transition-all"
                    >
                        <Plus size={16} className="text-white" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        placeholder={t("list.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-100/80 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-1 bg-slate-100/80 rounded-xl p-1">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => onStatusFilterChange(tab.value)}
                            className={cn(
                                "flex-1 text-[11px] font-semibold uppercase tracking-wider py-2 rounded-lg transition-all",
                                statusFilter === tab.value
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                            )}
                        >
                            <span className="flex items-center justify-center gap-1.5">
                                {tab.color && <span className={cn("w-1.5 h-1.5 rounded-full", tab.color)} />}
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {loading ? (
                    <div className="flex flex-col gap-2 px-2 pt-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl">
                                <div className="w-11 h-11 rounded-full bg-slate-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                                    <div className="h-2.5 bg-slate-200 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <Inbox size={24} className="text-slate-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-1">{t("list.emptyTitle")}</h3>
                        <p className="text-xs text-slate-400">
                            {searchQuery ? t("list.emptySearch") : t("list.emptyDefault")}
                        </p>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => onSelectConversation(conv)}
                            className={cn(
                                "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all mb-0.5 group",
                                selectedId === conv.id
                                    ? "bg-blue-50/80 border border-blue-200/60 shadow-sm"
                                    : "hover:bg-slate-50/80 border border-transparent"
                            )}
                        >
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                {conv.contact_avatar ? (
                                    <img
                                        src={conv.contact_avatar}
                                        alt={conv.contact_name}
                                        className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                                    />
                                ) : (
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center ring-2 ring-white shadow-sm">
                                        <span className="text-white font-bold text-sm">
                                            {conv.contact_name.charAt(0)}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5">
                                    <StatusDot status={conv.status} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className={cn(
                                        "text-sm font-semibold truncate",
                                        conv.unread_count > 0 ? "text-slate-900" : "text-slate-700"
                                    )}>
                                        {conv.contact_name}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium flex-shrink-0 ml-2">
                                        {formatRelativeTime(conv.last_message_at, t)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn(
                                        "text-[13px] truncate",
                                        conv.unread_count > 0 ? "text-slate-700 font-medium" : "text-slate-500"
                                    )}>
                                        {conv.last_message}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        {conv.unread_count > 0 && (
                                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-bold rounded-full shadow-sm shadow-blue-500/30">
                                                {conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <ChatTypeBadge type={conv.chat_type} />
                                    <ChannelIcon channel={conv.send_channel} />
                                    <SlaTimer waitingSince={conv.waiting_since} />
                                    {conv.assigned_name && (
                                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                            <User size={10} />
                                            {conv.assigned_name}
                                        </span>
                                    )}
                                    {conv.source === "widget" && (
                                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                            {t("list.widgetSource")}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}
