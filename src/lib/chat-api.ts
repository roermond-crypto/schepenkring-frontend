"use client";

import type {
  Conversation,
  ConversationStatus,
  ContactInfo,
  SupportMessage,
} from "@/types/chat";
import { apiRequest } from "@/lib/api/http";

// ── Type mappings from backend → frontend ──────────────────────────

interface BackendLead {
  id: number;
  location_id: number;
  client_id: number | null;
  conversation_id: string | null;
  assigned_employee_id: number | null;
  status: string;
  source: string;
  source_url: string | null;
  notes: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  conversation?: BackendConversation;
  location?: { id: number; name: string };
  assigned_employee?: { id: number; name: string; first_name?: string; last_name?: string };
  converted_client?: { id: number; name: string } | null;
}

interface BackendConversation {
  id: string;
  location_id: number;
  channel: string;
  status: string;
  assigned_employee_id: number | null;
  lead_id: number | null;
  created_at: string;
  updated_at: string;
}

interface BackendMessage {
  id: string;
  conversation_id: string;
  sender_type: string;
  employee_id: number | null;
  body: string;
  client_message_id: string | null;
  delivery_state: string;
  created_at: string;
  updated_at: string;
  employee?: { id: number; name: string; first_name?: string; last_name?: string };
}

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ── Mappers ─────────────────────────────────────────────────────────

function mapLeadToConversation(lead: BackendLead): Conversation {
  const statusMap: Record<string, ConversationStatus> = {
    new: "open",
    open: "open",
    contacted: "pending",
    qualified: "pending",
    converted: "solved",
    closed: "solved",
  };

  return {
    id: lead.conversation?.id ?? `lead-${lead.id}`,
    status: statusMap[lead.status] ?? "open",
    source: (lead.source === "web_widget" ? "widget" : "webapp") as "widget" | "webapp",
    contact_name: lead.name ?? "Anonymous Visitor",
    contact_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(lead.name ?? "anon")}`,
    contact_company: lead.location?.name,
    last_message: lead.notes ?? "",
    last_message_at: new Date(lead.updated_at),
    unread_count: lead.status === "new" ? 1 : 0,
    created_at: new Date(lead.created_at),
    updated_at: new Date(lead.updated_at),
    assigned_name: lead.assigned_employee?.name ?? lead.assigned_employee?.first_name,
    guest_email: lead.email ?? undefined,
    guest_phone: lead.phone ?? undefined,
    // Store lead id for status updates
    user_id: String(lead.id),
  };
}

function mapBackendMessage(msg: BackendMessage): SupportMessage {
  const senderType = msg.sender_type === "employee" ? "admin" : msg.sender_type === "visitor" ? "guest" : "user";
  const senderName = msg.employee?.name
    ?? msg.employee?.first_name
    ?? (msg.sender_type === "employee" ? "Agent" : "Visitor");

  return {
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_type: senderType as "guest" | "user" | "admin" | "system",
    sender_name: senderName,
    sender_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}`,
    text: msg.body,
    created_at: new Date(msg.created_at),
    attachments: [],
  };
}

// ── API Functions ───────────────────────────────────────────────────

export async function getConversations(filters?: {
  status?: ConversationStatus | "all";
  search?: string;
}): Promise<Conversation[]> {
  try {
    const params: Record<string, string> = { per_page: "50" };

    if (filters?.status && filters.status !== "all") {
      // Map frontend status to backend lead status
      const statusMap: Record<string, string> = {
        open: "new",
        pending: "contacted",
        solved: "converted",
      };
      params.status = statusMap[filters.status] ?? filters.status;
    }

    const response = await apiRequest<PaginatedResponse<BackendLead>>({
      method: "GET",
      url: "/leads",
      params,
    });

    let results = response.data.map(mapLeadToConversation);

    // Client-side search filter (backend doesn't support text search on leads yet)
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(
        (c) =>
          c.contact_name.toLowerCase().includes(s) ||
          c.contact_company?.toLowerCase().includes(s) ||
          c.last_message?.toLowerCase().includes(s)
      );
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return [];
  }
}

export async function getMessages(conversationId: string): Promise<SupportMessage[]> {
  try {
    const response = await apiRequest<PaginatedResponse<BackendMessage>>({
      method: "GET",
      url: `/conversations/${conversationId}/messages`,
      params: { per_page: "100" },
    });

    return response.data.map(mapBackendMessage);
  } catch (error) {
    console.error(`Failed to fetch messages for conversation ${conversationId}:`, error);
    return [];
  }
}

export async function getContactInfo(conversationId: string): Promise<ContactInfo> {
  // We extract contact info from the conversation's lead
  // For now, return a placeholder that gets filled by ChatPage with the lead data
  return {
    name: "Loading...",
    email: undefined,
    phone: undefined,
    status: "online",
    shared_files: [],
    events: [],
  };
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  leadId?: string
): Promise<boolean> {
  if (!leadId) return false;

  const statusMap: Record<string, string> = {
    open: "new",
    pending: "contacted",
    solved: "converted",
  };

  await apiRequest({
    method: "PATCH",
    url: `/leads/${leadId}`,
    data: { status: statusMap[status] ?? status },
  });

  return true;
}

export async function sendSupportMessage(
  conversationId: string,
  text: string,
  attachments?: File[]
): Promise<SupportMessage> {
  const clientMessageId = `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const response = await apiRequest<{ message: BackendMessage }>({
    method: "POST",
    url: `/conversations/${conversationId}/messages`,
    data: {
      body: text,
      client_message_id: clientMessageId,
    },
  });

  return mapBackendMessage(response.message);
}

export async function startSupportCall(
  conversationId: string,
  phoneNumber?: string
): Promise<SupportMessage> {
  return sendSupportMessage(
    conversationId,
    `Started support call to ${phoneNumber || "primary phone"}`
  );
}

export async function createConversation(): Promise<Conversation> {
  // Creating a new conversation from the CRM side means creating a new lead
  const response = await apiRequest<BackendLead>({
    method: "POST",
    url: "/leads",
    data: {
      source: "webapp",
      status: "new",
      name: "New Lead",
    },
  });

  return mapLeadToConversation(response);
}
