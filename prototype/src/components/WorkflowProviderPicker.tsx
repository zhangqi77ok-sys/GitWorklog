import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import {
  canExecuteWorkflowProvider,
  cancelWorkflowSelection,
  classifyWorkflowIntent,
  confirmWorkflowSelection,
  createWorkflowSelection,
  filterWorkflowProviders,
  type WorkflowMode,
  type WorkflowProviderManifest,
  type WorkflowSelection
} from '../services/workflowProviderDiscovery';

interface WorkflowProviderPickerProps {
  inputText: string;
  onSelectionChange?: (selection: WorkflowSelection) => void;
}

const WORKFLOW_PROVIDERS: WorkflowProviderManifest[] = [
  {
    id: 'builtin-sdd',
    displayName: 'SDD · Spec 驱动',
    version: 'Tcode 内置',
    kind: 'builtin',
    source: 'Tcode 内置工作流',
    support: 'native',
    capabilities: ['需求澄清', 'Spec 契约', '原型验收'],
    phases: [{ id: 'spec', title: 'Spec 评审', requiresUserConfirmation: true }],
    permissions: ['read_files', 'write_files']
  },
  {
    id: 'builtin-tdd',
    displayName: 'TDD · 测试驱动',
    version: 'Tcode 内置',
    kind: 'builtin',
    source: 'Tcode 内置工作流',
    support: 'native',
    capabilities: ['Red 失败测试', 'Green 最小实现', '验证回归'],
    phases: [{ id: 'red', title: 'TDD Red', requiresUserConfirmation: true }],
    permissions: ['read_files', 'write_files', 'run_commands']
  },
  {
    id: 'builtin-sdd-tdd',
    displayName: 'SDD + TDD · 完整闭环',
    version: 'Tcode 内置',
    kind: 'builtin',
    source: 'Tcode 内置工作流',
    support: 'native',
    capabilities: ['需求澄清', 'Spec 契约', '原型验收', 'Red → Green'],
    phases: [{ id: 'clarify', title: '需求澄清', requiresUserConfirmation: true }],
    permissions: ['read_files', 'write_files', 'run_commands']
  },
  {
    id: 'superspec',
    displayName: 'Superspec',
    version: '1.2.0',
    kind: 'user',
    source: '用户级安装 · ~/.superspec',
    support: 'discovered_only',
    capabilities: ['Spec', '任务拆解', '验收清单'],
    phases: [],
    permissions: ['read_files']
  },
  {
    id: 'speckit',
    displayName: 'SpecKit',
    version: '未读取 manifest',
    kind: 'workspace',
    source: '当前工程配置候选',
    support: 'discovered_only',
    capabilities: ['Spec 候选'],
    phases: [],
    permissions: ['read_files']
  }
];

const MODE_BY_PROVIDER: Record<string, WorkflowMode> = {
  'builtin-sdd': 'sdd',
  'builtin-tdd': 'tdd',
  'builtin-sdd-tdd': 'sdd_tdd',
  superspec: 'custom',
  speckit: 'custom'
};

const INITIAL_SELECTION: WorkflowSelection = { mode: 'normal', state: 'normal' };

function modeLabel(mode: WorkflowMode): string {
  if (mode === 'sdd') return 'SDD';
  if (mode === 'tdd') return 'TDD';
  if (mode === 'sdd_tdd') return 'SDD + TDD';
  if (mode === 'custom') return '外部 Provider';
  return '普通任务';
}

