import { describe, expect, it } from 'vitest';
import {
  canExecuteWorkflowProvider,
  cancelWorkflowSelection,
  classifyWorkflowIntent,
  confirmWorkflowSelection,
  createWorkflowSelection,
  filterWorkflowProviders,
  type WorkflowProviderManifest
} from '../src/services/workflowProviderDiscovery';

const superspec: WorkflowProviderManifest = {
  id: 'superspec',
  displayName: 'Superspec',
  version: '1.2.0',
  kind: 'user',
  source: 'C:/Users/demo/.superspec',
  support: 'discovered_only',
  capabilities: ['spec', 'task_breakdown'],
  phases: [],
  permissions: ['read_files']
};

const nativeTdd: WorkflowProviderManifest = {
  id: 'builtin-tdd',
  displayName: 'TDD',
  version: 'builtin',
  kind: 'builtin',
  source: 'Tcode 内置',
  support: 'native',
  capabilities: ['tdd', 'verification'],
  phases: [{ id: 'red', title: 'TDD Red', requiresUserConfirmation: true }],
  permissions: ['read_files', 'write_files', 'run_commands']
};

describe('Workflow Provider intent resolution', () => {
  it('keeps an ordinary bug-fix request in normal mode', () => {
    const intent = classifyWorkflowIntent('请帮我修复窗口启动位置问题');
    expect(intent.mode).toBe('normal');
    expect(intent.source).toBe('none');
    expect(intent.userConfirmed).toBe(false);
  });

  it('does not activate TDD when the user is only asking what TDD means', () => {
    const intent = classifyWorkflowIntent('什么是 TDD？请解释一下它和 SDD 的区别');
    expect(intent.mode).toBe('normal');
    expect(intent.userConfirmed).toBe(false);
  });

  it('recognizes an explicit combined SDD and TDD request without auto-confirming it', () => {
    const intent = classifyWorkflowIntent('请使用 SDD + TDD 完成这个功能');
    expect(intent.mode).toBe('sdd_tdd');
    expect(intent.source).toBe('explicit');
    expect(intent.userConfirmed).toBe(false);
  });

  it('treats an installed Superspec mention as discovery, not activation', () => {
    const intent = classifyWorkflowIntent('我安装了 Superspec');
    expect(intent.mode).toBe('normal');
    expect(intent.source).toBe('none');
    expect(intent.userConfirmed).toBe(false);
  });

  it('lets an explicit Superspec request become a custom candidate', () => {
    const intent = classifyWorkflowIntent('请使用 Superspec 处理这次需求');
    expect(intent.mode).toBe('custom');
    expect(intent.providerId).toBe('superspec');
    expect(intent.source).toBe('explicit');
    expect(intent.userConfirmed).toBe(false);
  });

  it('lets explicit negative intent override workflow keywords', () => {
    const intent = classifyWorkflowIntent('不要使用 SDD 或 TDD，直接给我普通实现');
    expect(intent.mode).toBe('normal');
    expect(intent.source).toBe('negative');
    expect(intent.userConfirmed).toBe(false);
  });
});

describe('Workflow Provider selection lifecycle', () => {
  it('filters discovered providers without changing their activation state', () => {
    const result = filterWorkflowProviders([superspec, nativeTdd], 'spec');
    expect(result.map(provider => provider.id)).toEqual(['superspec']);
    expect(result[0].support).toBe('discovered_only');
  });

  it('requires explicit confirmation before a provider becomes active', () => {
    const selected = createWorkflowSelection(superspec, 'custom');
    expect(selected.state).toBe('selected');
    expect(canExecuteWorkflowProvider(superspec, selected)).toBe(false);

    const active = confirmWorkflowSelection(selected, 1000);
    expect(active.state).toBe('active');
    expect(active.confirmedAt).toBe(1000);
    expect(canExecuteWorkflowProvider(superspec, active)).toBe(false);
  });

  it('allows native and manifest adapters to execute after confirmation', () => {
    const selected = createWorkflowSelection(nativeTdd, 'tdd');
    const active = confirmWorkflowSelection(selected, 2000);
    expect(active.state).toBe('active');
    expect(canExecuteWorkflowProvider(nativeTdd, active)).toBe(true);
  });

  it('cancelling a selection never activates the provider', () => {
    const selected = createWorkflowSelection(nativeTdd, 'tdd');
    const cancelled = cancelWorkflowSelection(selected);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.confirmedAt).toBeUndefined();
    expect(canExecuteWorkflowProvider(nativeTdd, cancelled)).toBe(false);
  });
});
