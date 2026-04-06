"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { useClientSession } from "@/components/session/ClientSessionProvider";
import {
  getOrCreateSharedVisitorId,
  getSharedChatStorageKey,
  readSharedChatState,
  type SharedChatMessage,
  writeSharedChatState,
} from "@/lib/chat/shared-public-chat";

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
  message?: BackendChatMessage;
  user_message?: BackendChatMessage;
  ai_message?: BackendChatMessage;
  language?: string;
  header_language?: string;
};

type PublicConversationStateResponse = {
  conversation?: {
    id: string;
    location_id?: number;
    status?: string;
    ai_mode?: string;
    language_preferred?: string;
    last_message_at?: string | null;
  };
  messages?: BackendChatMessage[];
};

type BackendChatMessage = {
  id: string;
  sender_type: "visitor" | "ai" | "employee" | "admin" | string;
  text?: string | null;
  body?: string | null;
  created_at?: string;
  metadata?:
    | {
        knowledge_sources?: Array<{
          type?: string;
          faq_id?: number;
          question?: string;
        }>;
        provider?: string;
        model?: string | null;
      }
    | Record<string, unknown>
    | null;
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
  provider?: string;
  model?: string | null;
};

function mapBackendMessage(message: BackendChatMessage): ClientChatMessage {
  const metadata = (message.metadata ?? {}) as {
    knowledge_sources?: unknown;
    provider?: unknown;
    model?: unknown;
  };
  const knowledgeSources = Array.isArray(metadata.knowledge_sources)
    ? metadata.knowledge_sources.filter(
        (source): source is NonNullable<ClientChatMessage["knowledgeSources"]>[number] =>
          typeof source === "object" && source !== null,
      )
    : undefined;

  return {
    id: message.id,
    sender: message.sender_type === "visitor" ? "user" : "ai",
    text: message.body ?? message.text ?? "",
    createdAt: message.created_at ?? new Date().toISOString(),
    knowledgeSources,
    provider: typeof metadata.provider === "string" ? metadata.provider : undefined,
    model:
      typeof metadata.model === "string" || metadata.model === null
        ? (metadata.model ?? null)
        : undefined,
  };
}

function mapSharedMessage(message: SharedChatMessage): ClientChatMessage {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
    knowledgeSources: message.knowledgeSources,
    provider: message.provider,
    model: message.model,
  };
}

