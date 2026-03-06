"use client"

import { useState, useEffect, useTransition } from "react"
import { Search, Plus, Filter } from "lucide-react"
import type { Chat } from "@/types/chat"
import { getChats } from "@/app/[locale]/actions/chat"
import { ChatListItem } from "./ChatListItem"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ChatListProps {
    onChatSelect: (chat: Chat) => void
    onNewChat: () => void
    currentUserId: string
}

export function ChatList({ onChatSelect, onNewChat, currentUserId }: ChatListProps) {
    const [chats, setChats] = useState<Chat[]>([])
    const [filteredChats, setFilteredChats] = useState<Chat[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "unread" | "online">("all")
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        startTransition(async () => {
            const chatData = await getChats()
            setChats(chatData)
            setFilteredChats(chatData)
        })
    }, [])

    useEffect(() => {
        let filtered = chats

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter((chat) =>
                chat.participants.some((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase())),
            )
        }

        // Apply status filter
        if (filter === "unread") {
            filtered = filtered.filter((chat) => (chat?.unreadCount || 0) > 0)
        } else if (filter === "online") {
            filtered = filtered.filter((chat) =>
                chat.participants.some((user) => user.id !== currentUserId && user.status === "online"),
            )
        }

        setFilteredChats(filtered)
    }, [chats, searchQuery, filter, currentUserId])

    const handleChatSelect = (chat: Chat) => {
        setSelectedChatId(chat.id)
        onChatSelect(chat)
    }

    const unreadCount = chats.reduce((total, chat) => total + (chat?.unreadCount || 0), 0)

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-gray-600">
                                {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
                            </p>
                        )}
                    </div>
                    <Button onClick={onNewChat} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        New Chat
                    </Button>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="px-3 bg-transparent">
                                <Filter className="w-4 h-4 mr-2" />
                                {filter === "all" ? "All" : filter === "unread" ? "Unread" : "Online"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFilter("all")}>All Chats</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter("unread")}>Unread Only</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter("online")}>Online Users</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {isPending ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div className="text-gray-400 mb-4">
                            <Search className="w-12 h-12" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations found</h3>
                        <p className="text-gray-600 text-center">
                            {searchQuery ? "Try adjusting your search terms" : "Start a new conversation to get started"}
                        </p>
                    </div>
                ) : (
                    filteredChats.map((chat) => (
                        <ChatListItem
                            key={chat.id}
                            chat={chat}
                            currentUserId={currentUserId}
                            onClick={() => handleChatSelect(chat)}
                            isActive={selectedChatId === chat.id}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
