"use client"

import { useTranslations } from "next-intl"
import {
    X,
    Mail,
    Phone,
    MapPin,
    Building2,
    FileText,
    Image as ImageIcon,
    Download,
    Clock,
    CheckCircle2,
    AlertCircle,
    Zap,
    Globe,
    ExternalLink,
} from "lucide-react"
import type { Conversation, ContactInfo, Attachment, SystemEvent } from "@/types/chat"
import { cn } from "@/lib/utils"

interface ContactDetailPanelProps {
    contact: ContactInfo | null
    conversation: Conversation
    onClose: () => void
}

function formatFileSize(bytes: number) {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${Math.round(bytes / 1024)} KB`
}

function formatEventTime(date: Date) {
    return new Date(date).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getEventIcon(type: string) {
    switch (type) {
        case "harbor_claim":
            return <Zap size={12} className="text-blue-500" />
        case "verification_sent":
            return <Mail size={12} className="text-indigo-500" />
        case "error_detected":
            return <AlertCircle size={12} className="text-red-500" />
        case "harbor_live":
            return <CheckCircle2 size={12} className="text-emerald-500" />
        default:
            return <Clock size={12} className="text-slate-400" />
    }
}

export function ContactDetailPanel({ contact, conversation, onClose }: ContactDetailPanelProps) {
    const t = useTranslations("DashboardChat")
    if (!contact) {
        return (
            <div className="flex items-center justify-center h-full bg-white/70">
                <div className="animate-pulse flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-200" />
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-2.5 w-32 bg-slate-200 rounded" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white/70 backdrop-blur-sm overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("detail.contactInfo")}</h3>
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                    <X size={14} className="text-slate-500" />
                </button>
            </div>

            {/* Profile Card */}
            <div className="px-5 py-6 text-center border-b border-slate-200/60">
                <div className="relative inline-block mb-3">
                    {contact.avatar ? (
                        <img
                            src={contact.avatar}
                            alt={contact.name}
                            className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-lg"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center ring-4 ring-white shadow-lg">
                            <span className="text-white text-2xl font-bold">{contact.name.charAt(0)}</span>
                        </div>
                    )}
                    {contact.status && (
                        <span className={cn(
                            "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-white",
                            contact.status === "online" ? "bg-emerald-500" : contact.status === "away" ? "bg-amber-500" : "bg-slate-400"
                        )} />
                    )}
                </div>
                <h2 className="text-base font-bold text-slate-800">{contact.name}</h2>
                {contact.company && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{contact.company}</p>
                )}
                {contact.status && (
                    <span className={cn(
                        "inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full",
                        contact.status === "online" ? "bg-emerald-50 text-emerald-600" :
                            contact.status === "away" ? "bg-amber-50 text-amber-600" :
                                "bg-slate-100 text-slate-500"
                    )}>
                        {contact.status}
                    </span>
                )}
            </div>

            {/* Contact details */}
            <div className="px-5 py-4 space-y-3 border-b border-slate-200/60">
                {contact.email && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Mail size={14} className="text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t("detail.email")}</p>
                            <p className="text-xs text-slate-700 font-medium truncate">{contact.email}</p>
                        </div>
                    </div>
                )}
                {contact.phone && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Phone size={14} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t("detail.phone")}</p>
                            <p className="text-xs text-slate-700 font-medium">{contact.phone}</p>
                        </div>
                    </div>
                )}
                {contact.location && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <MapPin size={14} className="text-orange-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t("detail.location")}</p>
                            <p className="text-xs text-slate-700 font-medium">{contact.location}</p>
                        </div>
                    </div>
                )}
                {contact.company && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <Building2 size={14} className="text-purple-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t("detail.company")}</p>
                            <p className="text-xs text-slate-700 font-medium">{contact.company}</p>
                        </div>
                    </div>
                )}
                {conversation.context?.page_url && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Globe size={14} className="text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t("detail.sourceUrl")}</p>
                            <a href={conversation.context.page_url} target="_blank" className="text-xs text-blue-600 font-medium truncate block hover:underline">
                                {conversation.context.page_url}
                                <ExternalLink size={10} className="inline ml-1" />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Shared Media & Files */}
            {contact.shared_files.length > 0 && (
                <div className="px-5 py-4 border-b border-slate-200/60">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                        {t("detail.sharedFiles", { count: contact.shared_files.length })}
                    </h4>
                    <div className="space-y-2">
                        {contact.shared_files.map((file) => (
                            <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group">
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                    file.type.startsWith("image/") ? "bg-pink-50" : "bg-blue-50"
                                )}>
                                    {file.type.startsWith("image/") ? (
                                        <ImageIcon size={14} className="text-pink-500" />
                                    ) : (
                                        <FileText size={14} className="text-blue-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                                    <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                                </div>
                                <button className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-white/80 shadow-sm flex items-center justify-center transition-all hover:bg-white">
                                    <Download size={12} className="text-slate-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Activity Timeline */}
            {contact.events.length > 0 && (
                <div className="px-5 py-4">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                        {t("detail.activity")}
                    </h4>
                    <div className="relative">
                        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
                        <div className="space-y-3">
                            {contact.events.map((event) => (
                                <div key={event.id} className="flex items-start gap-3 relative">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0 z-10">
                                        {getEventIcon(event.type)}
                                    </div>
                                    <div className="pt-1">
                                        <p className="text-xs text-slate-700 font-medium">{event.description}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{formatEventTime(event.created_at)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
