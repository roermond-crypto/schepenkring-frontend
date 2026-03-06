"use client";

import type { Message, Chat, User } from "@/types/chat";

// Mock store
let mockChats: Chat[] = [
  {
    id: "1",
    participants: [
      { id: "1", name: "Marcel van den Brink", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcel", status: "online", role: "admin" },
      { id: "2", name: "Support Bot", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bot", status: "online", role: "assistant" }
    ],
    type: "user_to_user",
    updatedAt: new Date(),
    createdAt: new Date(),
    title: "General Support",
    isActive: true,
  }
];

let mockMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      content: "Hello! How can we help you today?",
      senderId: "2",
      timestamp: new Date(Date.now() - 3600000),
      type: "text",
      isRead: true,
    },
    {
      id: "m2",
      content: "I have a question about the dashboard.",
      senderId: "1",
      timestamp: new Date(Date.now() - 1800000),
      type: "text",
      isRead: true,
    }
  ]
};

export async function getUserList(search?: string, role?: string): Promise<User[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: "1", name: "Marcel van den Brink", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcel", status: "online", role: "admin" },
    { id: "3", name: "Emma Watson", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma", status: "away", role: "user" },
    { id: "4", name: "John Doe", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John", status: "offline", role: "user" }
  ];
}

export async function getUserChats(): Promise<Chat[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockChats;
}

// Alias for convenience in some components
export const getChats = getUserChats;

export async function createChat(participantId: string): Promise<Chat> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newChat: Chat = {
    id: `chat-${Date.now()}`,
    participants: [],
    type: "user_to_user",
    updatedAt: new Date(),
    createdAt: new Date(),
    title: "New Conversation",
    isActive: true,
  };
  mockChats.push(newChat);
  return newChat;
}

export async function createHelpdeskChat(): Promise<Chat> {
  return createChat("helpdesk");
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockMessages[chatId] || [];
}

export async function sendMessage(chatId: string, content: string, senderId: string, files?: File[]): Promise<Message> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newMessage: Message = {
    id: `msg-${Date.now()}`,
    content,
    senderId,
    timestamp: new Date(),
    type: "text",
    isRead: true,
  };

  if (!mockMessages[chatId]) mockMessages[chatId] = [];
  mockMessages[chatId].push(newMessage);

  const chat = mockChats.find(c => c.id === chatId);
  if (chat) {
    chat.lastMessage = newMessage;
    chat.updatedAt = new Date();
  }

  return newMessage;
}
