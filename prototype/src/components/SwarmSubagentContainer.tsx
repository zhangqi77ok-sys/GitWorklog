import React, { useState, useEffect } from 'react';
import { Layers, ChevronRight, CheckCircle2, Clock, Zap, Eye, Sparkles, UserCheck, ShieldAlert } from 'lucide-react';
import { MarkdownCard } from './MarkdownCard';
import { ActionResult } from '../types/contracts';
import type { SwarmChatState } from '../types/contracts';

interface SubagentSection {
  id: string;
  name: string;
  icon: string;
  role: string;
  duty?: string;
  content: string;
  status: 'passed' | 'running' | 'pending';
  error?: string;
}

interface SwarmParsedData {
  masterPlanning: string;
  subagents: SubagentSection[];
  masterSummary: string;
  isSwarmFormatted: boolean;
}

export function parseSwarmContent(rawText: string, isStreaming?: boolean): SwarmParsedData {
  if (!rawText) {
    return { masterPlanning: '', subagents: [], masterSummary: '', isSwarmFormatted: false };
  }

  // Regex pattern for subagent delimiter matching all common formats:
  // 注: emoji 用字面量交替而非字符类——无 u 标志时字符类按 UTF-16 码元匹配，代理对 emoji（如 📐）无法整体命中。
  const subagentHeaderRegex = /(?:###|##)\s*(?:(?:🐝|🤖|📐|💻|🧪|💾|📋|🛡\uFE0F?|📝|⚡)\s*)?\[?(?:Subagent\s*[·:：\-_ ]|子智能体\s*[·:：\-_ ])?\s*([A-Za-z0-9\u4e00-\u9fa5\-_ ]*?(?:Architect|Coder|Developer|Engineer|Tester|QA|DBA|Security|Designer|Docs|Writer|架构|编码|开发|测试|审计|审查|数据库|文档)[^\]\n]*)\]?/gi;

  const matches: { index: number; fullMatch: string; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = subagentHeaderRegex.exec(rawText)) !== null) {
    matches.push({
      index: m.index,
      fullMatch: m[0],
      name: m[1].trim()
    });
  }

  if (matches.length === 0) {
    return {
      masterPlanning: rawText,
      subagents: [],
      masterSummary: '',
      isSwarmFormatted: false
    };
  }

  const masterPlanning = rawText.slice(0, matches[0].index).trim();
  const subagents: SubagentSection[] = [];

  // Check for Master final summary marker at the end
  const summaryMarkerRegex = /(?:###|##)\s*(?:👑|⚖️|🎯)?\s*\[?(?:Master\s*(?:终审|总结|汇报|交付)|终审裁决|验收交付|总结与交付)[^\]\n]*\]?/gi;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const startIndex = cur.index + cur.fullMatch.length;
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    let subagentRaw = rawText.slice(startIndex, nextIndex);

    // If last subagent, check if there's a trailing Master summary
    let masterSummaryChunk = '';
    if (i === matches.length - 1) {
      const summaryMatch = summaryMarkerRegex.exec(subagentRaw);
      if (summaryMatch) {
        masterSummaryChunk = subagentRaw.slice(summaryMatch.index).trim();
        subagentRaw = subagentRaw.slice(0, summaryMatch.index);
      }
    }

    // Extract duty if present
    let duty: string | undefined = undefined;
    const dutyMatch = subagentRaw.match(/>\s*\*\*(?:分工职责|角色定位|职责目标)\*\*[:：]?\s*([^\n]+)/i);
    if (dutyMatch) {
      duty = dutyMatch[1].trim();
    }

    // Determine icon based on name
    let icon = '🤖';
    const lowerName = cur.name.toLowerCase();
    if (lowerName.includes('architect') || lowerName.includes('架构')) icon = '📐';
    else if (lowerName.includes('coder') || lowerName.includes('编码') || lowerName.includes('开发') || lowerName.includes('前端') || lowerName.includes('后端')) icon = '💻';
    else if (lowerName.includes('test') || lowerName.includes('qa') || lowerName.includes('测试')) icon = '🧪';
    else if (lowerName.includes('dba') || lowerName.includes('数据库') || lowerName.includes('表结构')) icon = '💾';
    else if (lowerName.includes('pm') || lowerName.includes('产品') || lowerName.includes('需求')) icon = '📋';
    else if (lowerName.includes('sec') || lowerName.includes('安全') || lowerName.includes('审计')) icon = '🛡️';
    else if (lowerName.includes('review') || lowerName.includes('终审') || lowerName.includes('评审')) icon = '⚖️';
    else if (lowerName.includes('doc') || lowerName.includes('文档') || lowerName.includes('writer')) icon = '📝';

    const isLast = i === matches.length - 1;
    const status: 'passed' | 'running' | 'pending' = (isLast && isStreaming) ? 'running' : 'passed';

    subagents.push({
      id: `subagent-${i}-${cur.name.replace(/\s+/g, '_')}`,
      name: cur.name,
      icon,
      role: cur.name,
      duty,
      content: subagentRaw.trim(),
      status
    });
  }

  // Get master summary if any
  let masterSummary = '';
  const lastSubagentRaw = rawText.slice(matches[matches.length - 1].index);
  const sumMatch = lastSubagentRaw.match(/(?:###|##)\s*(?:👑|⚖️|🎯)?\s*\[?(?:Master\s*(?:终审|总结|汇报|交付)|终审裁决|验收交付|总结与交付)[^\]\n]*\]?[\s\S]*/i);
  if (sumMatch) {
    masterSummary = sumMatch[0].trim();
  }

  return {
    masterPlanning,
    subagents,
    masterSummary,
    isSwarmFormatted: true
  };
}

export function normalizeSwarmState(swarm: SwarmChatState): SwarmParsedData {
  const subagents: SubagentSection[] = swarm.roles.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    role: r.name,
    duty: r.duty,
    content: r.content,
    status: r.status === 'running' ? 'running' : 'passed',
    error: r.error
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
  const streaming = swarm ? swarm.roles.some(r => r.status === 'running') : isStreaming;
  const [activeTab, setActiveTab] = useState<string>('all');

  // Auto-focus the latest active subagent during streaming
  useEffect(() => {
    if (parsed.subagents.length > 0 && streaming) {
      const latest = parsed.subagents[parsed.subagents.length - 1];
      setActiveTab(latest.id);
    }
  }, [parsed.subagents.length, streaming]);

  // If not formatted with subagents, fallback to normal MarkdownCard
  if (!parsed.isSwarmFormatted || parsed.subagents.length === 0) {
    return (
      <MarkdownCard
        content={content}
        isStreaming={isStreaming}
        actionResults={actionResults}
        onOpenFile={onOpenFile}
      />
    );
  }

  const selectedSubagent = parsed.subagents.find(s => s.id === activeTab);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      borderRadius: '8px',
      border: '1px solid rgba(217, 107, 39, 0.35)',
      background: 'var(--bg-surface-elevated, #1A1A1A)',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
    }}>
      {/* 👑 Outer Master Agent Banner Header */}
      <div style={{
        padding: '8px 12px',
        background: 'linear-gradient(90deg, rgba(217, 107, 39, 0.18) 0%, rgba(249, 115, 22, 0.06) 100%)',
        borderBottom: '1px solid rgba(217, 107, 39, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>👑</span>
          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--accent, #D96B27)', letterSpacing: '0.2px' }}>
            Master Agent · 异构多智能体协同总控
          </span>
          <span style={{
            fontSize: '9.5px',
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            fontWeight: 600
          }}>
            {parsed.subagents.length} 个 Subagent 协同中
          </span>
        </div>

        {streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
            <Zap size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
            <span>协同调度中...</span>
          </div>
        )}
      </div>

      {/* 1. Master Planning & DAG Section (Top) */}
      {parsed.masterPlanning && (
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px dashed var(--border-subtle, #333)',
          background: 'rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={13} color="var(--accent)" />
            <span>Master 任务拆解与协同蓝图:</span>
          </div>
          <MarkdownCard
            content={parsed.masterPlanning}
            isStreaming={false}
            actionResults={actionResults}
            onOpenFile={onOpenFile}
          />
        </div>
      )}

      {/* 2. 🐝 Subagent Tag / Tab Switcher Bar */}
      <div style={{
        padding: '6px 12px 0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--border-subtle, #333)',
        background: 'rgba(0,0,0,0.04)'
      }}>
        {parsed.subagents.map(sub => {
          const isSelected = activeTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveTab(sub.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px 6px 0 0',
                border: isSelected ? '1px solid var(--accent, #D96B27)' : '1px solid transparent',
                borderBottom: isSelected ? '2px solid var(--accent, #D96B27)' : '2px solid transparent',
                background: isSelected ? 'var(--bg-base, #111)' : 'transparent',
                color: isSelected ? 'var(--accent, #D96B27)' : 'var(--text-secondary, #999)',
                fontSize: '11px',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
                marginBottom: '-1px'
              }}
            >
              <span>{sub.icon}</span>
              <span>{sub.name}</span>
              <span style={{ fontSize: '10px' }}>
                {sub.status === 'running' ? '⏳' : '✓'}
              </span>
            </button>
          );
        })}

        {/* View All Toggle */}
        <button
          onClick={() => setActiveTab('all')}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: activeTab === 'all' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
            background: activeTab === 'all' ? 'var(--accent-subtle)' : 'transparent',
            color: activeTab === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '4px'
          }}
          title="平铺展开查看所有 Subagent"
        >
          <Eye size={11} />
          <span>全部展开</span>
        </button>
      </div>

      {/* 3. Subagent Dialogue / Execution Panel */}
      <div style={{ padding: '8px 14px' }}>
        {activeTab === 'all' ? (
          // Render All Subagents Sequentially
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {parsed.subagents.map((sub, idx) => (
              <div
                key={sub.id}
                style={{
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #333)',
                  background: 'var(--bg-base, #121212)',
                  overflow: 'hidden'
                }}
              >
                {/* Subagent Title Tag */}
                <div style={{
                  padding: '6px 10px',
                  background: 'rgba(217, 107, 39, 0.08)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px' }}>{sub.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                      Subagent: {sub.name}
                    </span>
                    {sub.duty && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        · {sub.duty}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: sub.error ? 'rgba(220, 38, 38, 0.1)' : (sub.status === 'running' ? 'var(--accent-subtle)' : 'rgba(22, 163, 74, 0.1)'),
                    color: sub.error ? '#DC2626' : (sub.status === 'running' ? 'var(--accent)' : '#16A34A'),
                    fontWeight: 600
                  }}>
                    {sub.error ? '失败' : (sub.status === 'running' ? '执行中...' : '已完成')}
                  </span>
                </div>

                {/* Subagent Inner Dialogue & Actions */}
                <div style={{ padding: '10px 12px' }}>
                  <MarkdownCard
                    content={sub.content}
                    isStreaming={sub.status === 'running'}
                    actionResults={actionResults}
                    onOpenFile={onOpenFile}
                  />
                  {sub.error && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.25)',
                      color: '#DC2626',
                      fontSize: '11px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap'
                    }}>
                      ✕ {sub.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : selectedSubagent ? (
          // Render Single Selected Subagent Dialogue
          <div style={{
            borderRadius: '6px',
            border: '1px solid var(--border-strong, #444)',
            background: 'var(--bg-base, #121212)',
            overflow: 'hidden'
          }}>
            {/* Subagent Focus Header */}
            <div style={{
              padding: '8px 12px',
              background: 'rgba(217, 107, 39, 0.09)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{selectedSubagent.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                    Subagent · {selectedSubagent.name}
                  </div>
                  {selectedSubagent.duty && (
                    <div style={{ fontSize: '10.5px', color: 'var(--accent)', marginTop: '2px' }}>
                      职责: {selectedSubagent.duty}
                    </div>
                  )}
                </div>
              </div>

              <span style={{
                fontSize: '10.5px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: selectedSubagent.error ? 'rgba(220, 38, 38, 0.1)' : (selectedSubagent.status === 'running' ? 'var(--accent-subtle)' : 'rgba(22, 163, 74, 0.12)'),
                color: selectedSubagent.error ? '#DC2626' : (selectedSubagent.status === 'running' ? 'var(--accent)' : '#16A34A'),
                fontWeight: 700
              }}>
                {selectedSubagent.error ? '✕ 执行失败' : (selectedSubagent.status === 'running' ? '⏳ 正在独立推演与执行' : '✓ 阶段产出就绪')}
              </span>
            </div>

            {/* Subagent Independent Dialogue Content */}
            <div style={{ padding: '12px' }}>
              <MarkdownCard
                content={selectedSubagent.content}
                isStreaming={selectedSubagent.status === 'running'}
                actionResults={actionResults}
                onOpenFile={onOpenFile}
              />
              {selectedSubagent.error && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#DC2626',
                  fontSize: '11px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  ✕ {selectedSubagent.error}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. 👑 Master Agent Final Delivery / Summary (Bottom) */}
      {parsed.masterSummary && (
        <div style={{
          padding: '10px 14px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(22, 163, 74, 0.06) 100%)',
          borderTop: '1px dashed var(--border-subtle, #333)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚖️</span>
            <span>Master Agent 终审汇报与最终交付:</span>
          </div>
          <MarkdownCard
            content={parsed.masterSummary}
            isStreaming={false}
            actionResults={actionResults}
            onOpenFile={onOpenFile}
          />
        </div>
      )}
    </div>
  );
};
