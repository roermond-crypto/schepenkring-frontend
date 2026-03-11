export interface User {
  id: string
  name: string
  avatar: string
  role?: string
  company?: string
  status: "online" | "offline" | "away"
  joinDate?: string
  lastSeen?: Date
}

export interface Message {
  id: string
  content: string
  senderId: string
  timestamp: Date
  type: "text" | "image" | "file" | "ai_response"
  isRead?: boolean
  isLoading?: boolean
  role?: string
  receiverId?: string
  attachments?: Attachment[]
  isAiGenerated?: boolean
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  thumbnail?: string
}

export interface Chat {
  id: string
  participants: User[]
  lastMessage?: Message
  unreadCount?: number
  updatedAt: Date
  createdAt?: Date
  type: "user_to_user" | "helpdesk" | "ai_assistant"
  title?: string
  isActive?: boolean
  aiEnabled?: boolean
}

// ── Support / Helpdesk conversation types ──────────────────────────

export type ConversationStatus = "open" | "pending" | "solved"
export type ConversationSource = "webapp" | "widget"
export type SenderType = "guest" | "user" | "admin" | "system"
export type SupportMessageType = "text" | "call"

export interface ConversationContext {
  hiswa_company_id?: string
  place_id?: string
  page_url?: string
  ref_code?: string
  browser?: string
  device?: string
}

export interface Conversation {
  id: string
  status: ConversationStatus
  source: ConversationSource
  assigned_to?: string
  assigned_name?: string
  user_id?: string
  guest_name?: string
  guest_email?: string
  guest_phone?: string
  guest_avatar?: string
  context?: ConversationContext
  created_at: Date
  updated_at: Date
  last_message?: string
  last_message_at?: Date
  unread_count: number
  contact_name: string
  contact_avatar?: string
  contact_company?: string
  intent?: "onboarding" | "technical" | "billing" | "general"
}

export interface SupportMessage {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_name: string
  sender_avatar?: string
  text: string
  message_type?: SupportMessageType
  metadata?: Record<string, unknown>
  attachments: Attachment[]
  created_at: Date
  read_at?: Date
}

export interface SystemEvent {
  id: string
  conversation_id: string
  type: string
  description: string
  created_at: Date
  icon?: string
}

export interface ContactInfo {
  name: string
  email?: string
  phone?: string
  whatsapp_user_id?: string
  language_preferred?: string
  do_not_contact?: boolean
  consent_marketing?: boolean
  consent_service_messages?: boolean
  company?: string
  avatar?: string
  status?: "online" | "offline" | "away"
  location?: string
  shared_files: Attachment[]
  events: SystemEvent[]
}
