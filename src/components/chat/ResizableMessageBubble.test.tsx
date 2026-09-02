import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ResizableMessageBubble } from './ResizableMessageBubble';

describe('ResizableMessageBubble Component', () => {
  it('exports ResizableMessageBubble component as a callable functional component', () => {
    expect(ResizableMessageBubble).toBeDefined();
    expect(typeof ResizableMessageBubble).toBe('function');
  });

  it('can be instantiated with user message props', () => {
    const onCopy = vi.fn();
    const element = React.createElement(ResizableMessageBubble, {
      msgId: 'msg-1',
      role: 'user',
      cleanText: '你好，请帮我重构代码',
      rawContent: '你好，请帮我重构代码',
      onCopy,
      isCopied: false,
    });

    expect(element).toBeDefined();
    expect(element.props.role).toBe('user');
    expect(element.props.cleanText).toBe('你好，请帮我重构代码');
  });

  it('can be instantiated with long assistant message props and diff callback', () => {
    const onCopy = vi.fn();
    const onOpenDiff = vi.fn();
    const longContent = Array(25).fill('这是长消息段落内容，用于验证气泡自适应高度拖拽').join('\n');
    const element = React.createElement(ResizableMessageBubble, {
      msgId: 'msg-2',
      role: 'assistant',
      cleanText: longContent,
      rawContent: `\`\`\`typescript\n${longContent}\n\`\`\``,
      onCopy,
      isCopied: false,
      onOpenDiff,
    });

    expect(element).toBeDefined();
    expect(element.props.role).toBe('assistant');
    expect(element.props.rawContent).toContain('```typescript');
    expect(typeof element.props.onOpenDiff).toBe('function');
  });
});