function serializeClientMessage(message: ClientChatMessage): SharedChatMessage {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
    knowledgeSources: message.knowledgeSources,
    provider: message.provider,
    model: message.model,
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

export function ClientChatPage() {
  const locale = useLocale();
  const t = useTranslations("DashboardClientChat");
  const { user } = useClientSession();
  const endRef = useRef<HTMLDivElement | null>(null);
  const visitorIdRef = useRef<string>(getOrCreateSharedVisitorId());
  const bootstrapKeyRef = useRef<string | null>(null);
  const loadedHistoryConversationRef = useRef<string | null>(null);

  const locationId = user.client_location_id ?? user.location_id ?? null;
  const locationLabel = user.location?.name ?? (locationId ? `#${locationId}` : null);
  const startFailedMessage = t("errors.startFailed");

  const interfaceCopy = useMemo(() => {
    if (locale === "nl") {
      return {
        sharedThread: "Deelt dezelfde conversatie als de popup-chatwidget.",
        uploadsPending:
          "Bestandsupload staat nog niet aan in deze chat. Zodra documentanalyse is gekoppeld, verschijnt die hier.",
        faqSource: "FAQ-kennis",
      };
    }

    if (locale === "de") {
      return {
        sharedThread: "Verwendet denselben Verlauf wie das Popup-Chat-Widget.",
        uploadsPending:
          "Datei-Uploads sind in diesem Chat noch nicht aktiviert. Sobald die Dokumentanalyse verbunden ist, erscheint sie hier.",
        faqSource: "FAQ-Wissen",
      };
    }

    if (locale === "fr") {
      return {
        sharedThread: "Utilise la meme conversation que le widget popup.",
        uploadsPending:
          "Le televersement de fichiers n'est pas encore active dans ce chat. Il apparaitra ici quand l'analyse de documents sera connectee.",
        faqSource: "Base FAQ",
      };
    }

    return {
      sharedThread: "Uses the same conversation as the popup chat widget.",
      uploadsPending:
        "File upload is not enabled in this chat yet. It will appear here once document analysis is connected.",
      faqSource: "FAQ knowledge",
    };
  }, [locale]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClientChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [sending, setSending] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const introDismissKey = locationId ? `nauticsecure_dashboard_chat_intro_${locationId}` : null;
  const bootstrapKey = useMemo(() => {
    if (!locationId) {
      return null;
    }

    return [
      locationId,
      locale,
      user.email ?? "",
      user.name ?? "",
      user.phone ?? "",
    ].join("::");
  }, [locale, locationId, user.email, user.name, user.phone]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!locationId) {
      return;
    }

    const cached = readSharedChatState(locationId);
    if (!cached) {
      return;
    }

    if (cached.conversationId) {
      setConversationId(cached.conversationId);
    }

    if (cached.messages.length > 0) {
      setMessages(cached.messages.map(mapSharedMessage));
    }
  }, [locationId]);

  useEffect(() => {
    if (!locationId) {
      return;
    }

    writeSharedChatState(locationId, {
      conversationId,
      messages: messages.map(serializeClientMessage),
      updatedAt: new Date().toISOString(),
    });
  }, [conversationId, locationId, messages]);

  useEffect(() => {
    if (typeof window === "undefined" || !locationId) {
      return;
    }

    const storageKey = getSharedChatStorageKey(locationId);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      const cached = readSharedChatState(locationId);
      if (!cached) {
        return;
      }

      setConversationId(cached.conversationId);
      setMessages(cached.messages.map(mapSharedMessage));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [locationId]);

  const loadConversationHistory = useCallback(async (nextConversationId: string) => {
    const response = await api.get<PublicConversationStateResponse>(
      `/public/conversations/${nextConversationId}`,
      {
        params: {
          visitor_id: visitorIdRef.current,
        },
      },
    );

    const nextMessages = Array.isArray(response.data?.messages)
      ? response.data.messages.map(mapBackendMessage)
      : [];

    setMessages(nextMessages);
  }, []);

  useEffect(() => {
    if (!conversationId) {
      loadedHistoryConversationRef.current = null;
      if (!locationId) {
        setInitializing(false);
      }
      return;
    }

    if (loadedHistoryConversationRef.current === conversationId) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    const syncConversationHistory = async () => {
      setInitializing(true);

      try {
        await loadConversationHistory(conversationId);
        if (!cancelled) {
          loadedHistoryConversationRef.current = conversationId;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client chat conversation history:", error);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void syncConversationHistory();

    return () => {
      cancelled = true;
    };
  }, [conversationId, loadConversationHistory, locationId]);

  useEffect(() => {
    if (!introDismissKey || typeof window === "undefined") return;
    try {
      setIntroDismissed(window.localStorage.getItem(introDismissKey) === "1");
    } catch (error) {
      console.error("Failed to restore client chat intro state:", error);
    }
  }, [introDismissKey]);

  useEffect(() => {
    if (!introDismissKey || typeof window === "undefined") return;
    try {
      if (introDismissed) {
        window.localStorage.setItem(introDismissKey, "1");
      } else {
        window.localStorage.removeItem(introDismissKey);
      }
    } catch (error) {
      console.error("Failed to persist client chat intro state:", error);
    }
  }, [introDismissKey, introDismissed]);

  useEffect(() => {
    const setupConversation = async () => {
      if (!locationId || !bootstrapKey) {
        setInitializing(false);
        return;
      }

      const cached = readSharedChatState(locationId);
      if (cached?.conversationId) {
        if (conversationId !== cached.conversationId) {
          setConversationId(cached.conversationId);
        }
        setInitializing(false);
        return;
      }

      if (conversationId) {
        setInitializing(false);
        return;
      }

      if (bootstrapKeyRef.current === bootstrapKey) {
        return;
      }

      bootstrapKeyRef.current = bootstrapKey;
      setInitializing(true);
      let didSucceed = false;

      try {
        const response = await api.post<ClientConversationResponse>("/chat/conversations", {
          visitor_id: visitorIdRef.current,
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
          didSucceed = true;
        }
      } catch (error) {
        console.error("Failed to initialize client chat conversation:", error);
        toast.error(startFailedMessage);
      } finally {
        setInitializing(false);
        if (!didSucceed && bootstrapKeyRef.current === bootstrapKey) {
          bootstrapKeyRef.current = null;
        }
      }
    };

    void setupConversation();
  }, [
    bootstrapKey,
    conversationId,
    locale,
    locationId,
    startFailedMessage,
    user.email,
    user.name,
    user.phone,
  ]);

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
      const response = await api.post<AskResponse>(
        `/public/conversations/${conversationId}/ask`,
        {
          body: trimmed,
          client_message_id: `dashboard-msg-${Date.now()}`,
          visitor_id: visitorIdRef.current,
        },
      );

      if (response.data?.conversation?.id) {
        setConversationId(response.data.conversation.id);
      }

      const nextMessages = [
        response.data?.message || response.data?.user_message
          ? mapBackendMessage(
              response.data.message ?? response.data.user_message!,
            )
          : {
              id: tempUserId,
              sender: "user" as const,
              text: trimmed,
              createdAt: nowIso,
            },
        response.data?.ai_message
          ? mapBackendMessage(response.data.ai_message)
          : {
              id: tempAiId,
              sender: "ai" as const,
              text: t("errors.replyMissing"),
              createdAt: new Date().toISOString(),
            },
      ];

      setMessages((prev) => [
        ...prev.filter((message) => message.id !== tempUserId && message.id !== tempAiId),
        ...nextMessages,
      ]);
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
      {!introDismissed ? (
        <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#E7F0FF] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
              {t("header.subtitle")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {interfaceCopy.sharedThread}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {interfaceCopy.uploadsPending}
              </span>
            </div>
          </div>
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
      ) : null}

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
              {messages.map((message) => {
                const providerLabel =
                  message.sender === "ai"
                    ? formatProviderLabel(message.provider, message.model)
                    : null;

                return (
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
                      {message.sender === "ai" && (providerLabel || message.knowledgeSources?.length) ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {providerLabel ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {providerLabel}
                            </span>
                          ) : null}
                          {message.knowledgeSources?.length ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {interfaceCopy.faqSource}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
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
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-5">
          <div className="mb-3 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>{interfaceCopy.uploadsPending}</p>
          </div>

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
