"use client"

import { useState, useEffect } from "react"
import { Plus, MoreHorizontal, SlidersHorizontal } from "lucide-react"
import type { Chat } from "@/types/chat"
import { getChats, createChat, createHelpdeskChat } from "@/lib/chat-service"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatListSidebarProps {
  onChatSelect: (chat: Chat) => void
  selectedChatId?: string
  currentUserId: string
}

export function ChatListSidebar({ onChatSelect, selectedChatId, currentUserId }: ChatListSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const loadChats = async () => {
      const chatData = await getChats()
      setChats(chatData)
    }
    loadChats()
  }, [])

  const handleCreateHelpdeskChat = async () => {
    setIsCreating(true)
    try {
      const newChat = await createHelpdeskChat()
      setChats(prev => [newChat, ...prev])
      onChatSelect(newChat)
    } catch (error) {
      console.error("Failed to create helpdesk chat:", error)
      alert("Failed to create helpdesk chat. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const refreshChats = async () => {
    const chatData = await getChats()
    setChats(chatData)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { day: "2-digit", month: "short" })
  }

  const filteredChats = chats.filter((chat) => {
    const otherUser = chat.participants.find((user) => user.id !== currentUserId)
    return otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="w-full md:w-80 bg-transparent border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Message</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1.5 h-8 w-8"
              onClick={handleCreateHelpdeskChat}
              disabled={isCreating}
              title="Start Helpdesk Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1.5 h-8 w-8"
              onClick={refreshChats}
              title="Refresh Chats"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1.5 h-8 w-8 flex-shrink-0"
              onClick={handleCreateHelpdeskChat}
              disabled={isCreating}
              title="Start New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <Input
                placeholder="Search message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-3 py-1.5 h-8 text-sm border-none shadow-inne "
              />
            </div>
            <Button variant="ghost" size="sm" className="p-1.5 h-8 w-8 flex-shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => {
          const otherUser = chat.participants.find((user) => user.id !== currentUserId)
          if (!otherUser) return null

          const isSelected = selectedChatId === chat.id

          return (
            <div
              key={chat.id}
              onClick={() => onChatSelect(chat)}
              className={cn(
                "flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-l-2 border-transparent",
                isSelected && "bg-blue-50 border-l-blue-500",
              )}
            >
              <img
                src={otherUser.avatar || "/placeholder.svg"}
                alt={otherUser.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900 text-sm truncate">{otherUser.name}</h3>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(chat.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">{chat.lastMessage?.content}</p>
                  {chat.unreadCount && chat.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
