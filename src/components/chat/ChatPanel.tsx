import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, CornerDownLeft, Bot, User } from 'lucide-react';
import { ThinkingBlock } from './ThinkingBlock';
import { SubtaskProgressCard } from './SubtaskProgressCard';
import type { Message, Subtask } from '../../types';

interface ChatPanelProps {
  messages: Message[];
  subtasks: Subtask[];
  currentThinking: string;
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  subtasks,
  currentThinking,
  isStreaming,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentThinking, subtasks]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming) {
        onSendMessage(input);
        setInput('');
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--chat-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '80%',
              color: 'var(--text-muted)',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <Sparkles size={24} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
              Tcode Next-Gen Agentic Studio
            </div>
            <div style={{ fontSize: '12px', maxWidth: '380px', lineHeight: 1.6 }}>
              基于 Tauri v2 + Rust Core 稳定双循环轨道与全插件化能力生态。输入任务提示词即刻启动。
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: isUser ? 'var(--bg-surface-elevated)' : 'var(--accent)',
                  color: isUser ? 'var(--text-primary)' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isUser ? <User size={15} /> : <Bot size={15} />}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {isUser ? 'User' : 'Tcode Agent'}
                </div>
                {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: isUser ? 'var(--chat-user-bg)' : 'var(--chat-system-bg)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {isStreaming && currentThinking && (
          <div style={{ paddingLeft: '38px' }}>
            <ThinkingBlock thinking={currentThinking} />
          </div>
        )}

        <SubtaskProgressCard subtasks={subtasks} />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            background: 'var(--chat-input-bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入编程需求或任务指令 (Enter 发送, Shift+Enter 换行)..."
            rows={2}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => {
              if (input.trim() && !isStreaming) {
                onSendMessage(input);
                setInput('');
              }
            }}
            disabled={!input.trim() || isStreaming}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--border-subtle)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={13} />
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  );
};
