import { describe, expect, it } from 'vitest';
import { classifyStreamTermination } from '../src/services/streamProtocol';
import { parseAgentMessage } from '../src/types/contracts';

describe('stream and tool protocol termination contract', () => {
  it('treats explicit DONE or finish reason as normal completion', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: true, sawFinishReason: false })).toBe('completed');
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: true })).toBe('completed');
  });

  it('treats EOF without a terminal event as interrupted instead of completed', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: false })).toBe('stream_interrupted');
  });

  it('does not classify an intentional abort as a provider failure', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: false, aborted: true })).toBe('cancelled');
  });

  it('classifies an HTTP 200 empty body as provider_empty_response', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: false, sawFinishReason: false, emptyResponse: true })).toBe('provider_empty_response');
  });

  it('classifies an unparseable data: event as tool_protocol_error', () => {
    expect(classifyStreamTermination({ readerDone: false, sawDoneSentinel: false, sawFinishReason: false, toolProtocolError: true })).toBe('tool_protocol_error');
  });

  it('never lets empty-body or protocol errors masquerade as completed', () => {
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: true, sawFinishReason: false, emptyResponse: true })).toBe('provider_empty_response');
    expect(classifyStreamTermination({ readerDone: true, sawDoneSentinel: true, sawFinishReason: false, toolProtocolError: true })).toBe('tool_protocol_error');
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

