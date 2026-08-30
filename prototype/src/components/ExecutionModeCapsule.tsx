import React, { useState, useEffect, useRef } from 'react';
import { Zap, Workflow, ChevronDown, Check, Blocks } from 'lucide-react';
import type { ExecutionMode } from '../services/executionMode';
import type { ModularWorkflow } from '../services/workflowStore';

interface ExecutionModeCapsuleProps {
  mode: ExecutionMode;
  activeWorkflowId: string;
  workflows: ModularWorkflow[];
  onModeChange: (mode: ExecutionMode) => void;
  onSelectWorkflow: (wf: ModularWorkflow) => void;
}

/**
 * WP-B 模块一收敛：双态执行意图胶囊（⚡ Agent Loop / 🧩 Graph 动态编排）。
 * Alt+1 / Alt+2 快捷键由 App 层统一处理（executionModeFromShortcut），
 * 本组件只负责视觉双态与 Graph 浮层工作流选择。
 */
export const ExecutionModeCapsule: React.FC<ExecutionModeCapsuleProps> = ({
  mode,
  activeWorkflowId,
  workflows,
  onModeChange,
  onSelectWorkflow
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);
  const isGraph = mode === 'graph';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '2px',
        gap: '2px',
        flexShrink: 0
      }}>
        <button
          onClick={() => onModeChange('act')}
          title="⚡ Agent Loop（极速执行）· Alt+1：单模型自主闭环，无门禁"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 9px',
            borderRadius: '6px',
            border: 'none',
            background: mode === 'act' ? 'var(--accent)' : 'transparent',
            color: mode === 'act' ? '#FFF' : 'var(--text-secondary)',
            fontSize: '10.5px',
            fontWeight: mode === 'act' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Zap size={12} />
          <span>Agent Loop</span>
        </button>

        <button
          onClick={() => {
            if (mode !== 'graph') {
              onModeChange('graph');
            }
            setMenuOpen(prev => !prev);
          }}
          title="🧩 Graph 动态编排（阶段图谱 + 门禁审批）· Alt+2：选择工作流模板或动态规划"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 9px',
            borderRadius: '6px',
            border: 'none',
            background: isGraph ? 'var(--accent)' : 'transparent',
            color: isGraph ? '#FFF' : 'var(--text-secondary)',
            fontSize: '10.5px',
            fontWeight: isGraph ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Workflow size={12} />
          <span>Graph 编排</span>
          <ChevronDown
            size={11}
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>
      </div>

      {isGraph && activeWorkflow && activeWorkflow.id !== 'normal' && (
        <span style={{
          padding: '1px 7px',
          borderRadius: '8px',
          background: 'rgba(217, 107, 39, 0.12)',
          border: '1px solid rgba(217, 107, 39, 0.3)',
          color: 'var(--accent)',
          fontSize: '10px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }} title={activeWorkflow.name}>
          {activeWorkflow.icon} {activeWorkflow.name} ({activeWorkflow.blocks.length} 阶段)
        </span>
      )}

      {menuOpen && isGraph && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 300,
          width: 'min(380px, calc(100vw - 48px))',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '10px',
          boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
          padding: '8px'
        }}>
          <div style={{
            padding: '3px 6px 7px',
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'var(--accent)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🧩 Graph 动态编排 · 工作流模板</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>Alt+1/2 切换模式</span>
          </div>

          {/* Default: Dynamic DAG planning */}
          <div
            onClick={() => {
              const normal = workflows.find(w => w.id === 'normal');
              onSelectWorkflow(normal || (workflows[0] as any));
              setMenuOpen(false);
            }}
            style={{
              marginTop: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeWorkflowId === 'normal' ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-surface)',
              border: activeWorkflowId === 'normal' ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.15s'
            }}
            title="未选模板：AI 先输出动态任务图谱 (DAG) 并经门禁确认后分步执行"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px' }}>🛰</span>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>动态图谱规划（自动）</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>未选模板 · AI 自组织任务图谱 + 门禁审批</div>
              </div>
            </div>
            {activeWorkflowId === 'normal' && <Check size={13} color="var(--accent)" />}
          </div>

          {/* Workflow templates */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
            maxHeight: '240px',
            marginTop: '6px',
            paddingRight: '2px'
          }}>
            {workflows.filter(w => w.id !== 'normal').map(w => {
              const isSelected = w.id === activeWorkflowId;
              return (
                <div
                  key={w.id}
                  onClick={() => {
                    onSelectWorkflow(w);
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-surface)',
                    border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px' }}>{w.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {w.name}
                        <span style={{ marginLeft: '5px', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                          {w.blocks.length} 阶段
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={13} color="var(--accent)" />}
                </div>
              );
            })}
          </div>

          {/* Footer: jump to Block Studio */}
          <div style={{
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '6px',
            paddingTop: '7px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>📁 独立存储: .codemind/workflows.json</span>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                window.dispatchEvent(new CustomEvent('tcode_open_settings_tab', { detail: 'workflows' }));
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Blocks size={11} />
              <span>🧩 积木拼装工作台 ➔</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
