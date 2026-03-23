"use client";

import {
  useCallback,
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
  ChevronLeft,
  ChevronRight,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { AuctionWidgetBody } from "@/components/widget/AuctionWidgetBody";
import {
  clearSharedChatState,
  getOrCreateSharedVisitorId,
  getSharedChatStorageKey,
  readSharedChatState,
  type SharedChatMessage,
  writeSharedChatState,
} from "@/lib/chat/shared-public-chat";

type ThemePreset = "ocean" | "violet" | "sunset";
type WidgetMode = "chat" | "smart" | "auction";

interface WidgetMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  provider?: string;
  model?: string | null;
  attachment?: {
    name: string;
    type: string;
    url?: string;
  };
}

interface PublicLeadResponse {
  conversation?: {
    id: string;
    location_id?: number | null;
  };
  ai_message?: {
    id: string;
    text?: string | null;
    body?: string | null;
    metadata?: {
      provider?: string;
      model?: string | null;
    } | null;
  } | null;
}

interface PublicConversationAskResponse {
  conversation?: { id: string };
  ai_message?: {
    id: string;
    text?: string | null;
    body?: string | null;
    metadata?: {
      provider?: string;
      model?: string | null;
    } | null;
  } | null;
}

interface WidgetInitResponse {
  visitor_id?: string;
  session_id?: string;
  session_jwt?: string;
  context?: {
    location?: {
      id?: number;
      name?: string;
      branding?: {
        primary_color?: string | null;
      } | null;
      texts?: {
        welcome?: string | null;
      } | null;
    } | null;
    boat?: {
      id?: number;
      name?: string;
      status?: string;
    } | null;
    tabs_enabled?: string[];
  } | null;
}

