"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ConversationList } from "./ConversationList";
import { ConversationMessages } from "./ConversationMessages";
import {
  getConversations,
  getMessages,
  getContactInfo,
  sendSupportMessage,
  startSupportCall,
  updateConversationStatus,
  createConversation,
} from "@/lib/chat-api";
import type {
  Conversation,
  ConversationStatus,
  ContactInfo,
  SupportMessage,
} from "@/types/chat";
import { Menu } from "lucide-react";

export function ChatPage() {
  const t = useTranslations("DashboardChat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "messages">("list");

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoading(true);
    const data = await getConversations({
      status: statusFilter,
      search: searchQuery,
    });
    setConversations(data);
    setLoading(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Select conversation
  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessagesLoading(true);
    setMobilePanel("messages");

    const [msgs, contactData] = await Promise.all([
      getMessages(conv.id),
      getContactInfo(conv.id),
    ]);
    setMessages(msgs);
    setContact(contactData);
    setMessagesLoading(false);
  }, []);

  // Send message
  const handleSendMessage = useCallback(
    async (text: string, attachments?: File[]) => {
      if (!selectedConv) return;

      const newMsg = await sendSupportMessage(
        selectedConv.id,
        text,
        attachments,
      );
      setMessages((prev) => [...prev, newMsg]);
    },
    [selectedConv],
  );

  const handleStartCall = useCallback(
    async (phoneNumber: string) => {
      if (!selectedConv) return;

      const newMsg = await startSupportCall(selectedConv.id, phoneNumber);
      setMessages((prev) => [...prev, newMsg]);
    },
    [selectedConv],
  );

  // Update status
  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!selectedConv) return;
      // user_id stores the lead ID for status updates
      await updateConversationStatus(selectedConv.id, status, selectedConv.user_id);
      setSelectedConv((prev) => (prev ? { ...prev, status } : null));
      loadConversations();
    },
    [selectedConv, loadConversations],
  );

  // Create New Conversation
  const handleCreateConversation = useCallback(async () => {
    setLoading(true);
    try {
      const newConv = await createConversation();
      setConversations((prev) => [newConv, ...prev]);
      handleSelectConversation(newConv);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, [handleSelectConversation]);

  return (
    <div className="chat-page-theme space-y-6">

      <div className="flex h-[calc(100vh-24rem)] min-h-[38rem] bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden rounded-2xl border border-slate-200/60 shadow-xl">
        {/* Mobile nav bar */}
        <div className="lg:hidden fixed top-20 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-2 flex items-center gap-2">
          {mobilePanel !== "list" && (
            <button
              onClick={() => setMobilePanel("list")}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
          )}
          <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
            {mobilePanel === "list"
              ? t("mobile.conversations")
              : selectedConv?.contact_name}
          </span>
        </div>

        {/* Left: Conversation List */}
        <div
          className={`
        w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 border-r border-slate-200/60
        ${mobilePanel === "list" ? "block" : "hidden lg:block"}
      `}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedConv?.id}
            loading={loading}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            onSelectConversation={handleSelectConversation}
            onStatusFilterChange={setStatusFilter}
            onSearchChange={setSearchQuery}
            onCreateConversation={handleCreateConversation}
          />
        </div>

        {/* Center: Messages */}
        <div
          className={`
        flex-1 min-w-0
        ${mobilePanel === "messages" ? "block" : "hidden lg:block"}
      `}
        >
          {selectedConv ? (
            <ConversationMessages
              conversation={selectedConv}
              contact={contact}
              messages={messages}
              loading={messagesLoading}
              onSendMessage={handleSendMessage}
              onStartCall={handleStartCall}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {t("empty.title")}
              </h2>
              <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                {t("empty.description")}
              </p>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .dark .chat-page-theme .bg-white,
        .dark .chat-page-theme .bg-white\/70,
        .dark .chat-page-theme .bg-white\/80,
        .dark .chat-page-theme .bg-slate-50,
        .dark .chat-page-theme .bg-slate-50\/50,
        .dark .chat-page-theme .bg-slate-100,
        .dark .chat-page-theme .bg-slate-100\/80 {
          background: rgb(15 23 42) !important;
        }

        .dark .chat-page-theme .from-slate-50,
        .dark .chat-page-theme .via-white,
        .dark .chat-page-theme .to-blue-50\/30 {
          --tw-gradient-from: rgb(2 6 23) var(--tw-gradient-from-position) !important;
          --tw-gradient-via: rgb(15 23 42) var(--tw-gradient-via-position) !important;
          --tw-gradient-to: rgb(30 41 59 / 0.3) var(--tw-gradient-to-position) !important;
        }

        .dark .chat-page-theme .border-slate-200,
        .dark .chat-page-theme .border-slate-200\/60,
        .dark .chat-page-theme .border-slate-200\/80 {
          border-color: rgb(51 65 85) !important;
        }

        .dark .chat-page-theme .text-slate-900,
        .dark .chat-page-theme .text-slate-800,
        .dark .chat-page-theme .text-slate-700 {
          color: rgb(241 245 249) !important;
        }

        .dark .chat-page-theme .text-slate-600,
        .dark .chat-page-theme .text-slate-500,
        .dark .chat-page-theme .text-slate-400 {
          color: rgb(148 163 184) !important;
        }

        .dark .chat-page-theme input,
        .dark .chat-page-theme textarea,
        .dark .chat-page-theme select {
          background: rgb(2 6 23) !important;
          color: rgb(226 232 240) !important;
          border-color: rgb(51 65 85) !important;
        }

        .dark .chat-page-theme [class*="ring-white"] {
          --tw-ring-color: rgb(51 65 85) !important;
        }
      `}</style>
    </div>
  );
}
