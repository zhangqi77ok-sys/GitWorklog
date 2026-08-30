import { describe, expect, it } from 'vitest';
import { classifyStreamTermination } from '../src/services/streamProtocol';
import { parseAgentMessage } from '../src/types/contracts';

describe('stream and tool protocol termination contract', () => {
  it('treats explicit DONE or finish reason as normal completion', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: true, sawFinishReason: false })).toBe('completed');
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: true })).toBe('completed');
  });

  it('treats EOF without a terminal event as interrupted instead of completed', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: false })).toBe('interrupted');
  });

  it('does not classify an intentional abort as a provider failure', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: false, aborted: true })).toBe('cancelled');
  });

  it('normalizes generic XML tool_call blocks without leaking them as assistant content', () => {
    const parsed = parseAgentMessage([
      '我先检查文件。',
      '<tool_call><read_file>',
      '<arg_key>path</arg_key><arg_value>src/App.tsx</arg_value>',
      '</read_file></tool_call>'
    ].join(''));

    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0]).toMatchObject({ name: 'read_file' });
    expect(parsed.toolCalls[0].parameters.path).toBe('src/App.tsx');
    expect(parsed.cleanContent).toBe('我先检查文件。');
  });
});
