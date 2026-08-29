import React, { useState } from 'react';
import { Send, Shield, Zap, RefreshCw, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react';
import { SessionItem, ChatMessage, WorkMode, PermissionPolicy, AskOptionsPayload } from '../types/contracts';
import { OptionsCard } from './OptionsCard';

interface ChatColumnProps {
  session: SessionItem;
  messages: ChatMessage[];
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  permissionPolicy: PermissionPolicy;
  setPermissionPolicy: (p: PermissionPolicy) => void;
  onSendMessage: (text: string) => void;
  onResolveOptions: (messageId: string, selectedIds: string[], customInput?: string) => void;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  session,
  messages,
  workMode,
  setWorkMode,
  permissionPolicy,
  setPermissionPolicy,
  onSendMessage,
  onResolveOptions
}) => {
  const [inputText, setInputText] = useState('');
  const [planExpanded, setPlanExpanded] = useState(workMode === 'plan');

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // Pinned Badge Info based on Tier-1
  const renderTier1Badge = () => {
    if (session.tier1 === 'global') {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <span>🌐 <strong>全局自由会话</strong> · 无项目边界约束</span>
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>➕ 关联到工程</span>
        </div>
      );
    }
    if (session.tier1 === 'project') {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'rgba(217, 107, 39, 0.08)',
          borderBottom: '1px solid rgba(217, 107, 39, 0.2)',
          fontSize: '11px',
          color: 'var(--accent)'
        }}>
          <span>📁 <strong>工程作用域</strong>: {session.projectName || 'agent-learning'} (🌿 {session.gitBranch || 'main'})</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AST 骨架已载入</span>
        </div>
      );
    }
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'rgba(37, 99, 235, 0.08)',
        borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
        fontSize: '11px',
        color: '#2563EB'
      }}>
        <span>📄 <strong>文件专精</strong>: {session.filePath || 'src/bus/GatewayBus.ts'}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>单文件重构 (立省80% Token)</span>
      </div>
    );
  };

  return (
    <div style={{
      flex: '0 0 45%',
      minWidth: '320px',
      maxWidth: '700px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-surface-elevated)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Pinned Scope Badge */}
      {renderTier1Badge()}

      {/* Task Plan Breathing Capsule */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        transition: 'all 0.2s ease'
      }}>
        <div
          onClick={() => setPlanExpanded(!planExpanded)}
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)'
            }} />
            <span>📋 2/4 正在执行: 编写 Store 契约与前置测试 (50%)</span>
          </div>
          {planExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>

        {planExpanded && (
          <div style={{ padding: '6px 12px 10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A' }}>
              <CheckCircle size={13} />
              <span style={{ textDecoration: 'line-through' }}>1. 扫描项目 AST 符号依赖关系并生成雷达</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600 }}>
              <Clock size={13} />
              <span>2. 编写 Store 契约与前置失败测试 (Red Testing)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>3. 生成原子级 Unified Patch 并执行落盘</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>4. 执行全套测试治具验证 (Green Passed)</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Stream Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontWeight: 600, color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--accent)' }}>
                {msg.role === 'user' ? '开发者 (You)' : 'CodeMind 智能体'}
              </span>
              <span>· {new Date(msg.timestamp).toLocaleTimeString()}</span>
              {msg.auditTag && (
                <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '10px' }}>
                  {msg.auditTag}
                </span>
              )}
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: msg.role === 'user' ? 'var(--bg-surface)' : 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              lineHeight: 1.6
            }}>
              {msg.content}
            </div>

            {/* Interactive OptionsCard if payload exists */}
            {msg.optionsPayload && (
              <OptionsCard
                payload={msg.optionsPayload}
                onConfirm={(selectedIds, customInput) => onResolveOptions(msg.id, selectedIds, customInput)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mode Switch & Bottom Toolbar */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)'
      }}>
        {/* Controls capsule row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          {/* Plan vs Act Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-base)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            padding: '2px',
            fontSize: '11px'
          }}>
            <button
              onClick={() => setWorkMode('plan')}
              style={{
                padding: '3px 8px',
                border: 'none',
                borderRadius: '4px',
                background: workMode === 'plan' ? 'var(--accent)' : 'transparent',
                color: workMode === 'plan' ? '#FFF' : 'var(--text-secondary)',
                fontWeight: workMode === 'plan' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              📐 Plan 规划模式
            </button>
            <button
              onClick={() => setWorkMode('act')}
              style={{
                padding: '3px 8px',
                border: 'none',
                borderRadius: '4px',
                background: workMode === 'act' ? 'var(--accent)' : 'transparent',
                color: workMode === 'act' ? '#FFF' : 'var(--text-secondary)',
                fontWeight: workMode === 'act' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              ⚡ Act 落地模式
            </button>
          </div>

          {/* Dual-Track Permission Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '12px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            cursor: 'pointer'
          }}
          onClick={() => {
            if (permissionPolicy === 'strict_approval') setPermissionPolicy('autonomous_agent');
            else if (permissionPolicy === 'autonomous_agent') setPermissionPolicy('risk_adaptive');
            else setPermissionPolicy('strict_approval');
          }}>
            <Shield size={12} color="var(--accent)" />
            <span>
              {permissionPolicy === 'strict_approval' && '🛡️ 逐次人工审核'}
              {permissionPolicy === 'autonomous_agent' && '🤖 智能自主决策'}
              {permissionPolicy === 'risk_adaptive' && '⚡ 风险自适应熔断'}
            </span>
          </div>
        </div>

        {/* Input box */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            placeholder={workMode === 'plan' ? '输入指令，AI 将进行纯分析与架构规划（不写盘）...' : '输入需求，AI 将落地修改代码并执行测试自纠...'}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-surface-elevated)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSend}
            style={{
              width: '42px',
              borderRadius: '6px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
