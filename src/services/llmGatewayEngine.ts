import { LLMChannel } from "../types";
import { gatewayBus } from "./bus/GatewayBus";
import {
  ReActStepNode,
  ReActTraceState,
  ActionRiskLevel,
} from "../types/contracts";

export interface StreamEventCallbacks {
  onToken: (chunk: string, reasoningChunk?: string) => void;
  onReActStep?: (step: ReActStepNode, trace: ReActTraceState) => void;
  onRequireApproval?: (
    step: ReActStepNode,
    resolve: (approved: boolean) => void
  ) => void;
  onComplete: (metadata: {
    durationMs: number;
    tokensCount: number;
    tokensPerSec: number;
    trace?: ReActTraceState;
  }) => void;
  onError: (error: string, statusCode?: number) => void;
}

export interface SendMessageParams {
  channel: LLMChannel;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  abortSignal?: AbortSignal;
  callbacks: StreamEventCallbacks;
}

class LLMGatewayEngine {
  private generateRequestId(): string {
    return "req-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
  }

  /**
   * 动作风险等级评估 (Safety Evaluation)
   */
  public evaluateActionRisk(actionName: string, _args: Record<string, any>): ActionRiskLevel {
    if (actionName.includes("delete") || actionName.includes("drop") || actionName.includes("rmdir")) {
      return "CRITICAL";
    }
    if (actionName.includes("write") || actionName.includes("modify") || actionName.includes("execute_command")) {
      return "HIGH";
    }
    if (actionName.includes("install") || actionName.includes("build")) {
      return "MEDIUM";
    }
    return "LOW";
  }

