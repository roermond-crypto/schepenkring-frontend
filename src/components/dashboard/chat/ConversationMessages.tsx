"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Phone,
  Video,
  Info,
  Loader2,
  Languages,
  StickyNote,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import type {
  ContactInfo,
  Conversation,
  ConversationStatus,
  SupportMessage,
} from "@/types/chat";
import { cn } from "@/lib/utils";
import { translateSupportMessage } from "@/lib/chat-api";

interface ConversationMessagesProps {
  conversation: Conversation;
  contact: ContactInfo | null;
  messages: SupportMessage[];
  loading: boolean;
  onSendMessage: (
    text: string,
    attachments?: File[],
    isInternalNote?: boolean,
  ) => void;
  onStartCall: (phoneNumber: string) => Promise<void>;
  onStatusChange: (status: ConversationStatus) => void;
  onOpenDetails?: () => void;
  aiSummary?: string;
  messageFilter?: "all" | "chat" | "system" | "signhost";
  onMessageFilterChange?: (filter: "all" | "chat" | "system" | "signhost") => void;
}

function StatusBadge({
  status,
  onClick,
  t,
}: {
  status: ConversationStatus;
  onClick?: () => void;
  t: (key: string) => string;
}) {
  const config: Record<
    ConversationStatus,
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    open: {
      label: t("messages.status.open"),
      bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
      text: "text-emerald-700",
      icon: <AlertCircle size={12} />,
    },
    pending: {
      label: t("messages.status.pending"),
      bg: "bg-amber-50 border-amber-200 hover:bg-amber-100",
      text: "text-amber-700",
      icon: <Clock size={12} />,
    },
    solved: {
      label: t("messages.status.solved"),
      bg: "bg-slate-50 border-slate-200 hover:bg-slate-100",
      text: "text-slate-600",
      icon: <CheckCircle2 size={12} />,
    },
    archived: {
      label: t("messages.status.archived"),
      bg: "bg-slate-50 border-slate-200 hover:bg-slate-100",
      text: "text-slate-400",
      icon: <CheckCircle2 size={12} />,
    },
  };
  const c = config[status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
        c.bg,
        c.text,
      )}
    >
      {c.icon}
      {c.label}
    </button>
  );
}

