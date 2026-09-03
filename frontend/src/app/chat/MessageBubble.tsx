import React from 'react'
import { Bot, User } from 'lucide-react'
import { ChatMessage } from '../../core/store/chatStore'
import { ThinkingBlock } from './ThinkingBlock'

interface MessageBubbleProps {
  message: ChatMessage
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2.5 my-3">
        <div className="bg-[#D96B27] text-white px-3.5 py-2 rounded-2xl rounded-tr-xs text-xs max-w-xl shadow-xs leading-relaxed">
          {message.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#FAF2EC] border border-[#F0D5C3] text-[#D96B27] flex items-center justify-center shrink-0">
          <User size={14} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 my-3 max-w-2xl">
      <div className="w-7 h-7 rounded-full bg-[#FAF2EC] border border-[#F0D5C3] text-[#D96B27] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} />
      </div>

      <div className="flex-1 bg-[#FAF8F5] border border-[#EADFD7] p-3.5 rounded-2xl rounded-tl-xs text-xs text-[#2C2825] shadow-2xs leading-relaxed">
        {/* 若有思考内容，渲染思考折叠卡片 */}
        {(message.thinking || message.isStreaming) && (
          <ThinkingBlock thinking={message.thinking || ''} isStreaming={message.isStreaming && !message.content} />
        )}

        {/* 助手正文回复 */}
        <div className="whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#D96B27] animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}
