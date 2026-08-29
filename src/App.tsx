import React, { useState } from 'react';
import './styles/theme.css';
import { Titlebar } from './components/Titlebar';
import { ActivityBar } from './components/ActivityBar';
import { LeftPanel } from './components/LeftPanel';
import { ChatColumn } from './components/ChatColumn';
import { EditorWorkspace } from './components/EditorWorkspace';
import { SessionTier1Type, SessionItem, ChatMessage, TokenStats, WorkMode, PermissionPolicy } from './types/contracts';

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState('sessions');
  const [activeTier1, setActiveTier1] = useState<SessionTier1Type>('project');
  const [currentSessionId, setCurrentSessionId] = useState('session-2');
  const [workMode, setWorkMode] = useState<WorkMode>('act');
  const [permissionPolicy, setPermissionPolicy] = useState<PermissionPolicy>('autonomous_agent');

  // Token Stats mock
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    promptTokens: 2400,
    completionTokens: 600,
    cacheHitTokens: 18000,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0.038,
    contextCurrentTokens: 21000,
    contextMaxTokens: 128000
  });

  // Sessions mock
  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: 'session-1',
      tier1: 'global',
      title: 'Python 3.12 模式匹配语法讨论',
      messagesCount: 4,
      totalTokens: 5200,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000
    },
    {
      id: 'session-2',
      tier1: 'project',
      title: '重构三栏自适应流体布局',
      projectName: 'agent-learning',
      gitBranch: 'main',
      messagesCount: 8,
      totalTokens: 18500,
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now()
    },
    {
      id: 'session-3',
      tier1: 'file',
      title: 'GatewayBus.ts 事件防重优化',
      filePath: 'src/bus/GatewayBus.ts',
      messagesCount: 3,
      totalTokens: 4200,
      createdAt: Date.now() - 14400000,
      updatedAt: Date.now() - 7200000
    }
  ]);

  // Messages mock
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      role: 'user',
      content: '请帮我完成状态管理重构，并为 OptionsCard 增加自定义输入支持。',
      timestamp: Date.now() - 300000
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: '已针对项目 AST 完成扫描。检测到组件状态扩展需求，有多种架构路径可供选择：',
      timestamp: Date.now() - 240000,
      auditTag: '🤖 自动决策通过 · 已存快照',
      optionsPayload: {
        id: 'opt-1',
        question: '检测到组件状态扩展需求，请选择架构路径：',
        single_select: true,
        status: 'pending',
        allow_custom_input: true,
        options: [
          { id: 'extend', label: '扩展现有全局 Store (Recommended)', description: '单例状态源，无额外模板代码', isRecommended: true },
          { id: 'slice', label: '新建独立子模块 Slice', description: '严格模块隔离，适合大型复杂功能' }
        ]
      }
    }
  ]);

  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMsg]);

    // Assistant response simulation
    setTimeout(() => {
      const replyMsg: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        content: `已为您执行落地：${text}。代码已触发 AST 语法前检并打上 [CodeMind Checkpoint] 影子快照，测试全绿通过。`,
        timestamp: Date.now(),
        auditTag: '🤖 自动决策通过 · 已存快照'
      };
      setMessages(prev => [...prev, replyMsg]);
    }, 600);
  };

  const handleResolveOptions = (messageId: string, selectedIds: string[], customInput?: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === messageId && m.optionsPayload) {
          return {
            ...m,
            optionsPayload: {
              ...m.optionsPayload,
              status: 'resolved',
              resolvedSelection: selectedIds,
              customInput
            }
          };
        }
        return m;
      })
    );
  };

  const handleNewSession = () => {
    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      tier1: activeTier1,
      title: activeTier1 === 'global' ? '新的全局对话' : (activeTier1 === 'project' ? '新的工程任务' : '新的文件专精会话'),
      projectName: 'agent-learning',
      gitBranch: 'main',
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Titlebar */}
      <Titlebar
        currentProject="agent-learning"
        gitBranch="main"
        sessionTitle={activeSession.title}
        tokenStats={tokenStats}
      />

      {/* 2. Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ActivityBar (42px) */}
        <ActivityBar activeNav={activeNav} setActiveNav={setActiveNav} />

        {/* LeftPanel (240px) */}
        <LeftPanel
          width={240}
          activeTier1={activeTier1}
          setActiveTier1={setActiveTier1}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewSession={handleNewSession}
        />

        {/* ChatColumn (弹性 45%) */}
        <ChatColumn
          session={activeSession}
          messages={messages}
          workMode={workMode}
          setWorkMode={setWorkMode}
          permissionPolicy={permissionPolicy}
          setPermissionPolicy={setPermissionPolicy}
          onSendMessage={handleSendMessage}
          onResolveOptions={handleResolveOptions}
        />

        {/* EditorWorkspace (弹性 55%) */}
        <EditorWorkspace />
      </div>
    </div>
  );
};
export default App;
