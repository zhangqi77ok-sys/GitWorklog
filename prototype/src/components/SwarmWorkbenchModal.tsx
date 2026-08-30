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
  Layers
} from 'lucide-react';
import { SwarmRun, SwarmTask, Artifact } from '../types/agentRuntimeTypes';
import { persistentArtifactStore } from '../services/artifactStore';
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'artifacts' | 'events'>('graph');
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

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
    const handleAgentEvent = (e: any) => {
      loadData();
    };

    window.addEventListener('tcode_agent_event', handleAgentEvent);
    return () => window.removeEventListener('tcode_agent_event', handleAgentEvent);
  }, [isOpen, activeRunId, selectedArtifact]);

  if (!isOpen) return null;

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
          width: '920px',
          maxWidth: '95vw',
          height: '680px',
          maxHeight: '90vh',
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
                  ● 真实 DAG 调度引擎已就绪
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted, #888)' }}>
                Planner ➔ Analyst ➔ Architect ➔ Coder (写锁) ➔ Tester (单测) ➔ Reviewer (仲裁)
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
            { id: 'graph', label: '📊 任务依赖拓扑 (TaskGraph DAG)', icon: Layers },
            { id: 'artifacts', label: `📦 共享产物仓库 (${artifacts.length})`, icon: FileText }
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
          {activeTab === 'graph' ? (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                TaskGraph 依赖流向说明：无前序依赖的任务率先并发执行，下游任务严格阻塞并消费上游输出的不可变产物。
              </div>

              {/* Standard 6-Role DAG Pipeline Visualizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { role: 'Planner', title: '1. 需求拆解与 DAG 任务图规划', desc: '拆分无环依赖拓扑，生成任务契约', icon: '🧠', access: '只读' },
                  { role: 'Analyst', title: '2. 依赖拓扑与风险只读分析', desc: '并发扫描项目 AST 依赖与风险项', icon: '🔍', access: '只读' },
                  { role: 'Architect', title: '3. 架构设计与实施规范', desc: '输出规范化的文件改动设计方案', icon: '📐', access: '只读' },
                  { role: 'Coder', title: '4. 核心代码实现与落盘', desc: '获取独占写锁 (WriteLock)，生成真实 Changeset', icon: '⚡', access: '独占写入' },
                  { role: 'Tester', title: '5. 自动化测试与静态验证', desc: '执行真实单测并验证 ExitCode 与输出', icon: '🧪', access: '只读执行' },
                  { role: 'Reviewer', title: '6. 验收与 Review 终审裁决', desc: '比对验收标准，做出 APPROVED 或驳回', icon: '⚖️', access: '仲裁' }
                ].map((step, idx) => (
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
                      <span>已注册调度</span>
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
