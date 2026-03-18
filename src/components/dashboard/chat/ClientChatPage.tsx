"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { useClientSession } from "@/components/session/ClientSessionProvider";

type ClientConversationResponse = {
  id: string;
};

type AskResponse = {
  conversation?: {
    id: string;
    location_id?: number;
    status?: string;
    ai_mode?: string;
    language_preferred?: string;
    last_message_at?: string | null;
  };
  user_message?: BackendChatMessage;
  ai_message?: BackendChatMessage;
  language?: string;
  header_language?: string;
};

type ConversationDetailResponse = {
  id: string;
  messages?: BackendChatMessage[];
};

type BackendChatMessage = {
  id: string;
  sender_type: "visitor" | "ai" | "employee" | string;
  text?: string | null;
  body?: string | null;
  created_at?: string;
  metadata?: {
    knowledge_sources?: Array<{
      type?: string;
      faq_id?: number;
      question?: string;
    }>;
  } | null;
};

type ClientChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  createdAt: string;
  knowledgeSources?: Array<{
    type?: string;
    faq_id?: number;
    question?: string;
  }>;
};

function mapBackendMessage(message: BackendChatMessage): ClientChatMessage {
  return {
    id: message.id,
    sender: message.sender_type === "ai" ? "ai" : "user",
    text: message.body ?? message.text ?? "",
    createdAt: message.created_at ?? new Date().toISOString(),
    knowledgeSources: message.metadata?.knowledge_sources ?? undefined,
  };
}

function formatClock(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ClientChatPage() {
  const locale = useLocale();
  const t = useTranslations("DashboardClientChat");
  const { user } = useClientSession();
  const endRef = useRef<HTMLDivElement | null>(null);

  const locationId = user.client_location_id ?? user.location_id ?? null;
  const locationLabel = user.location?.name ?? (locationId ? `#${locationId}` : null);
  const visitorId = useMemo(() => `dashboard-client-${user.id}`, [user.id]);
  const storageKey = useMemo(
    () => (locationId ? `client-dashboard-chat:${user.id}:${locationId}` : null),
    [locationId, user.id],
  );

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClientChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        conversationId?: string;
        messages?: ClientChatMessage[];
      };
      if (parsed.conversationId) setConversationId(parsed.conversationId);
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
    } catch (error) {
      console.error("Failed to restore client chat cache:", error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ conversationId, messages }),
    );
  }, [conversationId, messages, storageKey]);

  useEffect(() => {
    const setupConversation = async () => {
      if (!locationId) {
        setInitializing(false);
        return;
      }

      try {
        const response = await api.post<ClientConversationResponse>("/chat/conversations", {
          visitor_id: visitorId,
          location_id: locationId,
          channel_origin: "dashboard_client",
          ai_mode: "auto",
          language_preferred: locale,
          contact: {
            name: user.name,
            email: user.email,
            phone: user.phone ?? undefined,
            language_preferred: locale,
            consent_service_messages: true,
          },
          page_url:
            typeof window !== "undefined" ? window.location.href : undefined,
          reuse: true,
        });

        if (response.data?.id) {
          setConversationId(response.data.id);
        }
      } catch (error) {
        console.error("Failed to initialize client chat conversation:", error);
        toast.error(t("errors.startFailed"));
      } finally {
        setInitializing(false);
      }
    };

    void setupConversation();
  }, [locale, locationId, t, user.email, user.name, user.phone, visitorId]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();

    if (!trimmed || !conversationId) return;

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAiId = `temp-ai-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        sender: "user",
        text: trimmed,
        createdAt: nowIso,
      },
      {
        id: tempAiId,
        sender: "ai",
        text: t("thinking"),
        createdAt: nowIso,
      },
    ]);
    setInput("");
    setSending(true);

    try {
      const response = await api.post<AskResponse | BackendChatMessage>(
        `/chat/conversations/${conversationId}/messages`,
        {
          text: trimmed,
          body: trimmed,
          client_message_id: `dashboard-msg-${Date.now()}`,
        },
      );

      const directResponse = response.data as AskResponse & BackendChatMessage;
      const followUpConversation = await api.get<ConversationDetailResponse>(
        `/chat/conversations/${conversationId}`,
      );
      const refreshedMessages = Array.isArray(followUpConversation.data?.messages)
        ? followUpConversation.data.messages.map(mapBackendMessage)
        : [];

      if (refreshedMessages.length > 0) {
        setMessages(refreshedMessages);
      } else {
        const nextMessages = [
          directResponse?.user_message
            ? mapBackendMessage(directResponse.user_message)
            : directResponse?.id
              ? mapBackendMessage(directResponse)
              : {
                  id: tempUserId,
                  sender: "user" as const,
                  text: trimmed,
                  createdAt: nowIso,
                },
          directResponse?.ai_message
            ? mapBackendMessage(directResponse.ai_message)
            : {
                id: tempAiId,
                sender: "ai" as const,
                text: t("errors.replyMissing"),
                createdAt: new Date().toISOString(),
              },
        ];

        setMessages((prev) => [
          ...prev.filter(
            (message) => message.id !== tempUserId && message.id !== tempAiId,
          ),
          ...nextMessages,
        ]);
      }
    } catch (error) {
      console.error("Failed to send client dashboard chat message:", error);
      setMessages((prev) =>
        prev.filter((message) => message.id !== tempUserId && message.id !== tempAiId),
      );
      toast.error(t("errors.sendFailed"));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }, [conversationId, input, t]);

  if (!locationId) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">{t("noLocation.title")}</p>
        <p className="mt-2 text-amber-800">{t("noLocation.description")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#E7F0FF] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
          {t("header.subtitle")}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif italic text-[#003566]">
              {t("header.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t("header.description")}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
            {t("header.location", { location: locationLabel ?? "—" })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t("assistant.title")}</h2>
              <p className="text-sm text-white/80">{t("assistant.description")}</p>
            </div>
          </div>
        </div>

        <div className="h-[calc(100vh-21rem)] min-h-[32rem] overflow-y-auto bg-slate-50 px-6 py-6">
          {initializing ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              {t("loading")}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">
                  {t("empty.title")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {t("empty.description")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-2xl rounded-[1.75rem] px-5 py-4 shadow-sm ${
                      message.sender === "user"
                        ? "rounded-br-md bg-gradient-to-r from-blue-600 to-sky-500 text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                    {message.sender === "ai" && message.knowledgeSources?.length ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{t("sources")}:</span>{" "}
                        {message.knowledgeSources
                          .map((source) => source.question || source.type || "knowledge")
                          .join(", ")}
                      </div>
                    ) : null}
                    <p
                      className={`mt-2 text-[11px] ${
                        message.sender === "user" ? "text-white/75" : "text-slate-400"
                      }`}
                    >
                      {formatClock(message.createdAt, locale)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-5">
          <div className="flex items-end gap-3 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-3 shadow-sm">
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={t("composer.placeholder")}
              disabled={sending || initializing || !conversationId}
              className="min-h-[56px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending || initializing || !conversationId}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              aria-label={t("composer.send")}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
              {t("composer.enterHint")}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              {t("composer.encrypted")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
