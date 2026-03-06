"use client"

import type { Chat } from "@/types/chat"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ChatListItemProps {
  chat: Chat
  currentUserId: string
  onClick: () => void
  isActive?: boolean
}

export function ChatListItem({ chat, currentUserId, onClick, isActive }: ChatListItemProps) {
  const otherUser = chat.participants.find((user) => user.id !== currentUserId)
  if (!otherUser) return null

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors",
        isActive && "bg-blue-50 border-blue-200",
      )}
    >
      <div className="relative">
        <img
          src={otherUser.avatar || "/placeholder.svg"}
          alt={otherUser.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div
          className={cn(
            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
            otherUser.status === "online" && "bg-green-500",
            otherUser.status === "away" && "bg-yellow-500",
            otherUser.status === "offline" && "bg-gray-400",
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{otherUser.name}</h3>
          <div className="flex items-center gap-2">
            {chat.lastMessage && (
              <span className="text-xs text-gray-500">{formatTime(chat.lastMessage.timestamp)}</span>
            )}
            {chat.unreadCount && chat.unreadCount > 0 && (
              <Badge className="bg-blue-600 text-white text-xs px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {chat.unreadCount}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 truncate">{chat.lastMessage?.content || "No messages yet"}</p>
        </div>
        <p className="text-xs text-gray-500 mt-1">{otherUser.role}</p>
      </div>
    </div>
  )
}