export const WorkflowProviderPicker: React.FC<WorkflowProviderPickerProps> = ({
  inputText,
  onSelectionChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<WorkflowSelection>(INITIAL_SELECTION);
  const [activeSelection, setActiveSelection] = useState<WorkflowSelection>(INITIAL_SELECTION);
  const [notice, setNotice] = useState<string | null>(null);

  const intent = useMemo(() => classifyWorkflowIntent(inputText), [inputText]);
  const providers = useMemo(() => filterWorkflowProviders(WORKFLOW_PROVIDERS, query), [query]);
  const selectedProvider = WORKFLOW_PROVIDERS.find(provider => provider.id === draft.providerId);
  const activeProvider = WORKFLOW_PROVIDERS.find(provider => provider.id === activeSelection.providerId);
  const detectedProvider = intent.providerId
    ? WORKFLOW_PROVIDERS.find(provider => provider.id === intent.providerId)
    : undefined;
  const detectedMode = intent.mode === 'normal' ? undefined : intent.mode;

  const publishSelection = (selection: WorkflowSelection) => {
    setActiveSelection(selection);
    onSelectionChange?.(selection);
  };

  const selectProvider = (provider: WorkflowProviderManifest) => {
    const next = createWorkflowSelection(provider, MODE_BY_PROVIDER[provider.id] || 'custom');
    setDraft(next);
    setNotice(null);
  };

  const selectNormal = () => {
    const normal = { mode: 'normal' as const, state: 'normal' as const };
    setDraft(normal);
    publishSelection(normal);
    setNotice('已切回普通任务模式：不会自动启用任何开发范式。');
  };

  const confirmDraft = () => {
    if (!selectedProvider || draft.state !== 'selected') return;
    const confirmed = confirmWorkflowSelection(draft);
    publishSelection(confirmed);
    setDraft(confirmed);
    setIsOpen(false);
    setNotice(selectedProvider.support === 'discovered_only'
      ? `${selectedProvider.displayName} 已记录为本次选择，但当前仅发现、尚未适配执行。`
      : `${selectedProvider.displayName} 已启用，本次任务将按 ${modeLabel(confirmed.mode)} 运行。`);
  };

  const cancelDraft = () => {
    const cancelled = cancelWorkflowSelection(draft);
    setDraft(cancelled);
    setIsOpen(false);
    setNotice('已取消工作流选择，当前任务保持普通模式。');
  };

  const activeLabel = activeProvider
    ? activeProvider.displayName
    : activeSelection.mode === 'normal'
      ? '普通任务'
      : modeLabel(activeSelection.mode);
  const activeCanExecute = activeProvider ? canExecuteWorkflowProvider(activeProvider, activeSelection) : false;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="选择工作流"
        title="选择普通任务、SDD、TDD 或已发现的外部工作流"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '4px',
          background: activeSelection.state === 'active' ? 'var(--accent-subtle)' : 'var(--bg-base)',
          border: activeSelection.state === 'active' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
          color: activeSelection.state === 'active' ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: activeSelection.state === 'active' ? 700 : 500,
          cursor: 'pointer'
        }}
      >
        <GitBranch size={11} color={activeSelection.state === 'active' ? 'var(--accent)' : 'var(--text-muted)'} />
        <span>{activeLabel}</span>
        {activeSelection.state === 'active' && !activeCanExecute && <CircleAlert size={11} color="#D97706" />}
        <ChevronDown size={10} />
      </button>

      {notice && !isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '34px',
          left: 0,
          width: '280px',
          padding: '7px 9px',
          borderRadius: '6px',
          border: '1px solid var(--accent)',
          background: 'var(--bg-surface-elevated)',
          color: 'var(--text-secondary)',
          fontSize: '10px',
          lineHeight: 1.4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          zIndex: 220
        }}>
          {notice}
        </div>
      )}

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '36px',
          left: 0,
          width: 'min(430px, calc(100vw - 48px))',
          maxHeight: 'min(620px, 76vh)',
          overflowY: 'auto',
          padding: '10px',
          borderRadius: '9px',
          border: '1px solid var(--border-strong)',
          background: 'var(--bg-surface-elevated)',
          boxShadow: '0 16px 42px rgba(0,0,0,0.25)',
          zIndex: 300
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={13} color="var(--accent)" />
              <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>本次工作流</strong>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>原型发现结果</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="关闭工作流选择器" style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ marginTop: '8px', padding: '7px 8px', borderRadius: '6px', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.45 }}>
            已安装或已发现的工具不会自动启用。只有你点击确认后，Provider 才能影响当前任务。
          </div>

          {detectedMode && intent.source === 'explicit' && (
            <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--accent-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)', fontSize: '10.5px', fontWeight: 700 }}>
                <Check size={12} /> 已识别候选：{detectedProvider?.displayName || modeLabel(detectedMode)}
              </div>
              <div style={{ marginTop: '3px', color: 'var(--text-secondary)', fontSize: '10px' }}>这只是候选，不会自动进入 SDD/TDD 或外部 Provider 流程。</div>
              {detectedProvider && (
                <button type="button" onClick={() => selectProvider(detectedProvider)} style={{ marginTop: '6px', padding: '4px 7px', borderRadius: '4px', border: '1px solid var(--accent)', background: 'var(--bg-surface)', color: 'var(--accent)', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  查看并选择
                </button>
              )}
            </div>
          )}

          {intent.source === 'ambiguous' && (
            <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid #D97706', background: 'rgba(217, 119, 6, 0.08)', color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.45 }}>
              你提到了结构化开发，但没有指定范式。请从下方选择；不选择时仍保持普通任务模式。
            </div>
          )}

          <div style={{ position: 'relative', marginTop: '8px' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索 SDD、TDD、Superspec 或能力..."
              style={{ width: '100%', padding: '5px 8px 5px 25px', borderRadius: '5px', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '10.5px', outline: 'none' }}
            />
          </div>

          <button type="button" onClick={selectNormal} style={{ width: '100%', marginTop: '8px', padding: '7px 8px', textAlign: 'left', borderRadius: '6px', border: activeSelection.mode === 'normal' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', background: activeSelection.mode === 'normal' ? 'var(--accent-subtle)' : 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>普通任务模式</span>
              {activeSelection.mode === 'normal' && <Check size={13} color="var(--accent)" />}
            </div>
            <span style={{ display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '9.5px' }}>不启用 SDD、TDD 或外部工作流。</span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
            {providers.map(provider => {
              const isSelected = draft.providerId === provider.id && draft.state === 'selected';
              return (
                <button
                  type="button"
                  key={provider.id}
                  onClick={() => selectProvider(provider)}
                  style={{ width: '100%', padding: '7px 8px', textAlign: 'left', borderRadius: '6px', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>{provider.displayName}</span>
                    <span style={{ fontSize: '9px', color: provider.support === 'discovered_only' ? '#B45309' : '#15803D' }}>{provider.support === 'discovered_only' ? '已发现·未适配' : '可用'}</span>
                  </div>
                  <span style={{ display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '9.5px' }}>{provider.capabilities.join(' · ')}</span>
                </button>
              );
            })}
          </div>

          {selectedProvider && draft.state === 'selected' && (
            <div style={{ marginTop: '9px', padding: '8px', borderRadius: '6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                <ShieldCheck size={12} color="var(--accent)" /> {selectedProvider.displayName} · 启用前确认
              </div>
              <div style={{ marginTop: '5px', color: 'var(--text-muted)', fontSize: '9.5px', lineHeight: 1.5 }}>
                来源：{selectedProvider.source}<br />
                版本：{selectedProvider.version || '未声明'}<br />
                权限：{selectedProvider.permissions.join('、')}
              </div>
              {selectedProvider.support === 'discovered_only' && (
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', color: '#B45309', fontSize: '9.5px', lineHeight: 1.4 }}>
                  <CircleAlert size={12} /> <span>当前只确认发现，不会执行未知 CLI 或外部动作。</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
                <button type="button" onClick={cancelDraft} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer' }}>取消</button>
                <button type="button" onClick={confirmDraft} style={{ padding: '4px 9px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  {selectedProvider.support === 'discovered_only' ? '确认发现（暂不执行）' : '确认启用'}
                </button>
              </div>
            </div>
          )}

          {activeSelection.state === 'active' && activeProvider && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', color: activeCanExecute ? '#15803D' : '#B45309', fontSize: '9.5px' }}>
              {activeCanExecute ? <ShieldCheck size={12} /> : <CircleAlert size={12} />}
              {activeCanExecute ? '已启用，可进入该 Provider 的工作流。' : '已记录选择，但当前 Provider 只有发现信息，尚未适配执行。'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
