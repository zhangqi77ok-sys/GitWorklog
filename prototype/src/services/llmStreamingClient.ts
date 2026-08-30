import { extractThinkingFromText, ThinkingBlockPayload } from '../types/contracts';
import {
  buildGatewayRequestBody,
  parseGatewayEvent,
  ModelAdapter
} from './modelGateway';

export interface StreamEventCallbacks {
  onChunk: (chunkText: string, fullText: string, thinkingPayload: ThinkingBlockPayload) => void;
  onDone: (fullText: string, thinkingPayload: ThinkingBlockPayload) => void;
  onError: (err: Error) => void;
}

export interface StreamRequestConfig {
  endpointUrl?: string;
  apiKey?: string;
  model: string;
  prompt: string;
  temperature?: number;
  adapter?: ModelAdapter;
}

export class LlmStreamingClient {
  private abortController: AbortController | null = null;

  public async startStream(
    config: StreamRequestConfig,
    callbacks: StreamEventCallbacks
  ): Promise<void> {
    this.abortController = new AbortController();
    const startTime = Date.now();

    if (!config.apiKey && !config.endpointUrl?.includes('11434')) {
      const mockStreamChunks = [
        '<think>\n',
        '首先分析用户指令意图：用户需要重构三栏流体布局与 Store 状态契约。\n',
        '评估技术影响面：涉及 SessionItem、ChatMessage 以及 LeftPanel、EditorWorkspace。\n',
        '确定方案：采用纯函数契约先行，注入 AST 静态校验。\n',
        '</think>\n\n',
        '已为您完成三栏自适应流体布局的深度重构：\n',
        '1. **状态统一**：所有布局宽度与折叠状态已收敛至 `useAppStore`；\n',
        '2. **性能保障**：拖拽过程启用 `requestAnimationFrame` 防抖节流；\n',
        '3. **质量闭环**：通过 58+ 项契约单测验证。'
      ];

      let fullAccumulated = '';
      for (const chunk of mockStreamChunks) {
        if (this.abortController.signal.aborted) return;
        await new Promise(resolve => setTimeout(resolve, 60));
        fullAccumulated += chunk;
        const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
        callbacks.onChunk(chunk, fullAccumulated, extractThinkingFromText(fullAccumulated, elapsed));
      }
      const totalElapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
      callbacks.onDone(fullAccumulated, extractThinkingFromText(fullAccumulated, totalElapsed));
      return;
    }

    try {
      const endpoint = config.endpointUrl || 'https://api.deepseek.com/v1/chat/completions';
      const adapter = config.adapter || 'openai-compatible-chat';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify(buildGatewayRequestBody({
          providerId: 'runtime',
          modelId: config.model,
          endpointUrl: endpoint,
          adapter,
          protocol: adapter === 'openai-responses' ? 'responses' : adapter === 'anthropic-messages' ? 'anthropic_messages' : adapter === 'google-generative-language' ? 'google_native' : 'chat_completions',
          apiKey: config.apiKey || ''
        }, [{ role: 'user', content: config.prompt }], true, config.temperature ?? 0.3)),
        signal: this.abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullAccumulated = '';
      let buffer = '';
      let sawDoneSentinel = false;
      let sawFinishReason = false;
      let readerDone = false;

      while (!sawDoneSentinel && !sawFinishReason) {
        const { done, value } = await reader.read();
        if (done) {
          readerDone = true;
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const rawJson = trimmed.slice(6).trim();
          if (rawJson === '[DONE]') {
            sawDoneSentinel = true;
            break;
          }
          try {
            const normalized = parseGatewayEvent(adapter, JSON.parse(rawJson));
            if (normalized.content || normalized.reasoning) {
              const chunk = `${normalized.reasoning}${normalized.content}`;
              fullAccumulated += chunk;
              const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
              callbacks.onChunk(chunk, fullAccumulated, extractThinkingFromText(fullAccumulated, elapsed));
            }
            if (normalized.finished) sawFinishReason = true;
          } catch (error) {
            throw new Error(`流事件解析失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      if (!sawDoneSentinel && !sawFinishReason) {
        throw new Error(readerDone ? '模型流在正常完成信号前结束' : '模型流未返回正常完成信号');
      }
      const totalElapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
      callbacks.onDone(fullAccumulated, extractThinkingFromText(fullAccumulated, totalElapsed));
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') callbacks.onError(err as Error);
    }
  }

  public abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

export const defaultStreamingClient = new LlmStreamingClient();
