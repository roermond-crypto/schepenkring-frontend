"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import type { Chat, Message } from "@/types/chat"
import { getChatMessages, sendMessage } from "@/app/[locale]/actions/chat"
import { MessageBubbleDetailed } from "./MessageBubbleDetailed"
import { ChatInput } from "./ChatInput"

interface ChatDetailProps {
  chat: Chat
  currentUserId: string
  onBack: () => void
}

export function ChatDetail({ chat, currentUserId, onBack }: ChatDetailProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isPending, startTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const otherUser = chat.participants.find((user) => user.id !== currentUserId)
  const currentUser = chat.participants.find((user) => user.id === currentUserId)

  useEffect(() => {
    startTransition(async () => {
      const messageData = await getChatMessages(chat.id)
      setMessages(messageData)
    })
  }, [chat.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    const optimisticMessage: Message = {
      id: "temp-" + Date.now(),
      content,
      senderId: currentUserId,
      receiverId: otherUser?.id || "",
      timestamp: new Date(),
      isRead: false,
      type: "text",
    }

    setMessages((prev) => [...prev, optimisticMessage])

    startTransition(async () => {
      try {
        const newMessage = await sendMessage(chat.id, content, currentUserId)
        setMessages((prev) => prev.map((msg) => (msg.id === optimisticMessage.id ? newMessage : msg)))
      } catch (error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id))
      }
    })
  }

  if (!otherUser || !currentUser) return null

  return (
    <div className="flex flex-col h-full bg-gray-50">

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => {
          const sender = message.senderId === currentUserId ? currentUser : otherUser
          const isCurrentUser = message.senderId === currentUserId
          const prevMessage = messages[index - 1]
          const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId

          return (
            <MessageBubbleDetailed
              key={message.id}
              message={message}
              sender={sender}
              isCurrentUser={isCurrentUser}
              showAvatar={showAvatar}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSendMessage={handleSendMessage} isLoading={isPending} />
    </div>
  )
}
