"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  MessageCircle,
  Minimize2,
  Paperclip,
  Send,
  WifiOff,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";

type ThemePreset = "ocean" | "violet" | "sunset";

interface WidgetMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWidgetProps {
  harborId?: string;
  harborName?: string;
  locationId?: number;
  accentColor?: string;
  themePreset?: ThemePreset;
  colorSettings?: Partial<WidgetColors>;
  isEmbedded?: boolean;
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

const quickPrompts = [
  "I need details for this boat",
  "Can I schedule a viewing?",
  "Do you support this harbor?",
];

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

// ── Chat Body Sub-Component ────────────────────────────────────────

function ChatBody({
  messages,
  onSend,
  typing,
  colors,
  harborName,
  sending,
}: {
  messages: WidgetMessage[];
  onSend: (text: string) => void;
  typing: boolean;
  colors: WidgetColors;
  harborName?: string;
  sending: boolean;
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = () => {
    const value = input.trim();
    if (!value || sending) return;
    onSend(value);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-white font-sans" style={{ fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
      <div className="border-b border-slate-200/80 px-4 py-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Quick prompts
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              disabled={sending}
              className="rounded-full border px-3 py-1.5 text-xs transition hover:opacity-85 disabled:opacity-50"
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
              onClick={() => onSend(`I need support for ${harborName}`)}
              disabled={sending}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              Support for {harborName}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[84%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                msg.isUser
                  ? "rounded-br-sm text-white shadow-md"
                  : "rounded-bl-sm border border-slate-200 bg-white text-slate-800",
              )}
              style={
                msg.isUser
                  ? {
                    background: `linear-gradient(140deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                  }
                  : undefined
              }
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  msg.isUser ? "text-white/70" : "text-slate-400",
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
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Attach file"
          >
            <Paperclip size={14} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            disabled={sending}
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-white transition",
              input.trim() && !sending
                ? "shadow-md hover:translate-y-[-1px]"
                : "cursor-not-allowed bg-slate-300",
            )}
            style={
              input.trim() && !sending
                ? {
                  background: `linear-gradient(130deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                }
                : undefined
            }
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────

export function ChatWidget({
  harborId,
  harborName,
  locationId,
  accentColor,
  themePreset = "ocean",
  colorSettings,
  isEmbedded,
}: ChatWidgetProps) {
  const { isOnline } = useNetworkStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "init",
      isUser: false,
      text: "Hi there! How can we help you today? Ask us about boats, harbors, or support.",
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
    setGuestName(null);
    setMessages([
      {
        id: "init",
        isUser: false,
        text: "Hi there! How can we help you today? Ask us about boats, harbors, or support.",
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

        const response = await publicApi<{
          lead: { id: number; name: string | null };
          conversation: { id: string };
          message: { id: string };
        }>("POST", "/public/leads", {
          location_id: locationId ?? 1,
          source_url:
            typeof window !== "undefined" ? window.location.href : undefined,
          message: text,
          client_message_id: clientMessageId,
        });

        setConversationId(response.conversation.id);

        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isUser: false,
            text: "Thanks! Your message has been received. A support agent will respond shortly.",
            timestamp: new Date(),
          },
        ]);
      } else {
        // Subsequent messages: send to existing conversation
        const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        await publicApi(
          "POST",
          `/public/conversations/${conversationId}/messages`,
          {
            body: text,
            client_message_id: clientMessageId,
          },
        );

        // Add confirmation
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isUser: false,
            text: "Message sent. Our team will get back to you soon.",
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
          text: "Sorry, we couldn't send your message right now. Please try again.",
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
            aria-label="Open chat"
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

          <div className="fixed inset-x-3 bottom-3 top-16 z-50 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-[120px] sm:w-[440px] sm:h-[750px] sm:rounded-[32px]">
            <div
              className="relative flex items-center justify-between overflow-hidden px-6 py-5 text-white"
              style={{
                background: `linear-gradient(140deg, ${colors.headerStart}, ${colors.headerEnd})`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                  <MessageCircle size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold leading-tight">
                    {harborName || "NauticSecure"}
                  </h4>
                  <p className="text-[11px] text-white/70">
                    {conversationId ? "Connected to support" : "Online support"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    resetChat();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
                  aria-label="Close and reset chat"
                >
                  <X size={15} />
                </button>
              </div>

              <svg
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-7 w-full text-white"
                viewBox="0 0 400 60"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 40 C 90 70, 220 8, 400 36 L 400 60 L 0 60 Z"
                  fill="currentColor"
                  fillOpacity="0.92"
                />
              </svg>
            </div>

            <div className="h-[calc(100%-52px)]">
              {!isOnline ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <WifiOff size={28} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    No internet connection
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Please check your connection and try again. We&rsquo;ll be
                    here when you&rsquo;re back online.
                  </p>
                </div>
              ) : (
                <ChatBody
                  messages={messages}
                  onSend={handleSendMessage}
                  typing={sending}
                  colors={colors}
                  harborName={harborName}
                  sending={sending}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
