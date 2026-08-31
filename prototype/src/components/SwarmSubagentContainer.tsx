import React, { useState } from 'react';
import { Layers, Zap } from 'lucide-react';
import { MarkdownCard } from './MarkdownCard';
import { ActionResult } from '../types/contracts';
import type { SwarmChatState } from '../types/contracts';
import { parseSwarmContent, type SubagentSection, type SwarmParsedData } from '../services/swarmLegacyParser';

export function normalizeSwarmState(swarm: SwarmChatState): SwarmParsedData {
  const subagents: SubagentSection[] = swarm.roles.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    role: r.name,
    duty: r.duty,
    content: r.content,
    status: r.status === 'running' ? 'running' : 'passed',
    error: r.error,
    revisions: r.revisions,
    interventions: r.interventions
  }));
  return {
    masterPlanning: swarm.masterPlanning,
    subagents,
    masterSummary: swarm.masterSummary,
    isSwarmFormatted: subagents.length > 0
  };
}

interface SwarmSubagentContainerProps {
  content: string;
  swarm?: SwarmChatState;
  isStreaming?: boolean;
  actionResults?: ActionResult[];
  onOpenFile?: (filePath: string, line?: number) => void;
}

export const SwarmSubagentContainer: React.FC<SwarmSubagentContainerProps> = ({
  content,
  swarm,
  isStreaming,
  actionResults,
  onOpenFile
}) => {
  // 结构化 swarmRoles 优先；旧消息（无 swarm 字段）走正文正则解析回退
  const parsed = swarm
    ? normalizeSwarmState(swarm)
    : parseSwarmContent(content, isStreaming);
  // 全链路流式：拆解(planning) / 角色并发(roles) / 终审(summary) 均为流式中
  const streaming = swarm
    ? swarm.phase === 'planning' || swarm.phase === 'roles' || swarm.phase === 'summary'
    : isStreaming;
  const planningStreaming = swarm ? swarm.phase === 'planning' : isStreaming;
  const summaryStreaming = swarm ? swarm.phase === 'summary' : false;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Master 拆解中（角色尚未由 Master 动态组队）：有拆解内容则流式展示，否则骨架
  if (!parsed.isSwarmFormatted || parsed.subagents.length === 0) {
    if (streaming) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '10px 14px', borderRadius: '8px',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
          background: 'var(--bg-surface-elevated, #FFFFFF)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary, #57534E)' }}>
            <span style={{ fontSize: '13px' }}>👑</span>
            <span>{parsed.masterPlanning ? 'Master 正在拆解任务并组建 Subagent 团队' : 'Master 正在分析任务并组建 Subagent 团队'}</span>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'var(--accent, #D96B27)',
              animation: 'tcodePulse 1.2s ease-in-out infinite'
            }} />
          </div>
          {parsed.masterPlanning && (
            <MarkdownCard
              content={parsed.masterPlanning}
              isStreaming={true}
              actionResults={actionResults}
              onOpenFile={onOpenFile}
            />
          )}
        </div>
      );
    }
    return (
      <MarkdownCard
        content={content}
        isStreaming={isStreaming}
        actionResults={actionResults}
        onOpenFile={onOpenFile}
      />
    );
  }

  const badgeStyle = (sub: SubagentSection): React.CSSProperties => {
    if (sub.error) {
      return { color: '#DC2626', background: 'rgba(220, 38, 38, 0.08)' };
    }
    if (sub.status === 'running') {
      return { color: 'var(--accent, #D96B27)', background: 'rgba(217, 107, 39, 0.10)' };
    }
    return { color: '#16A34A', background: 'rgba(22, 163, 74, 0.08)' };
  };
  const badgeText = (sub: SubagentSection): string => {
    if (sub.error) return '✕ 失败';
    if (sub.status === 'running') return '推演中…';
    return '✓ 完成';
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '8px',
      borderRadius: '8px',
      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
      background: 'var(--bg-surface-elevated, #FFFFFF)',
      overflow: 'hidden'
    }}>
      {/* Master 总控头部条（紧凑单行） */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        background: 'var(--bg-base, #FAF8F5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #1E1C1A)' }}>
          <span style={{ fontSize: '13px' }}>👑</span>
          <span>Master 总控</span>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted, #78716C)' }}>
            · {parsed.subagents.length} 个 Subagent
          </span>
        </div>
        {streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--accent, #D96B27)', fontWeight: 600 }}>
            <Zap size={11} />
            <span>协同推演中</span>
          </div>
        )}
      </div>

      {/* Master 拆解（可折叠） */}
      {parsed.masterPlanning && (
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px dashed var(--border-subtle, rgba(0,0,0,0.06))'
        }}>
          <button
            onClick={() => toggle('planning')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
              fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #57534E)'
            }}
          >
            <Layers size={12} color="var(--accent, #D96B27)" />
            <span>Master 拆解</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted, #A8A29E)' }}>{collapsed['planning'] ? '▸ 展开' : '▾ 收起'}</span>
          </button>
          {!collapsed['planning'] && (
            <div style={{ marginTop: '4px' }}>
              <MarkdownCard
                content={parsed.masterPlanning}
                isStreaming={planningStreaming}
                actionResults={actionResults}
                onOpenFile={onOpenFile}
              />
            </div>
          )}
        </div>
      )}

      {/* Subagent 平铺卡片（可独立折叠） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 12px' }}>
        {parsed.subagents.map(sub => (
          <div
            key={sub.id}
            style={{
              borderRadius: '6px',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.07))',
              background: 'var(--bg-base, #FFFFFF)',
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => toggle(sub.id)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '13px' }}>{sub.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-primary, #1E1C1A)', whiteSpace: 'nowrap' }}>{sub.name}</span>
                {sub.duty && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted, #78716C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    · {sub.duty}
                  </span>
                )}
                {!!sub.revisions && (
                  <span style={{ fontSize: '10px', color: 'var(--accent, #D96B27)', fontWeight: 600, flexShrink: 0 }}>
                    · 已修订 {sub.revisions} 次
                  </span>
                )}
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 600,
                padding: '1px 7px', borderRadius: '999px',
                ...badgeStyle(sub),
                flexShrink: 0
              }}>
                {badgeText(sub)}
              </span>
            </button>
            {!collapsed[sub.id] && (
              <div style={{ padding: '0 10px 10px 10px' }}>
                {sub.status === 'running' && !sub.content.trim() ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '11px', color: 'var(--text-muted, #78716C)', padding: '6px 2px'
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--accent, #D96B27)',
                      animation: 'tcodePulse 1.2s ease-in-out infinite'
                    }} />
                    <span>{sub.name} 正在推演…</span>
                  </div>
                ) : (
                  <MarkdownCard
                    content={sub.content}
                    isStreaming={sub.status === 'running'}
                    actionResults={actionResults}
                    onOpenFile={onOpenFile}
                  />
                )}
                {sub.error && (
                  <div style={{
                    marginTop: '8px', padding: '6px 10px', borderRadius: '6px',
                    background: 'rgba(220, 38, 38, 0.06)',
                    border: '1px solid rgba(220, 38, 38, 0.2)',
                    color: '#DC2626', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                  }}>
                    ✕ {sub.error}
                  </div>
                )}
                {(sub.interventions || []).filter(f => f && f.trim()).length > 0 && (
                  <div style={{
                    marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    {(sub.interventions || []).filter(f => f && f.trim()).map((f, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', borderRadius: '6px',
                        background: 'rgba(217, 107, 39, 0.06)',
                        border: '1px solid rgba(217, 107, 39, 0.18)',
                        color: 'var(--text-secondary, #57534E)',
                        fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                      }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent, #D96B27)' }}>Master 干预 · </span>
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Master 终审交付 */}
      {parsed.masterSummary && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px dashed var(--border-subtle, rgba(0,0,0,0.06))',
          background: 'var(--bg-base, #FAF8F5)'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--accent, #D96B27)',
            marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <span>🎯</span>
            <span>Master 终审交付</span>
          </div>
          <MarkdownCard
            content={parsed.masterSummary}
            isStreaming={summaryStreaming}
            actionResults={actionResults}
            onOpenFile={onOpenFile}
          />
        </div>
      )}
    </div>
  );
};
