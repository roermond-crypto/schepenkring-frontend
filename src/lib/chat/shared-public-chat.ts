"use client";

export type SharedChatKnowledgeSource = {
  type?: string;
  faq_id?: number;
  question?: string;
};

export type SharedChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  createdAt: string;
  knowledgeSources?: SharedChatKnowledgeSource[];
  provider?: string;
  model?: string | null;
};

type SharedChatState = {
  conversationId: string | null;
  messages: SharedChatMessage[];
  updatedAt: string;
};

const VISITOR_ID_STORAGE_KEY = "nauticsecure_widget_visitor_id";
const SHARED_CHAT_STORAGE_PREFIX = "nauticsecure_shared_chat_v1";

export function getOrCreateSharedVisitorId(): string {
  if (typeof window === "undefined") {
    return "visitor-ssr";
  }

  const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
  return created;
}

export function getSharedChatStorageKey(locationId: number | string): string {
  return `${SHARED_CHAT_STORAGE_PREFIX}:${locationId}`;
}

export function readSharedChatState(
  locationId?: number | string | null,
): SharedChatState | null {
  if (typeof window === "undefined" || !locationId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getSharedChatStorageKey(locationId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SharedChatState>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (message): message is SharedChatMessage =>
            typeof message?.id === "string" &&
            (message?.sender === "user" || message?.sender === "ai") &&
            typeof message?.text === "string" &&
            typeof message?.createdAt === "string",
        )
      : [];

    return {
      conversationId:
        typeof parsed.conversationId === "string" ? parsed.conversationId : null,
      messages,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to read shared chat state:", error);
    return null;
  }
}

export function writeSharedChatState(
  locationId: number | string | null | undefined,
  state: SharedChatState,
): void {
  if (typeof window === "undefined" || !locationId) {
    return;
  }

  window.localStorage.setItem(
    getSharedChatStorageKey(locationId),
    JSON.stringify(state),
  );
}

export function clearSharedChatState(
  locationId?: number | string | null,
): void {
  if (typeof window === "undefined" || !locationId) {
    return;
  }

  window.localStorage.removeItem(getSharedChatStorageKey(locationId));
}
