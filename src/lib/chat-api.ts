"use client";

import type {
  Conversation,
  ConversationStatus,
  ContactInfo,
  SupportMessage,
  ConversationContext,
  SenderType,
  Attachment
} from "@/types/chat";

// Define some dummy data for the UI
const dummyConversations: Conversation[] = [
  {
    id: "conv-1",
    status: "open",
    source: "webapp",
    contact_name: "Marcel van den Brink",
    contact_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcel",
    contact_company: "Martjin Projects",
    last_message: "Can we integrate the new widget next week?",
    last_message_at: new Date(Date.now() - 1000 * 60 * 15),
    unread_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    assigned_name: "John Agent",
  },
  {
    id: "conv-2",
    status: "open",
    source: "widget",
    contact_name: "Emma de Vries",
    contact_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
    contact_company: "Ocean Ventures",
    last_message: "How does the pricing work for larger fleets?",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    id: "conv-3",
    status: "solved",
    source: "webapp",
    contact_name: "Lars Boatswain",
    contact_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lars",
    contact_company: "Rotterdam Marina",
    last_message: "Thanks for the quick help with the GPS setup!",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 25),
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    assigned_name: "John Agent",
  }
];

const dummyMessages: Record<string, SupportMessage[]> = {
  "conv-1": [
    {
      id: "msg-1",
      conversation_id: "conv-1",
      sender_type: "user",
      sender_name: "Marcel van den Brink",
      sender_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcel",
      text: "Hi there, I'm looking at the NauticSecure platform and I'm very impressed with the UI.",
      created_at: new Date(Date.now() - 1000 * 60 * 60),
      attachments: [],
    },
    {
      id: "msg-2",
      conversation_id: "conv-1",
      sender_type: "admin",
      sender_name: "John Agent",
      sender_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      text: "Thank you Marcel! We've put a lot of work into the user experience. How can I help you today?",
      created_at: new Date(Date.now() - 1000 * 60 * 45),
      attachments: [],
    },
    {
      id: "msg-3",
      conversation_id: "conv-1",
      sender_type: "user",
      sender_name: "Marcel van den Brink",
      sender_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcel",
      text: "Can we integrate the new widget next week?",
      created_at: new Date(Date.now() - 1000 * 60 * 15),
      attachments: [],
    }
  ],
  "conv-2": [
    {
      id: "msg-4",
      conversation_id: "conv-2",
      sender_type: "guest",
      sender_name: "Emma de Vries",
      sender_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
      text: "Hello, I have a fleet of 50 boats. How does the pricing work for larger fleets?",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
      attachments: [],
    }
  ]
};

export async function getConversations(filters?: { status?: ConversationStatus | "all", search?: string }): Promise<Conversation[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  let results = [...dummyConversations];

  if (filters?.status && filters.status !== "all") {
    results = results.filter(c => c.status === filters.status);
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter(c =>
      c.contact_name.toLowerCase().includes(s) ||
      c.contact_company?.toLowerCase().includes(s) ||
      c.last_message?.toLowerCase().includes(s)
    );
  }

  return results;
}

export async function getMessages(conversationId: string): Promise<SupportMessage[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return dummyMessages[conversationId] || [];
}

export async function getContactInfo(conversationId: string): Promise<ContactInfo> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const conv = dummyConversations.find(c => c.id === conversationId);
  return {
    name: conv?.contact_name || "Unknown",
    email: "contact@example.com",
    phone: "+31 123 456 789",
    company: conv?.contact_company,
    avatar: conv?.contact_avatar,
    status: "online",
    location: "Amsterdam, NL",
    shared_files: [],
    events: [],
  };
}

export async function updateConversationStatus(conversationId: string, status: ConversationStatus): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const conv = dummyConversations.find(c => c.id === conversationId);
  if (conv) {
    conv.status = status;
    return true;
  }
  return false;
}

export async function sendSupportMessage(conversationId: string, text: string, attachments?: File[]): Promise<SupportMessage> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newMsg: SupportMessage = {
    id: `msg-${Date.now()}`,
    conversation_id: conversationId,
    sender_type: "admin",
    sender_name: "John Agent",
    sender_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    text: text,
    created_at: new Date(),
    attachments: [],
  };

  if (!dummyMessages[conversationId]) dummyMessages[conversationId] = [];
  dummyMessages[conversationId].push(newMsg);

  const conv = dummyConversations.find(c => c.id === conversationId);
  if (conv) {
    conv.last_message = text;
    conv.last_message_at = new Date();
  }

  return newMsg;
}

export async function startSupportCall(conversationId: string, phoneNumber?: string): Promise<SupportMessage> {
  return sendSupportMessage(conversationId, `Started support call to ${phoneNumber || "primary phone"}`);
}

export async function createConversation(): Promise<Conversation> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newConv: Conversation = {
    id: `conv-${Date.now()}`,
    status: "open",
    source: "webapp",
    contact_name: "New Visitor",
    contact_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
    last_message: "New message",
    last_message_at: new Date(),
    unread_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
  dummyConversations.unshift(newConv);
  return newConv;
}
