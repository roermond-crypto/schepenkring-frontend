"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  MessageCircle,
  Minimize2,
  Send,
  WifiOff,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { AuctionWidgetBody } from "@/components/widget/AuctionWidgetBody";

type ThemePreset = "ocean" | "violet" | "sunset";

interface WidgetMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface PublicLeadResponse {
  conversation?: { id: string };
  ai_message?: {
    id: string;
    text?: string | null;
    body?: string | null;
  } | null;
}

interface PublicConversationAskResponse {
  conversation?: { id: string };
  ai_message?: {
    id: string;
    text?: string | null;
    body?: string | null;
  } | null;
}

interface ChatWidgetProps {
  harborId?: string;
  harborName?: string;
  boatId?: number;
  locationId?: number;
  accentColor?: string;
  themePreset?: ThemePreset;
  colorSettings?: Partial<WidgetColors>;
  sourceUrl?: string;
  welcomeText?: string;
  isEmbedded?: boolean;
  locale?: string;
}

interface WidgetColors {
  launcherStart: string;
  launcherEnd: string;
  headerStart: string;
  headerEnd: string;
  userBubbleStart: string;
  userBubbleEnd: string;
  quickChipBg: string;
  quickChipBorder: string;
  quickChipText: string;
}

const THEME_PRESETS: Record<ThemePreset, WidgetColors> = {
  ocean: {
    launcherStart: "#2563eb",
    launcherEnd: "#22d3ee",
    headerStart: "#2563eb",
    headerEnd: "#22d3ee",
    userBubbleStart: "#2563eb",
    userBubbleEnd: "#22d3ee",
    quickChipBg: "#eff6ff",
    quickChipBorder: "#bfdbfe",
    quickChipText: "#1d4ed8",
  },
  violet: {
    launcherStart: "#4f46e5",
    launcherEnd: "#7c3aed",
    headerStart: "#4f46e5",
    headerEnd: "#7c3aed",
    userBubbleStart: "#4f46e5",
    userBubbleEnd: "#7c3aed",
    quickChipBg: "#f5f3ff",
    quickChipBorder: "#ddd6fe",
    quickChipText: "#5b21b6",
  },
  sunset: {
    launcherStart: "#fb7185",
    launcherEnd: "#fb923c",
    headerStart: "#fb7185",
    headerEnd: "#fb923c",
    userBubbleStart: "#fb7185",
    userBubbleEnd: "#fb923c",
    quickChipBg: "#fff1f2",
    quickChipBorder: "#fecdd3",
    quickChipText: "#be123c",
  },
};

// ── Public API helper (no auth needed) ─────────────────────────────
const PUBLIC_API_BASE =
  normalizeApiBaseUrl(
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_API_URL
      : process.env.BACKEND_API_URL) ?? "https://app.schepen-kring.nl/api",
  );

async function publicApi<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[ChatWidget] API error:", res.status, err);
    throw new Error(err.message || `API ${res.status}`);
  }

  return res.json();
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") {
    return `visitor-${Date.now()}`;
  }

  const storageKey = "nauticsecure_widget_visitor_id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const created = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

// ── Chat Body Sub-Component ────────────────────────────────────────

