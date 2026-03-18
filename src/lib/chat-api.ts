"use client";

import type {
  Conversation,
  ConversationStatus,
  ContactInfo,
  SupportMessage,
} from "@/types/chat";
import { apiRequest } from "@/lib/api/http";

interface BackendContact {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_user_id?: string | null;
  language_preferred?: string | null;
  do_not_contact?: boolean | null;
  consent_marketing?: boolean | null;
  consent_service_messages?: boolean | null;
}

interface BackendConversation {
  id: string;
  location_id: number;
  status: string;
  priority?: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  location?: {
    id: number;
    name: string;
    code?: string | null;
  } | null;
  assigned_employee?: {
    id: number;
    name: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  contact?: BackendContact | null;
  lead?: {
    id?: number | null;
    status?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

interface BackendMessage {
  id: string;
  conversation_id: string;
  sender_type: string;
  text?: string | null;
  body?: string | null;
  message_type?: "text" | "call" | string;
  channel?: string;
  metadata?: Record<string, unknown>;
  employee?: { id: number; name: string; first_name?: string; last_name?: string } | null;
  attachments?: Array<{
    id?: string;
    name?: string;
    type?: string;
    size?: number;
    url?: string;
    thumbnail?: string;
  }>;
  created_at: string;
}

interface BackendConversationDetail extends BackendConversation {
  messages?: BackendMessage[];
}

interface TranslateChatResponse {
  conversation_id: string;
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  provider: string;
  model: string;
}

function mapConversationStatus(status?: string | null): ConversationStatus {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "solved" || normalized === "closed") return "solved";
  return "open";
}

function mapConversationToConversation(
  conversation: BackendConversation,
): Conversation {
  const contactName =
    conversation.contact?.name ??
    conversation.lead?.name ??
    "Anonymous Visitor";

  return {
    id: conversation.id,
    status: mapConversationStatus(conversation.status),
    source: (conversation.channel === "web_widget" ? "widget" : "webapp") as
      | "widget"
      | "webapp",
    contact_name: contactName,
    contact_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(contactName)}`,
    contact_company: conversation.location?.name ?? undefined,
    last_message_at: conversation.last_message_at
      ? new Date(conversation.last_message_at)
      : new Date(conversation.updated_at),
    unread_count: conversation.status === "open" ? 1 : 0,
    created_at: new Date(conversation.created_at),
    updated_at: new Date(conversation.updated_at),
    assigned_name:
      conversation.assigned_employee?.name ??
      conversation.assigned_employee?.first_name,
    guest_email:
      conversation.contact?.email ?? conversation.lead?.email ?? undefined,
    guest_phone:
      conversation.contact?.phone ?? conversation.lead?.phone ?? undefined,
    user_id:
      conversation.lead?.id !== null && conversation.lead?.id !== undefined
        ? String(conversation.lead.id)
        : undefined,
  };
}

function mapBackendMessage(message: BackendMessage): SupportMessage {
  const senderType =
    message.sender_type === "employee"
      ? "admin"
      : message.sender_type === "visitor"
        ? "guest"
        : message.sender_type === "ai"
          ? "ai"
          : "user";
  const senderName =
    message.employee?.name ??
    message.employee?.first_name ??
    (message.sender_type === "employee"
      ? "Agent"
      : message.sender_type === "ai"
        ? "AI assistant"
        : "Visitor");

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_type: senderType,
    sender_name: senderName,
    sender_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}`,
    text:
      message.body ??
      message.text ??
      (message.message_type === "call"
        ? `Started support call${typeof message.metadata?.to_number === "string" ? ` to ${message.metadata.to_number}` : ""}`
        : ""),
    message_type: message.message_type === "call" ? "call" : "text",
    metadata: message.metadata ?? undefined,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((attachment, index) => ({
          id: attachment.id ?? `${message.id}-attachment-${index}`,
          name: attachment.name ?? "Attachment",
          type: attachment.type ?? "file",
          size: attachment.size ?? 0,
          url: attachment.url ?? "",
          thumbnail: attachment.thumbnail,
        }))
      : [],
    created_at: new Date(message.created_at),
  };
}

export async function getConversations(filters?: {
  status?: ConversationStatus | "all";
  search?: string;
}): Promise<Conversation[]> {
  try {
    const params: Record<string, string> = { limit: "50" };

    if (filters?.status && filters.status !== "all") {
      params.status = filters.status;
    }

    const response = await apiRequest<{
      data: BackendConversation[];
      next_cursor?: string | null;
    }>({
      method: "GET",
      url: "/chat/conversations",
      params,
    });

    let results = response.data.map(mapConversationToConversation);

    if (filters?.search) {
      const normalizedSearch = filters.search.toLowerCase();
      results = results.filter(
        (conversation) =>
          conversation.contact_name.toLowerCase().includes(normalizedSearch) ||
          conversation.contact_company
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          conversation.guest_email?.toLowerCase().includes(normalizedSearch),
      );
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return [];
  }
}

export async function getMessages(
  conversationId: string,
): Promise<SupportMessage[]> {
  try {
    const response = await apiRequest<BackendConversationDetail>({
      method: "GET",
      url: `/chat/conversations/${conversationId}`,
    });

    return Array.isArray(response.messages)
      ? response.messages.map(mapBackendMessage)
      : [];
  } catch (error) {
    console.error(
      `Failed to fetch messages for conversation ${conversationId}:`,
      error,
    );
    return [];
  }
}

export async function getContactInfo(
  conversationId: string,
): Promise<ContactInfo> {
  try {
    const response = await apiRequest<BackendConversationDetail>({
      method: "GET",
      url: `/chat/conversations/${conversationId}`,
    });

    return {
      name:
        response.contact?.name ??
        response.lead?.name ??
        "Anonymous Visitor",
      email: response.contact?.email ?? response.lead?.email ?? undefined,
      phone: response.contact?.phone ?? response.lead?.phone ?? undefined,
      whatsapp_user_id: response.contact?.whatsapp_user_id ?? undefined,
      language_preferred: response.contact?.language_preferred ?? undefined,
      do_not_contact: response.contact?.do_not_contact ?? false,
      consent_marketing: response.contact?.consent_marketing ?? false,
      consent_service_messages:
        response.contact?.consent_service_messages ?? true,
      company: response.location?.name ?? undefined,
      status: "online",
      location: response.location?.name ?? undefined,
      shared_files: [],
      events: [],
    };
  } catch {
    return {
      name: "Loading...",
      email: undefined,
      phone: undefined,
      whatsapp_user_id: undefined,
      language_preferred: undefined,
      do_not_contact: false,
      consent_marketing: false,
      consent_service_messages: true,
      status: "online",
      shared_files: [],
      events: [],
    };
  }
}

export async function updateConversationContact(
  conversationId: string,
  payload: {
    name: string;
    email?: string;
    phone?: string;
    whatsapp_user_id?: string;
    language_preferred?: string;
    do_not_contact: boolean;
    consent_marketing: boolean;
    consent_service_messages: boolean;
  },
): Promise<ContactInfo> {
  const response = await apiRequest<{
    id: string;
    location_id?: number;
    status?: string;
    contact?: BackendContact | null;
    lead?: {
      id?: number;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  }>({
    method: "PATCH",
    url: `/chat/conversations/${conversationId}/contact`,
    data: payload,
  });

  const contact = response.contact ?? {};
  const lead = response.lead ?? {};

  return {
    name: contact.name ?? lead.name ?? payload.name,
    email: contact.email ?? lead.email ?? payload.email,
    phone: contact.phone ?? lead.phone ?? payload.phone,
    whatsapp_user_id: contact.whatsapp_user_id ?? payload.whatsapp_user_id,
    language_preferred:
      contact.language_preferred ?? payload.language_preferred,
    do_not_contact: contact.do_not_contact ?? payload.do_not_contact,
    consent_marketing: contact.consent_marketing ?? payload.consent_marketing,
    consent_service_messages:
      contact.consent_service_messages ?? payload.consent_service_messages,
    status: "online",
    shared_files: [],
    events: [],
  };
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  leadId?: string,
): Promise<boolean> {
  void leadId;

  await apiRequest({
    method: "PATCH",
    url: `/chat/conversations/${conversationId}`,
    data: { status },
  });

  return true;
}

export async function sendSupportMessage(
  conversationId: string,
  text: string,
  attachments?: File[],
): Promise<SupportMessage> {
  void attachments;
  const clientMessageId = `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const response = await apiRequest<BackendMessage>({
    method: "POST",
    url: `/chat/conversations/${conversationId}/messages`,
    data: {
      text,
      body: text,
      client_message_id: clientMessageId,
    },
  });

  return mapBackendMessage(response);
}

export async function translateSupportMessage(
  conversationId: string,
  text: string,
  targetLanguage: string,
  acceptLanguage?: string,
): Promise<TranslateChatResponse> {
  return apiRequest<TranslateChatResponse>({
    method: "POST",
    url: "/chat/translate",
    headers: acceptLanguage
      ? {
          "Accept-Language": acceptLanguage,
        }
      : undefined,
    data: {
      conversation_id: conversationId,
      text,
      target_language: targetLanguage,
    },
  });
}

export async function startSupportCall(
  conversationId: string,
  phoneNumber?: string,
): Promise<SupportMessage> {
  const response = await apiRequest<BackendMessage>({
    method: "POST",
    url: `/chat/conversations/${conversationId}/messages`,
    data: {
      message_type: "call",
      channel: "phone",
      metadata: {
        ...(phoneNumber ? { to_number: phoneNumber } : {}),
      },
    },
  });

  return mapBackendMessage(response);
}

export async function createConversation(): Promise<Conversation> {
  const response = await apiRequest<BackendConversation>({
    method: "POST",
    url: "/chat/conversations",
    data: {
      status: "open",
      channel: "webapp",
    },
  });

  return mapConversationToConversation(response);
}
