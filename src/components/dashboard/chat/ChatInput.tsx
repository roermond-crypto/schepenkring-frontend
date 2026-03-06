"use client"

import React, { useState, useRef, useCallback } from "react"
import { Send, Paperclip, Image, File, X, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Attachment } from "@/types/chat"

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: File[]) => void
  onSendAIRequest?: (message: string) => void
  isLoading?: boolean
  aiEnabled?: boolean
  placeholder?: string
}

export function ChatInput({ 
  onSendMessage, 
  onSendAIRequest, 
  isLoading = false, 
  aiEnabled = false,
  placeholder = "Type a message..."
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && attachments.length === 0) return

    onSendMessage(input, attachments.length > 0 ? attachments : undefined)
    setInput("")
    clearAttachments()
  }

  const handleAIClick = () => {
    if (!input.trim()) return
    onSendAIRequest?.(input)
    setInput("")
  }

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files)
    const validFiles = newFiles.filter(file => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      return file.size <= maxSize
    })

    setAttachments(prev => [...prev, ...validFiles])

    // Create preview URLs for images
    const newPreviewUrls = validFiles
      .filter(file => file.type.startsWith('image/'))
      .map(file => URL.createObjectURL(file))
    
    setPreviewUrls(prev => [...prev, ...newPreviewUrls])
  }, [])

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    
    // Revoke preview URL if it's an image
    if (index < previewUrls.length) {
      URL.revokeObjectURL(previewUrls[index])
      setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    }
  }

  const clearAttachments = () => {
    // Revoke all preview URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url))
    setAttachments([])
    setPreviewUrls([])
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div key={index} className="relative flex items-center gap-2 bg-gray-100 rounded-lg p-2">
              {file.type.startsWith('image/') && previewUrls[index] && (
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="w-8 h-8 object-cover rounded"
                />
              )}
              <div className="flex items-center gap-1">
                {getFileIcon(file)}
                <span className="text-sm text-gray-600 truncate max-w-24">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({formatFileSize(file.size)})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-200"
                onClick={() => removeAttachment(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* File Upload Buttons */}
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
          >
            <Image className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {/* Message Input */}
        <div className="flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="min-h-[40px] resize-none"
          />
        </div>

        {/* AI Button */}
        {aiEnabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAIClick}
            disabled={isLoading || !input.trim()}
            className="h-10 px-3"
          >
            <Bot className="w-4 h-4 mr-1" />
            AI
          </Button>
        )}

        {/* Send Button */}
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || (!input.trim() && attachments.length === 0)}
          className="h-10 w-10 p-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Sending message...
        </div>
      )}
    </div>
  )
}