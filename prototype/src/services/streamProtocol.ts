export type StreamTermination =
  | 'completed'
  | 'stream_interrupted'
  | 'cancelled'
  | 'provider_empty_response'
  | 'tool_protocol_error';

export interface StreamTerminationInput {
  readerDone: boolean;
  sawDoneSentinel: boolean;
  sawFinishReason: boolean;
  aborted?: boolean;
  emptyResponse?: boolean;
  toolProtocolError?: boolean;
}

/**
 * Strict SSE lifecycle classification (RunEngine P0):
 * - AbortController -> cancelled
 * - HTTP 200 with zero bytes -> provider_empty_response
 * - unparseable data: event -> tool_protocol_error
 * - [DONE] or finish_reason -> completed
 * - EOF without a terminal event -> stream_interrupted (never completed)
 */
export function classifyStreamTermination(input: StreamTerminationInput): StreamTermination {
  if (input.aborted) return 'cancelled';
  if (input.emptyResponse) return 'provider_empty_response';
  if (input.toolProtocolError) return 'tool_protocol_error';
  if (input.sawDoneSentinel || input.sawFinishReason) return 'completed';
  return input.readerDone ? 'stream_interrupted' : 'stream_interrupted';
}

export function isNormalStreamTermination(input: StreamTerminationInput): boolean {
  return classifyStreamTermination(input) === 'completed';
}

export function describeStreamTermination(termination: StreamTermination): string {
  switch (termination) {
    case 'completed': return '正常完成';
    case 'cancelled': return '用户已取消';
    case 'provider_empty_response': return '上游返回空响应 (HTTP 200 无 Body)';
    case 'tool_protocol_error': return '工具协议解析失败 (data: 事件非法 JSON)';
    default: return '模型流在未收到正常完成信号前中断';
  }
}