interface PublicLocation {
  id: number;
  name?: string | null;
  chat_widget_enabled?: boolean | null;
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
  widgetMode?: WidgetMode;
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

interface CalendarDay {
  date: Date;
  available: boolean;
  isCurrentMonth: boolean;
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
const PUBLIC_API_BASE = normalizeApiBaseUrl(
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

function parsePositiveNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function detectLocationIdFromUserData(): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem("user_data");
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as {
      location_id?: number | string | null;
      locationId?: number | string | null;
      client_location_id?: number | string | null;
      location?: { id?: number | string | null } | null;
      client_location?: { id?: number | string | null } | null;
    };

    const candidates = [
      parsed.location_id,
      parsed.locationId,
      parsed.client_location_id,
      parsed.location?.id,
      parsed.client_location?.id,
    ];

    for (const candidate of candidates) {
      const locationId = parsePositiveNumber(candidate);
      if (locationId) {
        return locationId;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function detectRuntimeLocationId(): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const params = new URLSearchParams(window.location.search);
  const metaLocation =
    document
      .querySelector('meta[name="nauticsecure:location-id"]')
      ?.getAttribute("content") ?? undefined;

  const candidates = [
    params.get("locationId"),
    params.get("location_id"),
    params.get("harborId"),
    document.body?.dataset.locationId,
    document.documentElement?.dataset.locationId,
    metaLocation,
    detectLocationIdFromUserData(),
    window.localStorage.getItem("nauticsecure_widget_location_id"),
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function rememberWidgetLocationId(locationId?: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  const parsed = parsePositiveNumber(locationId ?? undefined);
  if (!parsed) {
    return;
  }

  window.localStorage.setItem(
    "nauticsecure_widget_location_id",
    String(parsed),
  );
}

function serializeWidgetMessages(messages: WidgetMessage[]): SharedChatMessage[] {
  return messages
    .filter((message) => message.id !== "init")
    .map((message) => ({
      id: message.id,
      sender: message.isUser ? "user" : "ai",
      text: message.text,
      createdAt: message.timestamp.toISOString(),
      provider: message.provider,
      model: message.model,
    }));
}

function deserializeWidgetMessages(messages: SharedChatMessage[]): WidgetMessage[] {
  return messages.map((message) => ({
    id: message.id,
    isUser: message.sender === "user",
    text: message.text,
    timestamp: new Date(message.createdAt),
    provider: message.provider,
    model: message.model,
  }));
}

function formatProviderLabel(provider?: string, model?: string | null) {
  if (!provider && !model) {
    return null;
  }

  const normalizedProvider = (provider ?? "ai").toLowerCase();
  const providerLabel =
    normalizedProvider === "openai"
      ? "OpenAI"
      : normalizedProvider === "gemini"
        ? "Gemini"
        : normalizedProvider === "fallback"
          ? "Knowledge fallback"
          : provider ?? "AI";

  return model ? `${providerLabel} · ${model}` : providerLabel;
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
  onSend: (
    text: string,
    attachment?: { name: string; type: string; url?: string },
  ) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    const value = input.trim();
    if ((!value && !selectedFile) || sending) return;
    onSend(
      value,
      selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type,
            url: filePreview || undefined,
          }
        : undefined,
    );
    setInput("");
    handleRemoveFile();
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
              className={cn(
                "flex",
                msg.isUser ? "justify-end" : "justify-start",
              )}
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
                {!msg.isUser && (msg.provider || msg.model) ? (
                  <div className="mb-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {formatProviderLabel(msg.provider, msg.model)}
                    </span>
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.attachment && (
                  <div
                    className={cn(
                      "mt-3 flex items-center gap-3 rounded-2xl px-3 py-2 text-xs",
                      msg.isUser
                        ? "bg-white/15 text-white/85"
                        : "border border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {msg.attachment.type.startsWith("image/") &&
                    msg.attachment.url ? (
                      <img
                        src={msg.attachment.url}
                        alt={msg.attachment.name}
                        className="h-11 w-11 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                        <Paperclip size={15} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {msg.attachment.name}
                      </div>
                      <div
                        className={cn(
                          "text-[10px]",
                          msg.isUser ? "text-white/70" : "text-slate-400",
                        )}
                      >
                        {msg.attachment.type || "file"}
                      </div>
                    </div>
                  </div>
                )}
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
          {selectedFile && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex min-w-0 items-center gap-3">
                {filePreview && selectedFile.type.startsWith("image/") ? (
                  <img
                    src={filePreview}
                    alt={selectedFile.name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500">
                    <Paperclip size={15} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-700">
                    {selectedFile.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: `linear-gradient(145deg, ${colors.headerStart}, ${colors.headerEnd})`,
              }}
            >
              <MessageCircle size={17} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              aria-label="Attach file"
            >
              <Paperclip size={16} />
            </button>
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

function isToday(date: Date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function BookingCalendarTab({
  boatId,
  locationId,
  conversationId,
  locale,
  colors,
  sessionJwt,
}: {
  boatId: number;
  locationId?: number;
  conversationId?: string | null;
  locale?: string;
  colors: WidgetColors;
  sessionJwt?: string | null;
}) {
  const t = useTranslations("WidgetChat");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "processing" | "success"
  >("idle");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const dayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale || "en", {
      weekday: "short",
    });
    const baseSunday = new Date(Date.UTC(2026, 0, 4));
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(baseSunday.getTime() + index * 86400000)),
    );
  }, [locale]);
  const bookingDatesErrorText = t("booking.errors.dates");
  const bookingSlotsErrorText = t("booking.errors.slots");
  const bookingSelectDateTimeText = t("booking.errors.selectDateTime");
  const bookingFillNameEmailText = t("booking.errors.fillNameEmail");
  const bookingSubmitErrorText = t("booking.errors.submit");

  const monthLabel = new Intl.DateTimeFormat(locale || "en", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  useEffect(() => {
    const startDate = new Date(currentMonth);
    startDate.setDate(1);
    const firstDay = startDate.getDay();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let i = 0; i < firstDay; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() - (firstDay - i));
      days.push({ date, available: false, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        available: true,
        isCurrentMonth: true,
      });
    }

    setCalendarDays(days);
    setLoadingDates(false);
  }, [currentMonth]);

  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setSelectedTime(null);
      return;
    }

    if (!locationId) {
      setAvailableSlots([]);
      setSelectedTime(null);
      setBookingMessage(bookingDatesErrorText);
      return;
    }

    setLoadingSlots(true);
    setSelectedTime(null);

    const query = new URLSearchParams({
      date: formatDate(selectedDate),
    });
    void publicApi<{ available_slots?: string[] }>(
      "GET",
      `/public/locations/${locationId}/availability?${query.toString()}`,
    )
      .then((response) => {
        setAvailableSlots(response.available_slots || []);
      })
      .catch(() => {
        setAvailableSlots([]);
        setBookingMessage(bookingSlotsErrorText);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [bookingDatesErrorText, bookingSlotsErrorText, locationId, selectedDate]);

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      setBookingMessage(bookingSelectDateTimeText);
      return;
    }
    if (!bookingForm.name || !bookingForm.email) {
      setBookingMessage(bookingFillNameEmailText);
      return;
    }

    setBookingStatus("processing");
    setBookingMessage(null);

    try {
      await publicApi("POST", `/bookings`, {
        location_id: locationId,
        boat_id: boatId,
        type: "viewing",
        date: formatDate(selectedDate),
        time: selectedTime,
        name: bookingForm.name,
        email: bookingForm.email,
        phone: bookingForm.phone || undefined,
        source: "widget_calendar",
        notes: bookingForm.notes || undefined,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(sessionJwt ? { session_jwt: sessionJwt } : {}),
      });

      setBookingStatus("success");
      setBookingMessage(t("booking.success"));
    } catch (error) {
      setBookingStatus("idle");
      setBookingMessage(
        error instanceof Error ? error.message : bookingSubmitErrorText,
      );
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/70">
          {t("booking.kicker")}
        </p>
        <h5 className="mt-1 text-sm font-bold text-slate-900">
          {t("booking.title")}
        </h5>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {t("booking.descriptionCompact")}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth((prev) => {
                const next = new Date(prev);
                next.setMonth(next.getMonth() - 1);
                return next;
              })
            }
            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label={t("booking.prevMonth")}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-semibold capitalize text-slate-900">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={() =>
              setCurrentMonth((prev) => {
                const next = new Date(prev);
                next.setMonth(next.getMonth() + 1);
                return next;
              })
            }
            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label={t("booking.nextMonth")}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {dayLabels.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isSelected =
              selectedDate?.toDateString() === day.date.toDateString();

            return (
              <button
                key={`${day.date.toISOString()}-${index}`}
                type="button"
                onClick={() => {
                  if (!day.available) return;
                  setSelectedDate(day.date);
                  setBookingMessage(null);
                }}
                disabled={!day.available || !day.isCurrentMonth || loadingDates}
                className={cn(
                  "aspect-square rounded-xl text-xs font-medium transition",
                  !day.isCurrentMonth
                    ? "text-slate-300"
                    : isSelected
                      ? "text-white shadow-sm"
                      : isToday(day.date)
                        ? "border-2 border-sky-400 bg-sky-50 text-sky-900"
                        : day.available
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                          : "border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed",
                )}
                style={
                  isSelected
                    ? {
                      background: `linear-gradient(145deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                    }
                    : undefined
                }
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>

        {loadingSlots ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            {t("booking.loadingSlots")}
          </div>
        ) : availableSlots.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={cn(
                  "rounded-xl px-2 py-2 text-xs font-semibold transition",
                  selectedTime === slot
                    ? "text-white shadow-sm"
                    : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
                )}
                style={
                  selectedTime === slot
                    ? {
                      background: `linear-gradient(145deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                    }
                    : undefined
                }
              >
                {slot}
              </button>
            ))}
          </div>
        ) : selectedDate ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
            {t("booking.noSlots")}
          </p>
        ) : null}

        {selectedTime && (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              placeholder={t("booking.fields.name")}
              value={bookingForm.name}
              onChange={(event) =>
                setBookingForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300"
            />
            <input
              type="email"
              placeholder={t("booking.fields.email")}
              value={bookingForm.email}
              onChange={(event) =>
                setBookingForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300"
            />
            <input
              type="tel"
              placeholder={t("booking.fields.phone")}
              value={bookingForm.phone}
              onChange={(event) =>
                setBookingForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300"
            />
            <textarea
              placeholder={t("booking.fields.notes")}
              rows={2}
              value={bookingForm.notes}
              onChange={(event) =>
                setBookingForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-300"
            />
            <button
              type="button"
              onClick={handleBook}
              disabled={
                bookingStatus === "processing" ||
                !bookingForm.name ||
                !bookingForm.email
              }
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
              style={{
                background:
                  bookingStatus === "processing" ||
                    !bookingForm.name ||
                    !bookingForm.email
                    ? undefined
                    : `linear-gradient(145deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
              }}
            >
              {bookingStatus === "processing"
                ? t("booking.confirming")
                : t("booking.confirm")}
            </button>
          </div>
        )}

        {bookingMessage && (
          <div
            className={cn(
              "mt-4 rounded-2xl px-4 py-3 text-xs",
              bookingStatus === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {bookingMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function SmartBoatWidgetBody({
  activeTab,
  onTabChange,
  onSend,
  sending,
  messages,
  colors,
  harborName,
  boatId,
  locationId,
  conversationId,
  locale,
  enabledTabs,
  sessionJwt,
}: {
  activeTab: "chat" | "tasks" | "booking";
  onTabChange: (tab: "chat" | "tasks" | "booking") => void;
  onSend: (text: string) => void;
  sending: boolean;
  messages: WidgetMessage[];
  colors: WidgetColors;
  harborName?: string;
  boatId: number;
  locationId?: number;
  conversationId?: string | null;
  locale?: string;
  enabledTabs?: string[];
  sessionJwt?: string | null;
}) {
  const t = useTranslations("WidgetChat");
  const visibleTabs =
    enabledTabs && enabledTabs.length > 0
      ? enabledTabs.filter((tab): tab is "chat" | "tasks" | "booking" =>
          ["chat", "tasks", "booking"].includes(tab),
        )
      : ["chat", "tasks", "booking"];
  const tabButtonClass = (tab: "chat" | "tasks" | "booking") =>
    cn(
      "rounded-full px-3 py-2 text-[11px] font-semibold transition",
      activeTab === tab
        ? "bg-slate-950 text-white shadow-sm"
        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const taskPrompts = [
    t("tasks.prompts.progress"),
    t("tasks.prompts.documents"),
    t("tasks.prompts.nextStep"),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.72),_rgba(248,250,252,0.98)_42%,_#ffffff_100%)] text-slate-900">
      <div className="border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {visibleTabs.includes("chat") && (
            <button
              type="button"
              onClick={() => onTabChange("chat")}
              className={tabButtonClass("chat")}
            >
              {t("tabs.chat")}
            </button>
          )}
          {visibleTabs.includes("tasks") && (
            <button
              type="button"
              onClick={() => onTabChange("tasks")}
              className={tabButtonClass("tasks")}
            >
              {t("tabs.tasks")}
            </button>
          )}
          {visibleTabs.includes("booking") && (
            <button
              type="button"
              onClick={() => onTabChange("booking")}
              className={tabButtonClass("booking")}
            >
              {t("tabs.booking")}
            </button>
          )}
        </div>
      </div>

      {activeTab === "chat" ? (
        <ChatBody
          messages={messages}
          onSend={onSend}
          typing={sending}
          colors={colors}
          harborName={harborName}
          sending={sending}
          locale={locale}
        />
      ) : activeTab === "tasks" ? (
        <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
          <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/70">
              {t("tasks.kicker")}
            </p>
            <h5 className="mt-1 text-sm font-bold text-slate-900">
              {t("tasks.title")}
            </h5>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t("tasks.description", {
                boatId: String(boatId),
                locationId: String(locationId ?? ""),
              })}
            </p>
            <div className="mt-4 space-y-2">
              {taskPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    onTabChange("chat");
                    onSend(prompt);
                  }}
                  disabled={sending}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <BookingCalendarTab
          boatId={boatId}
          locationId={locationId}
          conversationId={conversationId}
          locale={locale}
          colors={colors}
          sessionJwt={sessionJwt}
        />
      )}
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
  widgetMode = boatId ? "smart" : "chat",
}: ChatWidgetProps) {
  const t = useTranslations("WidgetChat");
  const routeLocale = useLocale();
  const locale = localeOverride || routeLocale;
  const { isOnline } = useNetworkStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBoatTab, setActiveBoatTab] = useState<
    "chat" | "tasks" | "booking"
  >("chat");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [publicDefaultLocationId, setPublicDefaultLocationId] = useState<number | undefined>(
    undefined,
  );
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const [resolvedLocationId, setResolvedLocationId] = useState<number | undefined>(undefined);
  const [resolvedHarborName, setResolvedHarborName] = useState<string | undefined>(undefined);
  const [initBrandColor, setInitBrandColor] = useState<string | undefined>(undefined);
  const [enabledTabs, setEnabledTabs] = useState<string[]>(["chat", "tasks", "booking"]);
  const visitorIdRef = useRef<string>(getOrCreateSharedVisitorId());
  const publicLocationLookupRef = useRef<Promise<number | undefined> | null>(null);
  const restoredSharedChatKeyRef = useRef<string | null>(null);
  const buildInitialMessages = useCallback(
    () => [
      {
        id: "init",
        isUser: false,
        text: welcomeText || t("initialMessage"),
        timestamp: new Date(),
      },
    ],
    [t, welcomeText],
  );
  const [messages, setMessages] = useState<WidgetMessage[]>(() => buildInitialMessages());
  const sharedChatLocationId =
    locationId ?? detectRuntimeLocationId() ?? publicDefaultLocationId;

  useEffect(() => {
    if (isEmbedded && typeof window !== "undefined") {
      window.parent.postMessage(
        {
          type: "CHAT_WIDGET_STATE",
          isOpen,
          isMobile: window.innerWidth < 640,
        },
        "*",
      );
    }
  }, [isOpen, isEmbedded]);

  useEffect(() => {
    if (!boatId || widgetMode === "auction") {
      return;
    }

    let cancelled = false;

    const initWidget = async () => {
      try {
        const response = await publicApi<WidgetInitResponse>(
          "POST",
          "/chat/widget/init",
          {
            visitor_id: visitorIdRef.current,
            boat_id: boatId,
          },
        );

        if (cancelled) return;

        setSessionJwt(response.session_jwt ?? null);
        setResolvedLocationId(
          response.context?.location?.id ?? locationId ?? undefined,
        );
        setResolvedHarborName(
          response.context?.location?.name ?? harborName ?? undefined,
        );
        setInitBrandColor(
          response.context?.location?.branding?.primary_color ?? undefined,
        );
        setEnabledTabs(
          Array.isArray(response.context?.tabs_enabled) &&
            response.context?.tabs_enabled.length > 0
            ? response.context.tabs_enabled
            : ["chat", "tasks", "booking"],
        );

        const welcomeOverride =
          response.context?.location?.texts?.welcome?.trim();
        if (welcomeOverride) {
          setMessages((prev) =>
            prev.length === 1 && prev[0]?.id === "init"
              ? [{ ...prev[0], text: welcomeOverride }]
              : prev,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[ChatWidget] widget init failed:", error);
        }
      }
    };

    void initWidget();

    rememberWidgetLocationId(locationId ?? detectRuntimeLocationId());

    return () => {
      cancelled = true;
    };
  }, [boatId, widgetMode, locationId, harborName]);

  useEffect(() => {
    if (!sharedChatLocationId) {
      return;
    }

    const storageKey = getSharedChatStorageKey(sharedChatLocationId);
    if (restoredSharedChatKeyRef.current === storageKey) {
      return;
    }

    restoredSharedChatKeyRef.current = storageKey;
    const cachedState = readSharedChatState(sharedChatLocationId);

    if (!cachedState) {
      setConversationId(null);
      setMessages(buildInitialMessages());
      return;
    }

    setConversationId(cachedState.conversationId);
    setMessages(
      cachedState.messages.length > 0
        ? deserializeWidgetMessages(cachedState.messages)
        : buildInitialMessages(),
    );
  }, [buildInitialMessages, sharedChatLocationId]);

  useEffect(() => {
    if (!sharedChatLocationId) {
      return;
    }

    writeSharedChatState(sharedChatLocationId, {
      conversationId,
      messages: serializeWidgetMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [conversationId, messages, sharedChatLocationId]);

  useEffect(() => {
    if (typeof window === "undefined" || !sharedChatLocationId) {
      return;
    }

    const storageKey = getSharedChatStorageKey(sharedChatLocationId);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      const cachedState = readSharedChatState(sharedChatLocationId);
      if (!cachedState) {
        setConversationId(null);
        setMessages(buildInitialMessages());
        return;
      }

      setConversationId(cachedState.conversationId);
      setMessages(
        cachedState.messages.length > 0
          ? deserializeWidgetMessages(cachedState.messages)
          : buildInitialMessages(),
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [buildInitialMessages, sharedChatLocationId]);

  const ensurePublicDefaultLocationId = useCallback(async (): Promise<number | undefined> => {
    const existingLocationId =
      locationId ?? detectRuntimeLocationId() ?? publicDefaultLocationId;

    if (existingLocationId) {
      setPublicDefaultLocationId(existingLocationId);
      rememberWidgetLocationId(existingLocationId);
      return existingLocationId;
    }

    if (!publicLocationLookupRef.current) {
      publicLocationLookupRef.current = publicApi<PublicLocation[]>(
        "GET",
        "/public/locations",
      )
        .then((locations) => {
          const preferredLocation =
            locations.find(
              (location) => location.chat_widget_enabled !== false,
            ) ?? locations[0];
          const resolvedLocationId = parsePositiveNumber(preferredLocation?.id);

          if (resolvedLocationId) {
            setPublicDefaultLocationId(resolvedLocationId);
            rememberWidgetLocationId(resolvedLocationId);
          }

          return resolvedLocationId;
        })
        .catch((error) => {
          console.error("[ChatWidget] Failed to load public locations:", error);
          return undefined;
        })
        .finally(() => {
          publicLocationLookupRef.current = null;
        });
    }

    return publicLocationLookupRef.current;
  }, [locationId, publicDefaultLocationId]);

  useEffect(() => {
    if (boatId) {
      return;
    }

    if (locationId ?? detectRuntimeLocationId()) {
      return;
    }

    void ensurePublicDefaultLocationId();
  }, [boatId, locationId, ensurePublicDefaultLocationId]);

  const colors = useMemo<WidgetColors>(() => {
    const base = THEME_PRESETS[themePreset];
    const effectiveAccent = accentColor || initBrandColor;
    const fromAccent = effectiveAccent
      ? {
          launcherStart: effectiveAccent,
          headerStart: effectiveAccent,
          userBubbleStart: effectiveAccent,
        }
      : {};
    return { ...base, ...fromAccent, ...colorSettings };
  }, [accentColor, colorSettings, initBrandColor, themePreset]);

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
    setMessages(buildInitialMessages());
    clearSharedChatState(sharedChatLocationId);
  };

  const handleSendMessage = async (
    text: string,
    attachment?: { name: string; type: string; url?: string },
  ) => {
    // Add user message to UI immediately
    const messageText =
      text.trim() || (attachment ? `Attachment: ${attachment.name}` : "");
    const userMessage: WidgetMessage = {
      id: `u-${Date.now()}`,
      text: messageText,
      isUser: true,
      timestamp: new Date(),
      attachment,
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      if (!conversationId) {
        // First message: create lead + conversation + initial message
        const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const resolvedLocationId =
          locationId ??
          detectRuntimeLocationId() ??
          publicDefaultLocationId ??
          (boatId ? undefined : await ensurePublicDefaultLocationId());

        const response = await publicApi<PublicLeadResponse>(
          "POST",
          "/public/leads",
          {
            location_id: resolvedLocationId,
            boat_id: boatId,
            source_url:
              sourceUrl ||
              (typeof window !== "undefined"
                ? window.location.href
                : undefined),
            message: messageText,
            text: messageText,
            body: messageText,
            client_message_id: clientMessageId,
            visitor_id: visitorIdRef.current,
            ...(attachment
              ? { attachments: [{ name: attachment.name, type: attachment.type }] }
              : {}),
            ...(sessionJwt ? { session_jwt: sessionJwt } : {}),
          },
        );

        if (response.conversation?.id) {
          setConversationId(response.conversation.id);
        }
        rememberWidgetLocationId(
          response.conversation?.location_id ?? resolvedLocationId,
        );

        const aiText =
          response.ai_message?.text?.trim() ||
          response.ai_message?.body?.trim();

        setMessages((prev) => [
          ...prev,
          {
            id: response.ai_message?.id ?? `sys-${Date.now()}`,
            isUser: false,
            text: aiText || t("system.firstReply"),
            timestamp: new Date(),
            provider: response.ai_message?.metadata?.provider,
            model: response.ai_message?.metadata?.model ?? null,
          },
        ]);
      } else {
        // Subsequent messages: send to existing conversation
        const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const response = await publicApi<PublicConversationAskResponse>(
          "POST",
          `/public/conversations/${conversationId}/ask`,
          {
            body: messageText,
            text: messageText,
            client_message_id: clientMessageId,
            visitor_id: visitorIdRef.current,
            ...(attachment
              ? { attachments: [{ name: attachment.name, type: attachment.type }] }
              : {}),
            ...(sessionJwt ? { session_jwt: sessionJwt } : {}),
          },
        );

        const aiText =
          response.ai_message?.text?.trim() ||
          response.ai_message?.body?.trim();

        setMessages((prev) => [
          ...prev,
          {
            id: response.ai_message?.id ?? `sys-${Date.now()}`,
            isUser: false,
            text: aiText || t("system.sentReply"),
            timestamp: new Date(),
            provider: response.ai_message?.metadata?.provider,
            model: response.ai_message?.metadata?.model ?? null,
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
                      {resolvedHarborName || harborName || t("brand")}
                    </h4>
                    <p className="mt-1 text-[11px] text-white/78">
                      {boatId && widgetMode === "auction"
                        ? t("header.auctionWidget")
                        : boatId
                          ? t("header.smartBoatWidget")
                          : conversationId
                            ? t("header.conversationActive")
                            : t("header.onlineSupport")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                      <span className="rounded-full bg-white/14 px-2.5 py-1 backdrop-blur">
                        {boatId && widgetMode === "auction"
                          ? t("header.boat", { boatId })
                          : boatId
                            ? t("header.locationAware", { boatId })
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
              ) : boatId && widgetMode === "auction" ? (
                <AuctionWidgetBody
                  boatId={boatId}
                  locationId={locationId}
                  colors={colors}
                  locale={locale}
                />
              ) : boatId ? (
                <SmartBoatWidgetBody
                  activeTab={activeBoatTab}
                  onTabChange={setActiveBoatTab}
                  messages={messages}
                  onSend={handleSendMessage}
                  colors={colors}
                  harborName={resolvedHarborName || harborName}
                  sending={sending}
                  boatId={boatId}
                  locationId={resolvedLocationId ?? locationId}
                  conversationId={conversationId}
                  locale={locale}
                  enabledTabs={enabledTabs}
                  sessionJwt={sessionJwt}
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
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
