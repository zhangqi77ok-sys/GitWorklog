import React, { useState, useEffect } from 'react';
import {
  GitFork,
  X,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  FileText,
  Boxes,
  Code2,
  ShieldCheck,
  RotateCcw,
  Check,
  ChevronRight,
  Layers,
  Users
} from 'lucide-react';
import { SwarmRun, SwarmTask, Artifact, AgentDefinition } from '../types/agentRuntimeTypes';
import { persistentArtifactStore } from '../services/artifactStore';
import { BUILTIN_AGENT_ROLES } from '../services/builtinAgents';
import { worktreeManager } from '../services/worktreeManager';
import { taskGraphScheduler } from '../services/taskGraphScheduler';

interface SwarmWorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRunId?: string;
}

export const SwarmWorkbenchModal: React.FC<SwarmWorkbenchModalProps> = ({
  isOpen,
  onClose,
  activeRunId
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'graph' | 'artifacts' | 'control'>('roles');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [shadowList, setShadowList] = useState<Array<{ id: string; shadowPath: string }>>([]);
  const [interventions, setInterventions] = useState<string[]>([]);
  const [mergePhase, setMergePhase] = useState<string>('collect');

  useEffect(() => {
    if (!isOpen) return;

    const loadData = () => {
      if (activeRunId) {
        const runArtifacts = persistentArtifactStore.getArtifactsForRun(activeRunId);
        setArtifacts(runArtifacts);
        if (runArtifacts.length > 0 && !selectedArtifact) {
          setSelectedArtifact(runArtifacts[0]);
        }
      }
    };

    loadData();

    // Listen to real agent events
    const handleAgentEvent = () => {
      loadData();
    };

    window.addEventListener('tcode_agent_event', handleAgentEvent);
    return () => window.removeEventListener('tcode_agent_event', handleAgentEvent);
  }, [isOpen, activeRunId, selectedArtifact]);

  // WP-E 控制平面：影子工作区 / 2PC 相位 / Master 纠偏干预 实时轮询
  useEffect(() => {
    if (!isOpen || !activeRunId) {
      setShadowList([]);
      setInterventions([]);
      setMergePhase('collect');
      return;
    }
    const refresh = () => {
      setShadowList(worktreeManager.list());
      setInterventions(taskGraphScheduler.getRunInterventions(activeRunId));
      const rt = taskGraphScheduler.getSwarmRunRuntime(activeRunId);
      setMergePhase(rt?.merge.phase ?? 'collect');
    };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [isOpen, activeRunId]);

  if (!isOpen) return null;

  const filteredRoles = selectedCategory === 'all'
    ? BUILTIN_AGENT_ROLES
    : BUILTIN_AGENT_ROLES.filter(r => r.category === selectedCategory);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '980px',
          maxWidth: '95vw',
          height: '720px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-surface, #1E1E1E)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle, #333)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle, #333)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-base, #181818)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(217, 107, 39, 0.15)',
                border: '1px solid rgba(217, 107, 39, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent, #D96B27)'
              }}
            >
              <Boxes size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                  🐝 Swarm 多智能体异构协同工作台
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(22, 163, 74, 0.15)',
                    color: '#16A34A',
                    fontWeight: 600
                  }}
                >
                  ● 内置 11 大专业角色库 (Master 智能路由)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted, #888)' }}>
                产品(PM) ➔ 设计(UI/UX) ➔ 架构(Architect) ➔ 前后端(Dev) ➔ 数据库(DBA) ➔ 安全(Security) ➔ 质量(QA) ➔ 终审(Reviewer)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            borderBottom: '1px solid var(--border-subtle, #333)',
            background: 'var(--bg-base, #181818)',
            gap: '16px'
          }}
        >
          {[
            { id: 'roles', label: `👥 内置专业角色矩阵 (${BUILTIN_AGENT_ROLES.length})`, icon: Users },
            { id: 'graph', label: '📊 动态任务依赖拓扑 (TaskGraph DAG)', icon: Layers },
            { id: 'artifacts', label: `📦 共享产物仓库 (${artifacts.length})`, icon: FileText },
            { id: 'control', label: '🛰 影子区与纠偏 (Control Plane)', icon: ShieldCheck }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent, #D96B27)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-main, #FFF)' : 'var(--text-muted, #888)',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <tab.icon size={13} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'control' ? (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-base, #181818)', border: '1px solid var(--border-subtle, #333)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent, #D96B27)' }}>🌳 影子工作区隔离 (git worktree)</div>
                {shadowList.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '8px' }}>当前无激活影子工作区（非 git 工程或尚未发起 Swarm Run）。</div>
                ) : shadowList.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginTop: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>{s.id}</span>
                    <span style={{ color: 'var(--text-muted, #888)' }}>{s.shadowPath}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-base, #181818)', border: '1px solid var(--border-subtle, #333)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent, #D96B27)' }}>🔀 两阶段提交 (2PC Merge Gate)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '8px' }}>
                  当前相位: <span style={{ fontWeight: 700, color: mergePhase === 'complete' ? '#16A34A' : mergePhase === 'failed' ? '#DC2626' : 'var(--accent, #D96B27)' }}>{mergePhase}</span>
                  {activeRunId ? '' : '（无活跃 Run）'}
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-base, #181818)', border: '1px solid var(--border-subtle, #333)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent, #D96B27)' }}>🚨 Master 实时纠偏干预</div>
                {interventions.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '8px' }}>暂无越界干预（各 Agent 均在职责边界内）。</div>
                ) : interventions.map((msg, i) => (
                  <div key={i} style={{ padding: '8px 10px', marginTop: '8px', borderRadius: '6px', background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.3)', fontSize: '11px', color: '#FCA5A5' }}>
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'roles' ? (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {[
                  { id: 'all', label: '全部角色' },
                  { id: 'product', label: '💡 产品与规划' },
                  { id: 'design', label: '🎨 视觉与交互' },
                  { id: 'engineering', label: '⚙️ 架构与工程' },
                  { id: 'quality', label: '🧪 质量与验证' },
                  { id: 'governance', label: '🛡️ 安全与审计' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      background: selectedCategory === cat.id ? 'var(--accent, #D96B27)' : 'var(--bg-base, #181818)',
                      border: '1px solid var(--border-subtle, #333)',
                      color: selectedCategory === cat.id ? '#FFF' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: selectedCategory === cat.id ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Roles Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {filteredRoles.map(agent => (
                  <div
                    key={agent.id}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      background: 'var(--bg-base, #181818)',
                      border: '1px solid var(--border-subtle, #333)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{agent.avatar}</span>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>{agent.name}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({agent.role})
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: agent.writeScopes.length > 0 ? 'rgba(217, 107, 39, 0.15)' : 'rgba(255,255,255,0.06)',
                          color: agent.writeScopes.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
                          fontWeight: 600
                        }}
                      >
                        {agent.writeScopes.length > 0 ? '独占写入锁' : '只读分析'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {agent.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      <span>支持工具:</span>
                      {agent.allowedTools.map(t => (
                        <code key={t} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>
                          {t}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'graph' ? (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Master Agent 动态任务图生成机制：根据用户意图，Master 会动态判断是否需要 PM 制定 PRD、Designer 制定 UI 规范、DBA 编写 Schema，并以 DAG 形式严格保序调度。
              </div>

              {/* Dynamic Task Flow Visualizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { role: 'Planner (Master)', title: '1. 全局诉求分析与智能角色调度', desc: 'Master Agent 评估任务类型并自适应组建专属 Agent 战队', icon: '👑', access: '调度' },
                  { role: 'Product / UI', title: '2. 需求规格 (PRD) 与 交互设计 (UI/UX)', desc: 'PM 输出业务用例与验收项，Designer 输出视觉规范与组件层级', icon: '🎨', access: '只读规范' },
                  { role: 'Architect / DBA', title: '3. 系统架构与数据模型 (Schema)', desc: 'Architect 定义分层契约，DBA 规划持久化 Schema 与索引', icon: '📐', access: '只读设计' },
                  { role: 'Frontend / Backend', title: '4. 前后端核心代码落盘', desc: '获取独占写锁 (WriteLock)，生成标准 Changeset 文件写入', icon: '⚡', access: '独占写入' },
                  { role: 'Security / Tester', title: '5. 安全合规审计与单测验证', desc: 'Security 审计凭据与权限，Tester 执行测试并捕获 ExitCode', icon: '🧪', access: '只读执行' },
                  { role: 'Reviewer', title: '6. 终审裁决与验收闭环', desc: '比对 PRD、UI 规范与测试日志，做出权威决策并交付', icon: '⚖️', access: '终审' }
                ].map((step) => (
                  <div
                    key={step.role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'var(--bg-base, #181818)',
                      border: '1px solid var(--border-subtle, #333)',
                      gap: '14px'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{step.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{step.title}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: step.access === '独占写入' ? 'rgba(217, 107, 39, 0.15)' : 'rgba(255,255,255,0.06)',
                            color: step.access === '独占写入' ? 'var(--accent)' : 'var(--text-muted)',
                            fontWeight: 600
                          }}
                        >
                          {step.access}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {step.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#16A34A',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>自适应编排</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Artifacts List Sidebar */}
              <div
                style={{
                  width: '280px',
                  borderRight: '1px solid var(--border-subtle, #333)',
                  background: 'var(--bg-base, #181818)',
                  overflowY: 'auto'
                }}
              >
                {artifacts.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    暂无生成的 Artifact 产物。当发起 Swarm Run 时，各 Agent 的输出将落盘并在此展示。
                  </div>
                ) : (
                  artifacts.map(art => (
                    <div
                      key={art.id}
                      onClick={() => setSelectedArtifact(art)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-subtle, #333)',
                        cursor: 'pointer',
                        background: selectedArtifact?.id === art.id ? 'var(--bg-surface, #222)' : 'transparent',
                        borderLeft: selectedArtifact?.id === art.id ? '3px solid var(--accent, #D96B27)' : '3px solid transparent'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        {art.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span style={{ textTransform: 'uppercase', padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)' }}>
                          {art.type}
                        </span>
                        <span>v{art.version}</span>
                        <span>{new Date(art.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Artifact Content Viewer */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {selectedArtifact ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                        {selectedArtifact.title} (v{selectedArtifact.version})
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ID: {selectedArtifact.id}
                      </span>
                    </div>
                    <pre
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--bg-base, #141414)',
                        border: '1px solid var(--border-subtle, #333)',
                        fontSize: '12px',
                        fontFamily: 'Consolas, monospace',
                        whiteSpace: 'pre-wrap',
                        overflowX: 'auto',
                        color: 'var(--text-main, #E0E0E0)'
                      }}
                    >
                      {selectedArtifact.content}
                    </pre>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    请在左侧选择要查看的产物详情
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
