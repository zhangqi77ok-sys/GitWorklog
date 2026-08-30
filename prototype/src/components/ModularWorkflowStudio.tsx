import React, { useState, useEffect } from 'react';
import {
  LegoBlock,
  ModularWorkflow,
  DEFAULT_BLOCK_PALETTE,
  loadSavedWorkflows,
  saveWorkflowsToStorage,
  getActiveWorkflowId,
  setActiveWorkflowId
} from '../services/workflowStore';
import { Save, Plus, Trash2, Check, ArrowDown, Shield, FileText, Search, Play, RotateCcw, Workflow, Sparkles, Sliders } from 'lucide-react';

export const ModularWorkflowStudio: React.FC = () => {
  const [workflows, setWorkflows] = useState<ModularWorkflow[]>(() => loadSavedWorkflows());
  const [activeWfId, setActiveWfId] = useState<string>(() => getActiveWorkflowId());
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  const activeWorkflow = workflows.find(w => w.id === activeWfId) || workflows[0];
  const selectedBlock = activeWorkflow?.blocks?.find(b => b.id === selectedBlockId) || activeWorkflow?.blocks?.[0];

  useEffect(() => {
    if (activeWorkflow?.blocks?.[0] && !selectedBlockId) {
      setSelectedBlockId(activeWorkflow.blocks[0].id);
    }
  }, [activeWorkflow, selectedBlockId]);

  const handleSelectWorkflow = (id: string) => {
    setActiveWfId(id);
    setActiveWorkflowId(id);
    const wf = workflows.find(w => w.id === id);
    if (wf && wf.blocks && wf.blocks.length > 0) {
      setSelectedBlockId(wf.blocks[0].id);
    }
  };

  const handleAddBlock = (paletteKey: string) => {
    const template = DEFAULT_BLOCK_PALETTE[paletteKey];
    if (!template || !activeWorkflow) return;

    const newBlock: LegoBlock = {
      id: `b-${Date.now()}`,
      ...template
    };

    const updatedWorkflows = workflows.map(w => {
      if (w.id === activeWorkflow.id) {
        return {
          ...w,
          blocks: [...w.blocks, newBlock]
        };
      }
      return w;
    });

    setWorkflows(updatedWorkflows);
    saveWorkflowsToStorage(updatedWorkflows);
    setSelectedBlockId(newBlock.id);
  };

  const handleRemoveBlock = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    if (!activeWorkflow) return;

    const updatedBlocks = activeWorkflow.blocks.filter(b => b.id !== blockId);
    const updatedWorkflows = workflows.map(w => {
      if (w.id === activeWorkflow.id) {
        return { ...w, blocks: updatedBlocks };
      }
      return w;
    });

    setWorkflows(updatedWorkflows);
    saveWorkflowsToStorage(updatedWorkflows);
    if (selectedBlockId === blockId && updatedBlocks.length > 0) {
      setSelectedBlockId(updatedBlocks[0].id);
    }
  };

  const handleUpdateBlockField = (field: keyof LegoBlock, value: any) => {
    if (!activeWorkflow || !selectedBlock) return;

    const updatedBlocks = activeWorkflow.blocks.map(b => {
      if (b.id === selectedBlock.id) {
        return { ...b, [field]: value };
      }
      return b;
    });

    const updatedWorkflows = workflows.map(w => {
      if (w.id === activeWorkflow.id) {
        return { ...w, blocks: updatedBlocks };
      }
      return w;
    });

    setWorkflows(updatedWorkflows);
  };

  const handleToggleTool = (tool: string) => {
    if (!selectedBlock) return;
    const current = selectedBlock.allowedTools || [];
    const next = current.includes(tool)
      ? current.filter(t => t !== tool)
      : [...current, tool];
    handleUpdateBlockField('allowedTools', next);
  };

  const handleSaveAll = () => {
    saveWorkflowsToStorage(workflows);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2000);
  };

  const handleCreateNewWorkflow = () => {
    const newId = `custom-wf-${Date.now()}`;
    const newWf: ModularWorkflow = {
      id: newId,
      name: '自定义积木工作流',
      description: '用户自由拼装的多阶段 Agent 工作流',
      icon: '✨',
      category: 'custom',
      enabled: true,
      isDefault: false,
      blocks: [
        { id: `b-1`, ...DEFAULT_BLOCK_PALETTE['inspect'] },
        { id: `b-2`, ...DEFAULT_BLOCK_PALETTE['code'] }
      ]
    };
    const nextList = [...workflows, newWf];
    setWorkflows(nextList);
    saveWorkflowsToStorage(nextList);
    handleSelectWorkflow(newId);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: 1,
      background: 'var(--bg-base, #0D0E11)',
      borderRadius: '8px',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      overflow: 'hidden'
    }}>
      {/* Studio Top Control Bar (Clean, Icon-Driven & Uncluttered) */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        background: 'var(--bg-surface, #14161C)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Left Title & Path Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Workflow size={15} color="var(--accent, #F97316)" />
          <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>积木工作流编排</strong>
          <span style={{
            fontSize: '9.5px',
            fontFamily: 'monospace',
            padding: '1px 5px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-muted)'
          }} title="持久化配置文件路径">
            .codemind/workflows.json
          </span>
        </div>

        {/* Right Actions: Workflow Switcher + Icon Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            value={activeWorkflow?.id || ''}
            onChange={(e) => handleSelectWorkflow(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated, #1A1D24)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
              color: 'var(--accent, #F97316)',
              fontSize: '11px',
              fontWeight: 700,
              outline: 'none',
              maxWidth: '240px'
            }}
            title="选择要编辑和编排的工作流"
          >
            {workflows.map(w => (
              <option key={w.id} value={w.id}>
                {w.icon} {w.name} {w.isDefault ? '(预置)' : ''}
              </option>
            ))}
          </select>

          {/* Create Custom Workflow (Icon-only) */}
          <button
            onClick={handleCreateNewWorkflow}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated, #1A1D24)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="＋ 新建自定义积木工作流"
          >
            <Plus size={13} />
          </button>

          {/* Save Workflows (Icon + Status with hover tooltip) */}
          <button
            onClick={handleSaveAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: isSavedToast ? '#10B981' : 'var(--accent, #F97316)',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="💾 保存积木编排：即刻持久化同步至本地 .codemind/workflows.json"
          >
            {isSavedToast ? <Check size={12} /> : <Save size={12} />}
            <span>{isSavedToast ? '已落盘' : '保存'}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Responsive Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* 1. Left: Lego Palette (25% Width) */}
        <div style={{
          width: '25%',
          minWidth: '150px',
          borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          padding: '10px 8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            🧩 组件库 (点击追加)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {Object.entries(DEFAULT_BLOCK_PALETTE).map(([key, block]) => (
              <div
                key={key}
                onClick={() => handleAddBlock(key)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface, #15171C)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  transition: 'all 0.15s'
                }}
                title={`${block.name}：${block.promptTemplate}`}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = block.color}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255,255,255,0.06))'}
              >
                <span style={{ fontSize: '13px' }}>{block.icon}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.name}
                </span>
                <Plus size={11} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </div>

        {/* 2. Center: Canvas Track (45% Width) */}
        <div style={{
          flex: 1,
          borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          padding: '12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          background: 'var(--bg-base, #0D0E11)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
              🚀 流水线轨道 ({activeWorkflow?.blocks?.length || 0} 块积木)
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>自上而下顺序执行</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            {(!activeWorkflow?.blocks || activeWorkflow.blocks.length === 0) ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '8px'
              }}>
                👈 点击左侧积木组件，即可开始拼装工作流
              </div>
            ) : (
              activeWorkflow.blocks.map((block, index) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <React.Fragment key={block.id}>
                    <div
                      onClick={() => setSelectedBlockId(block.id)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--bg-surface-elevated, #1C1F26)' : 'var(--bg-surface, #14161C)',
                        border: isSelected ? `2px solid ${block.color || 'var(--accent)'}` : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                        boxShadow: isSelected ? `0 4px 16px rgba(0,0,0,0.3)` : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            background: block.color || '#3B82F6',
                            color: '#FFF',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {index + 1}
                          </span>
                          <span style={{ fontSize: '13px' }}>{block.icon}</span>
                          <strong style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{block.name}</strong>
                          {block.requireUserReview && (
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#EF4444',
                              fontWeight: 700
                            }}>
                              门禁
                            </span>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleRemoveBlock(e, block.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            borderRadius: '4px'
                          }}
                          title="移除此积木"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {block.promptTemplate}
                      </div>
                    </div>

                    {index < activeWorkflow.blocks.length - 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0' }}>
                        <ArrowDown size={12} color="var(--text-muted)" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Right: Block Inspector (30% Width) */}
        <div style={{
          width: '32%',
          minWidth: '220px',
          padding: '12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: 'var(--bg-surface, #14161C)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>{selectedBlock?.icon || '⚙️'}</span>
            <strong style={{ fontSize: '11.5px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedBlock ? selectedBlock.name : '积木属性检视器'}
            </strong>
          </div>

          {selectedBlock ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>积木名称:</label>
                <input
                  type="text"
                  value={selectedBlock.name}
                  onChange={(e) => handleUpdateBlockField('name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>阶段提示词注入 (Prompt Template):</label>
                <textarea
                  rows={6}
                  value={selectedBlock.promptTemplate}
                  onChange={(e) => handleUpdateBlockField('promptTemplate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '10.5px',
                    lineHeight: 1.4,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>允许调用的工具权限:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-base)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  {['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'].map(tool => (
                    <label key={tool} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <span>{tool}</span>
                      <input
                        type="checkbox"
                        checked={selectedBlock.allowedTools?.includes(tool) || false}
                        onChange={() => handleToggleTool(tool)}
                        style={{ cursor: 'pointer' }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedBlock.requireUserReview || false}
                    onChange={(e) => handleUpdateBlockField('requireUserReview', e.target.checked)}
                  />
                  <span>本阶段结束时暂停，等待人工确认</span>
                </label>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              请在左侧或中间轨道中选择一块积木查看配置
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
