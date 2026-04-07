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
const PUBLIC_SCOPE = "public";

type SharedChatIdentity = {
  userId?: string | number | null;
  email?: string | null;
  role?: string | null;
};

function normalizeScopeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
}

function scopedStorageKey(baseKey: string, scope?: string | null): string {
  const normalizedScope = normalizeScopeValue(scope ?? "");

  if (!normalizedScope || normalizedScope === PUBLIC_SCOPE) {
    return baseKey;
  }

  return `${baseKey}:${normalizedScope}`;
}

export function buildSharedChatScope(identity?: SharedChatIdentity | null): string {
  if (identity?.userId !== undefined && identity.userId !== null && identity.userId !== "") {
    return `user-${normalizeScopeValue(String(identity.userId))}`;
  }

  if (identity?.email) {
    return `email-${normalizeScopeValue(identity.email)}`;
  }

  if (identity?.role) {
    return `role-${normalizeScopeValue(identity.role)}`;
  }

  return PUBLIC_SCOPE;
}

export function detectSharedChatScope(): string {
  if (typeof window === "undefined") {
    return PUBLIC_SCOPE;
  }

  try {
    const raw = window.localStorage.getItem("user_data");
    if (!raw) {
      return PUBLIC_SCOPE;
    }

    const parsed = JSON.parse(raw) as {
      id?: string | number | null;
      email?: string | null;
      role?: string | null;
    };

    return buildSharedChatScope({
      userId: parsed.id,
      email: parsed.email,
      role: parsed.role,
    });
  } catch {
    return PUBLIC_SCOPE;
  }
}

export function getOrCreateSharedVisitorId(scope?: string | null): string {
  if (typeof window === "undefined") {
    return "visitor-ssr";
  }

  const storageKey = scopedStorageKey(VISITOR_ID_STORAGE_KEY, scope);
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const created = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

export function getSharedChatStorageKey(
  locationId: number | string,
  scope?: string | null,
): string {
  return scopedStorageKey(`${SHARED_CHAT_STORAGE_PREFIX}:${locationId}`, scope);
}

export function readSharedChatState(
  locationId?: number | string | null,
  scope?: string | null,
): SharedChatState | null {
  if (typeof window === "undefined" || !locationId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getSharedChatStorageKey(locationId, scope));
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
  scope: string | null | undefined,
  state: SharedChatState,
): void {
  if (typeof window === "undefined" || !locationId) {
    return;
  }

  window.localStorage.setItem(
    getSharedChatStorageKey(locationId, scope),
    JSON.stringify(state),
  );
}

export function clearSharedChatState(
  locationId?: number | string | null,
  scope?: string | null,
): void {
  if (typeof window === "undefined" || !locationId) {
    return;
  }

  window.localStorage.removeItem(getSharedChatStorageKey(locationId, scope));
}