function SystemEventBubble({ message }: { message: SupportMessage }) {
  const t = useTranslations("DashboardChat");
  const bookingId =
    typeof message.metadata?.booking_id === "number" ||
    typeof message.metadata?.booking_id === "string"
      ? String(message.metadata.booking_id)
      : null;

  return (
    <div className="flex justify-center my-4">
      <div className="max-w-[85%] rounded-2xl border border-slate-200/70 bg-slate-100/80 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
            <Bot size={11} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {bookingId ? t("messages.bookingEvent") : t("messages.systemEvent")}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium leading-6 text-slate-700">
          {message.text}
        </p>
        {bookingId ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700">
            <CalendarDays size={12} />
            {t("messages.bookingReference", { id: bookingId })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageBubbleItem({
  message,
  isAdmin,
}: {
  message: SupportMessage;
  isAdmin: boolean;
}) {
  const t = useTranslations("DashboardChat");
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isInternalNote = Boolean(message.is_internal_note);

  return (
    <div
      className={cn(
        "flex gap-3 mb-4 group",
        isAdmin ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {message.sender_avatar ? (
          <img
            src={message.sender_avatar}
            alt={message.sender_name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ) : (
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm",
              isInternalNote
                ? "bg-gradient-to-br from-amber-400 to-amber-500"
                : isAdmin
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                  : "bg-gradient-to-br from-slate-300 to-slate-400",
            )}
          >
            <span className="text-white text-xs font-bold">
              {message.sender_name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex flex-col max-w-[65%]",
          isAdmin ? "items-end" : "items-start",
        )}
      >
        <span
          className={cn(
            "text-[11px] font-semibold mb-1 px-1 inline-flex items-center gap-1",
            isInternalNote
              ? "text-amber-700"
              : isAdmin
                ? "text-blue-600"
                : "text-slate-500",
          )}
        >
          {message.sender_name}
          {isInternalNote && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              <StickyNote size={9} />
              {t("messages.internalNoteBadge")}
            </span>
          )}
        </span>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm",
            isInternalNote
              ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-br-md"
              : isAdmin
                ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md"
                : "bg-white border border-slate-200/80 text-slate-800 rounded-bl-md",
          )}
        >
          {message.message_type === "call" && (
            <div
              className={cn(
                "mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                isAdmin
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              <Phone size={10} />
              {t("messages.callAction")}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.text}</p>

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url || "#"}
                  target={att.url ? "_blank" : undefined}
                  rel={att.url ? "noreferrer" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                    isAdmin
                      ? "bg-white/20"
                      : "bg-slate-50 border border-slate-200",
                    att.url
                      ? "hover:opacity-80 transition-opacity"
                      : "pointer-events-none",
                  )}
                >
                  <Paperclip size={12} />
                  <span className="truncate">{att.name}</span>
                  <span className="text-[10px] text-inherit/60">
                    {Math.round(att.size / 1024)}KB
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Time + read status */}
        <div
          className={cn(
            "flex items-center gap-1.5 mt-1 px-1",
            isAdmin ? "flex-row-reverse" : "flex-row",
          )}
        >
          <span className="text-[10px] text-slate-400">{time}</span>
          {isAdmin && message.read_at && (
            <CheckCircle2 size={10} className="text-blue-400" />
          )}
        </div>
      </div>
    </div>
  );
}

export function ConversationMessages({
  conversation,
  contact,
  messages,
  loading,
  onSendMessage,
  onStartCall,
  onStatusChange,
  onOpenDetails,
  aiSummary,
  messageFilter = "all",
  onMessageFilterChange,
}: ConversationMessagesProps) {
  const t = useTranslations("DashboardChat");
  const locale = useLocale();
  const [input, setInput] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [callStarting, setCallStarting] = useState(false);
  const [callError, setCallError] = useState("");
  const [translateTarget, setTranslateTarget] = useState("en");
  const [translateError, setTranslateError] = useState("");
  const [translating, setTranslating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const phoneNumber = contact?.phone || conversation.guest_phone || "";

  const visibleMessages = messages.filter((message) => {
    const roleVisibility = message.metadata?.role_visibility;
    if (Array.isArray(roleVisibility) && roleVisibility.length > 0) {
      if (!roleVisibility.includes("admin") && !roleVisibility.includes("employee")) {
        return false;
      }
    }

    const text = String(message.text ?? "").toLowerCase();
    if (messageFilter === "signhost") {
      return text.includes("signhost") || text.includes("contract") || text.includes("transaction");
    }
    if (messageFilter === "system") {
      return (
        message.sender_type === "system" ||
        String(message.message_type ?? "") === "system"
      );
    }
    if (messageFilter === "chat") {
      return (
        message.sender_type !== "system" &&
        String(message.message_type ?? "") !== "system" &&
        !text.includes("signhost")
      );
    }
    return true;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input, undefined, isInternalNote);
    setInput("");
    setIsInternalNote(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (translateError) {
      setTranslateError("");
    }
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleTranslate = async () => {
    const text = input.trim();
    if (!text || translating) return;

    setTranslating(true);
    setTranslateError("");

    try {
      const response = await translateSupportMessage(
        conversation.id,
        text,
        translateTarget,
        `${locale}-${locale.toUpperCase()}`,
      );
      setInput(response.translated_text);

      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
      }
    } catch (error) {
      console.error(error);
      setTranslateError(t("messages.translateFailed"));
    } finally {
      setTranslating(false);
    }
  };

  const cycleStatus = () => {
    // Archived is a deliberate, separate action (see handleArchive) — the
    // badge's quick-toggle only cycles between the two active working
    // states. Clicking it while archived restores the conversation to open
    // rather than routing it back into "solved".
    if (conversation.status === "archived") {
      onStatusChange("open");
      return;
    }
    const next: ConversationStatus =
      conversation.status === "solved" ? "open" : "solved";
    onStatusChange(next);
  };

  const handleArchive = () => {
    onStatusChange(
      conversation.status === "archived" ? "open" : "archived",
    );
  };

  const handleStartCall = async () => {
    if (!phoneNumber || callStarting) return;

    setCallStarting(true);
    setCallError("");

    try {
      await onStartCall(phoneNumber);
    } catch (error) {
      console.error(error);
      setCallError(t("messages.callFailed"));
    } finally {
      setCallStarting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          {conversation.contact_avatar ? (
            <img
              src={conversation.contact_avatar}
              alt={conversation.contact_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-md"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center ring-2 ring-white shadow-md">
              <span className="text-white font-bold">
                {conversation.contact_name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {conversation.contact_name}
            </h2>
            <p className="text-xs text-slate-500">
              {conversation.contact_company ?? conversation.guest_email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            status={conversation.status}
            onClick={cycleStatus}
            t={t}
          />
          <button
            type="button"
            onClick={handleArchive}
            title={
              conversation.status === "archived"
                ? t("messages.unarchiveAction")
                : t("messages.archiveAction")
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            {conversation.status === "archived" ? (
              <ArchiveRestore size={14} className="text-slate-500" />
            ) : (
              <Archive size={14} className="text-slate-500" />
            )}
          </button>
          <button
            type="button"
            onClick={handleStartCall}
            disabled={!phoneNumber || callStarting}
            title={
              !phoneNumber
                ? t("messages.callUnavailable")
                : t("messages.callAction")
            }
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
              phoneNumber && !callStarting
                ? "bg-emerald-50 hover:bg-emerald-100"
                : "bg-slate-100 cursor-not-allowed",
            )}
          >
            {callStarting ? (
              <Loader2 size={14} className="animate-spin text-emerald-600" />
            ) : (
              <Phone
                size={14}
                className={phoneNumber ? "text-emerald-600" : "text-slate-400"}
              />
            )}
          </button>
          <button className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <Video size={14} className="text-slate-500" />
          </button>
          <button
            type="button"
            onClick={onOpenDetails}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <Info size={14} className="text-slate-500" />
          </button>
        </div>
      </div>

      {(aiSummary || onMessageFilterChange) && (
        <div className="border-b border-slate-200/60 bg-white px-6 py-3">
          {aiSummary ? (
            <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <span className="font-semibold">{t("messages.aiSummary")}: </span>
              {aiSummary}
            </p>
          ) : null}
          {onMessageFilterChange ? (
            <div className="flex flex-wrap gap-2">
              {(["all", "chat", "system", "signhost"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => onMessageFilterChange(filter)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    messageFilter === filter
                      ? "bg-[#0B1F3A] text-white"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {t(`messages.filters.${filter}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  i % 2 === 0 ? "flex-row-reverse" : "",
                )}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                <div
                  className={cn(
                    "space-y-2",
                    i % 2 === 0 ? "items-end" : "items-start",
                  )}
                >
                  <div className="h-3 bg-slate-200 rounded w-20 animate-pulse" />
                  <div className="h-16 bg-slate-200 rounded-2xl w-64 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Date separator */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t("messages.today")}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {visibleMessages.map((msg) =>
              msg.sender_type === "system" || msg.sender_type === "ai" ? (
                <SystemEventBubble key={msg.id} message={msg} />
              ) : (
                <MessageBubbleItem
                  key={msg.id}
                  message={msg}
                  isAdmin={msg.sender_type === "admin"}
                />
              ),
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-5 py-4 bg-white/80 backdrop-blur-xl border-t border-slate-200/60">
        {callError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {callError}
          </div>
        )}
        {translateError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {translateError}
          </div>
        )}
        {/* AI suggestion bar */}
        <div className="flex items-center gap-2 mb-3">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 text-xs font-semibold text-violet-700 hover:from-violet-100 hover:to-purple-100 transition-all">
            <Bot size={12} />
            {t("messages.aiDraftReply")}
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            {t("messages.summarize")}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Languages size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">
              {t("messages.translateTo")}
            </span>
            <select
              value={translateTarget}
              onChange={(e) => setTranslateTarget(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="en">{t("messages.languages.en")}</option>
              <option value="nl">{t("messages.languages.nl")}</option>
              <option value="de">{t("messages.languages.de")}</option>
              <option value="fr">{t("messages.languages.fr")}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleTranslate}
            disabled={!input.trim() || translating}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
              input.trim() && !translating
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            )}
          >
            {translating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Languages size={13} />
            )}
            {translating
              ? t("messages.translating")
              : t("messages.translateButton")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* Attachment button */}
          <div className="flex gap-1">
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <Paperclip size={16} className="text-slate-500" />
            </button>
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <ImageIcon size={16} className="text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => setIsInternalNote((prev) => !prev)}
              aria-pressed={isInternalNote}
              title={t("messages.internalNoteToggle")}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isInternalNote
                  ? "bg-amber-400 text-white hover:bg-amber-500"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              <StickyNote size={16} />
            </button>
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isInternalNote
                  ? t("messages.typePlaceholderInternalNote")
                  : t("messages.typePlaceholder")
              }
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border-0 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all",
                isInternalNote
                  ? "bg-amber-50 text-amber-900 focus:ring-amber-400/40 focus:bg-amber-50"
                  : "bg-slate-100/80 text-slate-800 focus:ring-blue-500/30 focus:bg-white",
              )}
              style={{ minHeight: 42, maxHeight: 120 }}
            />
          </div>

          {/* Emoji */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <Smile size={16} className="text-slate-500" />
          </button>

          {/* Send */}
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
              !input.trim()
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : isInternalNote
                  ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-500/30 hover:shadow-amber-500/40 hover:scale-105"
                  : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-105",
            )}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
