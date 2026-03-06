"use client"

import React, { useState } from "react"
import { Download, Eye, Bot, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Message, Attachment } from "@/types/chat"

interface MessageBubbleProps {
  message: Message
  isCurrentUser: boolean
  showAvatar?: boolean
}

export function MessageBubble({ message, isCurrentUser, showAvatar = true }: MessageBubbleProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const handleAttachmentDownload = (attachment: Attachment) => {
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImagePreview = (attachment: Attachment) => {
    if (attachment.type.startsWith('image/')) {
      setImagePreview(attachment.url)
    }
  }

  const renderAttachment = (attachment: Attachment) => {
    if (attachment.type.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => handleImagePreview(attachment)}
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{attachment.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleAttachmentDownload(attachment)}
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="mt-2 flex items-center gap-2 bg-gray-100 rounded-lg p-2 max-w-xs">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">
            {attachment.name}
          </div>
          <div className="text-xs text-gray-500">
            {attachment.type} • {Math.round(attachment.size / 1024)}KB
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => handleAttachmentDownload(attachment)}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const renderContent = () => {
    if (message.isAiGenerated) {
      return (
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">AI Assistant</div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="whitespace-pre-wrap text-gray-800">
                {message.content}
              </div>
              {message.attachments?.map((attachment, index) => (
                <div key={index}>
                  {renderAttachment(attachment)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="whitespace-pre-wrap">
        {message.content}
        {message.attachments?.map((attachment, index) => (
          <div key={index}>
            {renderAttachment(attachment)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className={cn(
        "flex gap-3 mb-4",
        isCurrentUser ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar */}
        {showAvatar && (
          <div className="flex-shrink-0">
            {isCurrentUser ? (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className={cn(
          "flex flex-col max-w-[70%]",
          isCurrentUser ? "items-end" : "items-start"
        )}>
          {/* Message Bubble */}
          <div className={cn(
            "rounded-lg px-4 py-2",
            isCurrentUser 
              ? "bg-blue-500 text-white" 
              : message.isAiGenerated 
                ? "bg-gray-50 text-gray-800"
                : "bg-gray-100 text-gray-800"
          )}>
            {renderContent()}
          </div>

          {/* Timestamp */}
          <div className={cn(
            "text-xs text-gray-500 mt-1",
            isCurrentUser ? "text-right" : "text-left"
          )}>
            {formatTime(message.timestamp)}
            {!message.isRead && isCurrentUser && (
              <span className="ml-1">• Unread</span>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setImagePreview(null)}
        >
          <div className="max-w-4xl max-h-4xl p-4">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <Button
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20"
              onClick={() => setImagePreview(null)}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}