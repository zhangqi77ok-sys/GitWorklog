import { extractThinkingFromText, ThinkingBlockPayload, OpenAiProtocolType, DEFAULT_OPENAI_PROTOCOL, buildOpenAiRequestPayload } from '../types/contracts';

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
  openaiProtocol?: OpenAiProtocolType;
}

export class LlmStreamingClient {
  private abortController: AbortController | null = null;

  public async startStream(
    config: StreamRequestConfig,
    callbacks: StreamEventCallbacks
  ): Promise<void> {
    this.abortController = new AbortController();
    const startTime = Date.now();

    // If no real API key is provided, execute deterministic high-fidelity mock stream simulation
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
      for (let i = 0; i < mockStreamChunks.length; i++) {
        if (this.abortController.signal.aborted) break;
        await new Promise(r => setTimeout(r, 60));
        fullAccumulated += mockStreamChunks[i];
        const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
        const payload = extractThinkingFromText(fullAccumulated, elapsed);
        callbacks.onChunk(mockStreamChunks[i], fullAccumulated, payload);
      }

      const totalElapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const finalPayload = extractThinkingFromText(fullAccumulated, totalElapsed);
      callbacks.onDone(fullAccumulated, finalPayload);
      return;
    }

    // Real SSE Network Request (OpenAI / DeepSeek / Ollama compatible endpoint)
    try {
      const endpoint = config.endpointUrl || 'https://api.deepseek.com/chat/completions';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: config.prompt }],
          stream: true,
          temperature: config.temperature ?? 0.3
        }),
        signal: this.abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullAccumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        const lines = textChunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const rawJson = line.replace('data: ', '').trim();
          if (rawJson === '[DONE]') break;
          try {
            const parsed = JSON.parse(rawJson);
            const content = parsed.choices?.[0]?.delta?.content || parsed.message?.content || '';
            if (content) {
              fullAccumulated += content;
              const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
              const payload = extractThinkingFromText(fullAccumulated, elapsed);
              callbacks.onChunk(content, fullAccumulated, payload);
            }
          } catch {
            // Ignore partial SSE chunk parse error
          }
        }
      }

      const totalElapsed = Number(((Date.now() - startTime) / 1000).toFixed(1));
      const finalPayload = extractThinkingFromText(fullAccumulated, totalElapsed);
      callbacks.onDone(fullAccumulated, finalPayload);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError(err as Error);
      }
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const defaultStreamingClient = new LlmStreamingClient();