function ChatBody({
  messages,
  onSend,
  typing,
  colors,
  harborName,
  sending,
  locale: _locale,
}: {
  messages: WidgetMessage[];
  onSend: (text: string) => void;
  typing: boolean;
  colors: WidgetColors;
  harborName?: string;
  sending: boolean;
  locale?: string;
}) {
  void _locale;
  const t = useTranslations("WidgetChat");
  const [input, setInput] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasUserMessages = messages.some((message) => message.isUser);
  const showWelcomePanel = !hasUserMessages;
  const visibleMessages = messages.filter((message) => message.id !== "init");
  const quickPrompts = [
    t("quickPrompts.details"),
    t("quickPrompts.viewing"),
    t("quickPrompts.harbor"),
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [input]);

  const handleSend = () => {
    const value = input.trim();
    if (!value || sending) return;
    onSend(value);
    setInput("");
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.72),_rgba(248,250,252,0.98)_42%,_#ffffff_100%)] text-slate-900"
      style={{ fontFamily: '"Manrope", "Inter", sans-serif' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
      `}</style>
      <div className="border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl">
        {showWelcomePanel ? (
          <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{
                  background: `linear-gradient(145deg, ${colors.headerStart}, ${colors.headerEnd})`,
                }}
              >
                <MessageCircle size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/70">
                  {t("welcome.kicker")}
                </p>
                <h5 className="mt-1 text-sm font-bold text-slate-900">
                  {t("welcome.title")}
                </h5>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {t("welcome.description")}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("welcome.quickPrompts")}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => onSend(prompt)}
                    disabled={sending}
                    className="shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-50"
                    style={{
                      borderColor: colors.quickChipBorder,
                      background: colors.quickChipBg,
                      color: colors.quickChipText,
                    }}
                  >
                    {prompt}
                  </button>
                ))}
                {harborName && (
                  <button
                    onClick={() =>
                      onSend(t("quickPrompts.harborSupport", { harborName }))
                    }
                    disabled={sending}
                    className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {t("quickPrompts.harborSupport", { harborName })}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1">
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("status.supportOnline")}
            </div>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSend(prompt)}
                disabled={sending}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3 pb-2">
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[86%] rounded-[24px] px-4 py-3 text-[13px] leading-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]",
                  msg.isUser
                    ? "rounded-br-md text-white"
                    : "rounded-bl-md border border-white/90 bg-white/92 text-slate-800",
                )}
                style={
                  msg.isUser
                    ? {
                      background: `linear-gradient(145deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                    }
                    : undefined
                }
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <p
                  className={cn(
                    "mt-1.5 text-[10px] font-medium",
                    msg.isUser ? "text-white/72" : "text-slate-400",
                  )}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-1 rounded-full border border-white/90 bg-white/92 px-3.5 py-2.5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.4)]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-slate-200/80 bg-white/82 px-4 py-4 backdrop-blur-xl">
        <div
          className={cn(
            "rounded-[30px] border bg-white px-3 py-3 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)] transition",
            composerFocused
              ? "border-sky-300 shadow-[0_24px_60px_-28px_rgba(37,99,235,0.24)]"
              : "border-slate-200",
          )}
        >
          <div className="flex items-end gap-3">
            <div
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: `linear-gradient(145deg, ${colors.headerStart}, ${colors.headerEnd})`,
              }}
            >
              <MessageCircle size={17} />
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("composer.placeholder")}
              disabled={sending}
              rows={1}
              className="max-h-[140px] min-h-[52px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] font-medium leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition",
                input.trim() && !sending
                  ? "shadow-lg hover:-translate-y-0.5"
                  : "cursor-not-allowed bg-slate-300 shadow-none",
              )}
              style={
                input.trim() && !sending
                  ? {
                    background: `linear-gradient(135deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                  }
                  : undefined
              }
              aria-label={t("composer.sendAria")}
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              {t("composer.enterToSend")}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              {sending ? t("composer.sending") : t("composer.encrypted")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────

export function ChatWidget({
  harborName,
  boatId,
  locationId,
  accentColor,
  themePreset = "ocean",
  colorSettings,
  welcomeText,
  sourceUrl,
  isEmbedded,
  locale: localeOverride,
}: ChatWidgetProps) {
  const t = useTranslations("WidgetChat");
  const routeLocale = useLocale();
  const locale = localeOverride || routeLocale;
  const { isOnline } = useNetworkStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const visitorIdRef = useRef<string>(getOrCreateVisitorId());
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "init",
      isUser: false,
      text: welcomeText || t("initialMessage"),
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    if (isEmbedded && typeof window !== "undefined") {
      window.parent.postMessage(
        {
          type: "CHAT_WIDGET_STATE",
          isOpen,
          isMobile: window.innerWidth < 640,
        },
        "*"
      );
    }
  }, [isOpen, isEmbedded]);

  const colors = useMemo<WidgetColors>(() => {
    const base = THEME_PRESETS[themePreset];
    const fromAccent = accentColor
      ? {
        launcherStart: accentColor,
        headerStart: accentColor,
        userBubbleStart: accentColor,
      }
      : {};
    return { ...base, ...fromAccent, ...colorSettings };
  }, [accentColor, colorSettings, themePreset]);

  const widgetStyle = useMemo(
    () =>
      ({
        "--widget-primary": colors.launcherStart,
      }) as CSSProperties,
    [colors.launcherStart],
  );

  const resetChat = () => {
    setSending(false);
    setConversationId(null);
    setMessages([
      {
        id: "init",
        isUser: false,
        text: welcomeText || t("initialMessage"),
        timestamp: new Date(),
      },
    ]);
  };

  const handleSendMessage = async (text: string) => {
    // Add user message to UI immediately
    const userMessage: WidgetMessage = {
      id: `u-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      if (!conversationId) {
        // First message: create lead + conversation + initial message
        const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const response = await publicApi<PublicLeadResponse>("POST", "/public/leads", {
          location_id: locationId ?? 1,
          source_url: sourceUrl || (typeof window !== "undefined" ? window.location.href : undefined),
          message: text,
          client_message_id: clientMessageId,
          visitor_id: visitorIdRef.current,
        });

        if (response.conversation?.id) {
          setConversationId(response.conversation.id);
        }

        const aiText =
          response.ai_message?.text?.trim() || response.ai_message?.body?.trim();

        setMessages((prev) => [
          ...prev,
          {
            id: response.ai_message?.id ?? `sys-${Date.now()}`,
            isUser: false,
            text: aiText || t("system.firstReply"),
            timestamp: new Date(),
          },
        ]);
      } else {
        // Subsequent messages: send to existing conversation
        const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const response = await publicApi<PublicConversationAskResponse>(
          "POST",
          `/public/conversations/${conversationId}/ask`,
          {
            body: text,
            client_message_id: clientMessageId,
            visitor_id: visitorIdRef.current,
          },
        );

        const aiText =
          response.ai_message?.text?.trim() || response.ai_message?.body?.trim();

        setMessages((prev) => [
          ...prev,
          {
            id: response.ai_message?.id ?? `sys-${Date.now()}`,
            isUser: false,
            text: aiText || t("system.sentReply"),
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("[ChatWidget] Send failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          isUser: false,
          text: t("system.sendFailed"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={widgetStyle}>
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-2xl transition hover:scale-[1.04]"
            style={{
              background: `linear-gradient(140deg, ${colors.launcherStart}, ${colors.launcherEnd})`,
            }}
            aria-label={t("aria.open")}
          >
            <MessageCircle
              size={22}
              className="transition group-hover:scale-110"
            />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
          </button>
        </div>
      )}

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-slate-950/35 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat backdrop"
          />

          <div className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[calc(100vh-9rem)] sm:max-h-[720px] sm:w-[430px]">
            <div
              className="relative overflow-hidden border-b border-white/15 px-5 py-5 text-white"
              style={{
                background: `linear-gradient(140deg, ${colors.headerStart}, ${colors.headerEnd})`,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.22),_transparent_38%)]" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/25 backdrop-blur">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold leading-tight">
                      {harborName || t("brand")}
                    </h4>
                    <p className="mt-1 text-[11px] text-white/78">
                      {boatId
                        ? t("header.auctionWidget")
                        : conversationId
                          ? t("header.conversationActive")
                          : t("header.onlineSupport")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                      <span className="rounded-full bg-white/14 px-2.5 py-1 backdrop-blur">
                        {boatId
                          ? t("header.boat", { boatId })
                          : conversationId
                            ? t("header.connected")
                            : t("header.supportOnline")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-white/75">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {t("header.encrypted")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/14 transition hover:bg-white/24"
                    aria-label={t("aria.minimize")}
                  >
                    <Minimize2 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      resetChat();
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950/18 transition hover:bg-slate-950/28"
                    aria-label={t("aria.closeReset")}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {!isOnline ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <WifiOff size={28} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {t("offline.title")}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {t("offline.description")}
                  </p>
                </div>
              ) : (
                boatId ? (
                  <AuctionWidgetBody
                    boatId={boatId}
                    locationId={locationId}
                    colors={colors}
                    locale={locale}
                  />
                ) : (
                  <ChatBody
                    messages={messages}
                    onSend={handleSendMessage}
                    typing={sending}
                    colors={colors}
                    harborName={harborName}
                    sending={sending}
                    locale={locale}
                  />
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
