import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer Component', () => {
  it('is defined and is a valid React component function', () => {
    expect(MarkdownRenderer).toBeDefined();
    expect(typeof MarkdownRenderer).toBe('function');
  });

  it('renders null when content is empty', () => {
    const res = MarkdownRenderer({ content: '' });
    expect(res).toBeNull();
  });
});
