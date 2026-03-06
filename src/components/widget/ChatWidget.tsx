"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Minimize2,
  Paperclip,
  Send,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

type Step = "intro" | "chat";
type ThemePreset = "ocean" | "violet" | "sunset";

interface PreChatFormData {
  name: string;
  email: string;
  phone: string;
  harbor: string;
}

interface WidgetMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWidgetProps {
  harborId?: string;
  harborName?: string;
  accentColor?: string;
  themePreset?: ThemePreset;
  colorSettings?: Partial<WidgetColors>;
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

function getSupportReply(input: string, harborName?: string) {
  const normalized = input.toLowerCase();
  if (normalized.includes("viewing") || normalized.includes("visit")) {
    return "Yes. Share your preferred date and time, and we will confirm availability for you.";
  }
  if (normalized.includes("price") || normalized.includes("offer")) {
    return "We can help with pricing and offer steps. Tell us the boat or harbor page you are viewing right now.";
  }
  if (normalized.includes("harbor") && harborName) {
    return `Yes, we support ${harborName}. We can guide you through onboarding or listing updates.`;
  }
  return "Thanks, your message is received. A support agent will reply shortly with the next step.";
}

function PreChatForm({
  onSubmit,
  colors,
}: {
  onSubmit: (data: PreChatFormData) => void;
  colors: WidgetColors;
}) {
  const [form, setForm] = useState<PreChatFormData>({
    name: "",
    email: "",
    phone: "",
    harbor: "",
  });

  const canSubmit = form.name.trim() && form.email.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(form);
      }}
      className="flex h-full flex-col"
    >
      <div className="bg-slate-950 px-5 py-6 text-white">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg"
            style={{
              background: `linear-gradient(140deg, ${colors.headerStart}, ${colors.headerEnd})`,
            }}
          >
            <MessageCircle size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/65">
              NauticSecure Support
            </p>
            <h3 className="text-base font-semibold leading-tight">
              Start a conversation
            </h3>
          </div>
        </div>
        <p className="text-sm text-white/70">
          Ask anything about boats, harbors, listings, or onboarding.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-white px-5 py-5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Name
          </span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your full name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Email
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Phone (optional)
          </span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+31 6 1234 5678"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Harbor (optional)
          </span>
          <select
            value={form.harbor}
            onChange={(e) => setForm({ ...form, harbor: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
          >
            <option value="">Select harbor...</option>
            <option value="HISWA-4401">Harbor One Marina</option>
            <option value="HISWA-2234">Zeeland Jachthaven</option>
            <option value="HISWA-1102">IJmuiden Port</option>
          </select>
        </label>
      </div>

      <div className="border-t border-slate-100 bg-white px-5 py-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition",
            canSubmit
              ? "shadow-lg hover:translate-y-[-1px]"
              : "cursor-not-allowed bg-slate-300",
          )}
          style={
            canSubmit
              ? {
                background: `linear-gradient(130deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
              }
              : undefined
          }
        >
          Continue to chat
        </button>
      </div>
    </form>
  );
}

function ChatBody({
  messages,
  onSend,
  typing,
  colors,
  harborName,
}: {
  messages: WidgetMessage[];
  onSend: (text: string) => void;
  typing: boolean;
  colors: WidgetColors;
  harborName?: string;
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = () => {
    const value = input.trim();
    if (!value) return;
    onSend(value);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-50 to-white">
      <div className="border-b border-slate-200/80 px-4 py-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Quick prompts
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              className="rounded-full border px-3 py-1.5 text-xs transition hover:opacity-85"
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
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700 transition hover:bg-sky-100"
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
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-white transition",
              input.trim()
                ? "shadow-md hover:translate-y-[-1px]"
                : "cursor-not-allowed bg-slate-300",
            )}
            style={
              input.trim()
                ? {
                  background: `linear-gradient(130deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                }
                : undefined
            }
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatWidget({
  harborId,
  harborName,
  accentColor,
  themePreset = "ocean",
  colorSettings,
}: ChatWidgetProps) {
  const { isOnline } = useNetworkStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("chat");
  const [guestInfo, setGuestInfo] = useState<PreChatFormData | null>({
    name: "sa",
    email: "sa@example.com",
    phone: "",
    harbor: "",
  });
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "init",
      isUser: false,
      text: "Hi sa, welcome. I can help with boats, harbors, or support requests.",
      timestamp: new Date(),
    },
  ]);

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
    setTyping(false);
    setMessages([
      {
        id: "init",
        isUser: false,
        text: "Hi sa, welcome. I can help with boats, harbors, or support requests.",
        timestamp: new Date(),
      },
    ]);
  };

  const handleIntroSubmit = (data: PreChatFormData) => {
    setGuestInfo(data);
    setStep("chat");
    setMessages([
      {
        id: `sys-${Date.now()}`,
        isUser: false,
        text: `Hi ${data.name}, welcome. I can help with boats, harbors, or support requests${harborId ? ` (context: ${harborId})` : ""}.`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSendMessage = (text: string) => {
    const userMessage: WidgetMessage = {
      id: `u-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          text: getSupportReply(text, harborName),
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      setTyping(false);
    }, 900);
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
            <MessageCircle size={22} className="transition group-hover:scale-110" />
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

          <div className="fixed inset-x-3 bottom-3 top-16 z-50 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[620px] sm:w-[390px] sm:rounded-2xl">
            <div
              className="relative flex items-center justify-between overflow-hidden px-4 py-3 text-white"
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
                    {guestInfo?.name
                      ? `Chatting as ${guestInfo.name}`
                      : "Online support"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
                  aria-label="Minimize chat"
                >
                  <Minimize2 size={15} />
                </button>
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
                    Please check your connection and try again.
                    We&rsquo;ll be here when you&rsquo;re back online.
                  </p>
                </div>
              ) : (
                <ChatBody
                  messages={messages}
                  onSend={handleSendMessage}
                  typing={typing}
                  colors={colors}
                  harborName={harborName}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
