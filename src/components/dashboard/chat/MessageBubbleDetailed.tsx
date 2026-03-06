import type { Message, User } from "@/types/chat"
import { cn } from "@/lib/utils"

interface MessageBubbleDetailedProps {
  message: Message
  sender: User
  isCurrentUser: boolean
  showAvatar?: boolean
}

export function MessageBubbleDetailed({
  message,
  sender,
  isCurrentUser,
  showAvatar = true,
}: MessageBubbleDetailedProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className={cn("flex gap-3 mb-4", isCurrentUser ? "justify-end" : "justify-start")}>
      {!isCurrentUser && showAvatar && (
        <img
          src={sender.avatar || "/placeholder.svg"}
          alt={sender.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
        />
      )}

      <div className={cn("max-w-[70%]", isCurrentUser && "order-first")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isCurrentUser ? "bg-blue-600 text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md",
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={cn("flex items-center gap-2 mt-1 px-1", isCurrentUser ? "justify-end" : "justify-start")}>
          <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
          {isCurrentUser && (
            <span className={cn("text-xs", message.isRead ? "text-blue-600" : "text-gray-400")}>
              {message.isRead ? "Read" : "Sent"}
            </span>
          )}
        </div>
      </div>

      {isCurrentUser && showAvatar && (
        <img
          src={sender.avatar || "/placeholder.svg"}
          alt={sender.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
        />
      )}
    </div>
  )
}