  /**
   * 统一大模型网关调度分发入口 (真实流式分发与审计追踪)
   */
  public async dispatchStream(params: SendMessageParams): Promise<void> {
    const {
      channel,
      model,
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      enableThinking = true,
      reasoningEffort,
      abortSignal,
      callbacks,
    } = params;

    const startTime = performance.now();
    const requestId = this.generateRequestId();

    const traceState: ReActTraceState = {
      traceId: requestId,
      currentStepIndex: 0,
      steps: [],
      isCompleted: false,
      hasError: false,
    };

    const hasValidCredentials =
      Boolean(channel.apiKey?.trim()) ||
      channel.type === "ollama" ||
      channel.type === "opencode";

    if (!hasValidCredentials) {
      const errMsg = `【${channel.name}】未配置 API Key：请在渠道设置中填入有效的密钥或中转站凭据。`;
      gatewayBus.getAuditSubline().recordLog({
        engineId: channel.id,
        relayType: channel.relayMode || "direct",
        model,
        durationMs: 0,
        tokensCount: 0,
        tokensPerSec: 0,
        statusCode: 401,
        status: "error",
        errorMessage: errMsg,
        promptSnippet: messages[messages.length - 1]?.content.slice(0, 80),
      });
      callbacks.onError(errMsg, 401);
      return;
    }

    let attempt = 0;
    const maxRetries = 2;
    let lastErr: any = null;

    while (attempt <= maxRetries) {
      if (abortSignal?.aborted) return;
      try {
        await this.executeRealStream({
          channel,
          model,
          messages,
          temperature,
          maxTokens,
          enableThinking,
          reasoningEffort,
          abortSignal,
          startTime,
          requestId,
          traceState,
          callbacks,
        });
        return;
      } catch (err: any) {
        lastErr = err;
        if (err.name === "AbortError" || abortSignal?.aborted) {
          const durationMs = Math.round(performance.now() - startTime);
          callbacks.onComplete({
            durationMs,
            tokensCount: 1,
            tokensPerSec: 1,
            trace: traceState,
          });
          return;
        }

        attempt++;
        if (attempt <= maxRetries) {
          const delay = Math.pow(2, attempt) * 300 + Math.random() * 200;
          console.warn(`[LLMGateway] Transient error, retrying (${attempt}/${maxRetries}) in ${Math.round(delay)}ms:`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    traceState.hasError = true;
    gatewayBus.getAuditSubline().recordLog({
      engineId: channel.id,
      relayType: channel.relayMode || "direct",
      model,
      durationMs: Math.round(performance.now() - startTime),
      tokensCount: 0,
      tokensPerSec: 0,
      statusCode: 500,
      status: "error",
      errorMessage: lastErr?.message || "网络超时或鉴权失败",
      promptSnippet: messages[messages.length - 1]?.content.slice(0, 80),
    });
    callbacks.onError(
      `【${channel.name}】端点连接失败：${lastErr?.message || "网络超时或鉴权失败"}

请求幂等 ID: ${requestId}
已自动执行 ${maxRetries} 次退避重试。请检查 Base URL (${channel.baseUrl}) 配置。`,
      500
    );
  }

  /**
   * 真实 SSE 请求 (含背压排空与 Token 缓冲池)
   */
  private async executeRealStream(options: {
    channel: LLMChannel;
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    maxTokens: number;
    enableThinking: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    abortSignal?: AbortSignal;
    startTime: number;
    requestId: string;
    traceState: ReActTraceState;
    callbacks: StreamEventCallbacks;
  }): Promise<void> {
    const {
      channel,
      model,
      messages,
      temperature,
      maxTokens,
      enableThinking,
      reasoningEffort,
      abortSignal,
      startTime,
      requestId,
      traceState,
      callbacks,
    } = options;

    let targetUrl = channel.baseUrl.trim();
    if (!targetUrl.endsWith("/")) targetUrl += "/";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      "X-Client-Platform": "CodeMind-Studio-Desktop",
    };

    if (channel.relayMode === "newapi" && channel.newApiChannelId?.trim()) {
      headers["New-Api-Channel"] = channel.newApiChannelId.trim();
      headers["X-Channel-Id"] = channel.newApiChannelId.trim();
    }

    if (channel.apiKey && channel.apiKey !== "opencode-local") {
      headers["Authorization"] = `Bearer ${channel.apiKey}`;
    }

    let endpoint = targetUrl + "chat/completions";
    let body: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    if (enableThinking) {
      body.stream_options = { include_usage: true };
    }
    if (reasoningEffort === "high") {
      body.reasoning_effort = "high";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error("HTTP 响应体为空，无法读取流式事件");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let totalTokens = 0;

    let pendingContent = "";
    let pendingReasoning = "";
    let isFlushing = false;

    const flushTokensToUI = () => {
      if (pendingContent || pendingReasoning) {
        callbacks.onToken(pendingContent, pendingReasoning);
        pendingContent = "";
        pendingReasoning = "";
      }
      isFlushing = false;
    };

    const scheduleFlush = () => {
      if (!isFlushing) {
        isFlushing = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(flushTokensToUI);
        } else {
          setTimeout(flushTokensToUI, 16);
        }
      }
    };

    try {
      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            if (choice) {
              const delta = choice.delta;
              if (delta) {
                if (delta.content) {
                  pendingContent += delta.content;
                  totalTokens++;
                }
                if (delta.reasoning_content || delta.reasoning) {
                  pendingReasoning += delta.reasoning_content || delta.reasoning;
                  totalTokens++;
                }
                scheduleFlush();
              }
            }
          } catch (e) {}
        }
      }
    } finally {
      flushTokensToUI();
      reader.releaseLock();
    }

    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    const tokensPerSec = Math.round((totalTokens / (durationMs / 1000)) * 10) / 10;

    traceState.isCompleted = true;
    gatewayBus.getAuditSubline().recordLog({
      engineId: channel.id,
      relayType: channel.relayMode || "direct",
      model,
      durationMs,
      tokensCount: totalTokens,
      tokensPerSec: tokensPerSec > 0 ? tokensPerSec : 25,
      statusCode: 200,
      status: "success",
      promptSnippet: messages[messages.length - 1]?.content.slice(0, 80),
    });

    callbacks.onComplete({
      durationMs,
      tokensCount: totalTokens,
      tokensPerSec: tokensPerSec > 0 ? tokensPerSec : 25,
      trace: traceState,
    });
  }
}

export const llmGatewayEngine = new LLMGatewayEngine();
