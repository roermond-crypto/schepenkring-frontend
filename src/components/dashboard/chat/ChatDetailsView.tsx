"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { MoreHorizontal, Plus, Smile, Mic, ArrowLeft, PanelLeft, PanelRight } from "lucide-react"
import type { Chat, Message } from "@/types/chat"
import { getChatMessages, sendMessage } from "@/lib/chat-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ChatDetailViewProps {
  chat: Chat
  currentUserId: string
  onBack: () => void
  onToggleChatList: () => void
  isChatListVisible: boolean
}

export function ChatDetailView({ chat, currentUserId, onBack, onToggleChatList, isChatListVisible }: ChatDetailViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const otherUser = chat.participants.find((user) => user.id !== currentUserId)
  const currentUser = chat.participants.find((user) => user.id === currentUserId)

  useEffect(() => {
    const loadMessages = async () => {
      const messageData = await getChatMessages(chat.id)
      setMessages(messageData)
    }
    loadMessages()
  }, [chat.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isLoading) return

    const messageContent = newMessage.trim()
    setNewMessage("")
    setIsLoading(true)

    try {
      const message = await sendMessage(chat.id, messageContent, currentUserId)
      setMessages((prev) => [...prev, message])
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!otherUser) return null

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 h-8 w-8 md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 h-8 w-8 hidden md:flex"
            onClick={onToggleChatList}
          >
            {isChatListVisible ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
          <h2 className="text-lg font-semibold text-gray-900">{otherUser.name}</h2>
          {otherUser.status === "online" && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-green-600">Online</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" className="p-1.5 h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* User Profile Section */}
      <div className="flex flex-col items-center py-8 bg-gray-50 border-b border-gray-100">
        <img
          src={otherUser.avatar || "/placeholder.svg"}
          alt={otherUser.name}
          className="w-20 h-20 rounded-full object-cover mb-4"
        />
        <h3 className="text-xl font-semibold text-gray-900 mb-1">{otherUser.name}</h3>
        {otherUser.role && otherUser.company && (
          <p className="text-sm text-gray-600 mb-2">
            {otherUser.role} at {otherUser.company}
          </p>
        )}
        {otherUser.joinDate && <p className="text-xs text-gray-500">{otherUser.joinDate}</p>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => {
          const sender = message.senderId === currentUserId ? currentUser : otherUser
          const isCurrentUser = message.senderId === currentUserId

          return (
            <div key={message.id} className={cn("flex gap-3 mb-4", isCurrentUser ? "justify-end" : "justify-start")}>
              {!isCurrentUser && (
                <img
                  src={sender?.avatar || "/placeholder.svg"}
                  alt={sender?.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div
                className={cn(
                  "max-w-xs px-4 py-2 rounded-2xl",
                  isCurrentUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900",
                )}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="p-2 h-10 w-10 flex-shrink-0">
            <Plus className="h-5 w-5" />
          </Button>
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..."
              className="pr-20 py-2 border-gray-200"
              disabled={isLoading}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="p-1.5 h-7 w-7">
                <Smile className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="p-1.5 h-7 w-7">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
