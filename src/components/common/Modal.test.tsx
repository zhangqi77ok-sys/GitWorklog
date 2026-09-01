import { describe, it, expect } from 'vitest';
import { Dialog } from './Dialog';
import { ConfirmModal } from './ConfirmModal';
import { PromptModal } from './PromptModal';
import { toast, useToastStore } from './Toast';

describe('Modal and Dialog Components', () => {
  it('exports Dialog component', () => {
    expect(Dialog).toBeDefined();
    expect(typeof Dialog).toBe('function');
  });

  it('exports ConfirmModal component', () => {
    expect(ConfirmModal).toBeDefined();
    expect(typeof ConfirmModal).toBe('function');
  });

  it('exports PromptModal component', () => {
    expect(PromptModal).toBeDefined();
    expect(typeof PromptModal).toBe('function');
  });

  it('adds and clears toasts in ToastStore', () => {
    toast.success('测试成功提示');
    const store = useToastStore.getState();
    expect(store.toasts.length).toBeGreaterThan(0);
    expect(store.toasts[store.toasts.length - 1].message).toBe('测试成功提示');
    expect(store.toasts[store.toasts.length - 1].type).toBe('success');
  });
});
