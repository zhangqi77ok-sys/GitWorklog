import { AccountRegistry, assertAccountCredential } from './accounts';
import { DownstreamKeyStore } from './keys';
import { UsageLedger, computeCost, DEFAULT_PRICING, EMPTY_USAGE, addUsage } from './usage';
import { createSchedulerState, selectAccount, bindSticky } from './scheduler';
import { RequestTransformer, type GatewayMessage, type ToolDef } from './transform';
import { buildUpstreamRequest, adapterFor } from './adapters';
import { parseGatewayEvent } from '../modelGateway';
import type { GatewayAccount, GatewayPlatform, RouteDecision, SchedulerState, TokenUsage, UsageRecord } from './types';

export interface GatewayRequest {
  downstreamKey: string;
  model: string;
  platform: GatewayPlatform;
  sessionKey?: string;
  preferredAccountId?: string;
  messages: GatewayMessage[];
  systemPrompt?: string;
  temperature?: number;
  tools?: ToolDef[];
  contextLimit?: number;
  defaultMaxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface PreparedGatewayRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  accountId: string;
  adapter: ReturnType<typeof adapterFor>;
  decision: RouteDecision;
}
export interface GatewayResult {
  content: string;
  thinking?: string;
  accountId: string;
  model: string;
  usage: TokenUsage;
  costUsd: number;
  decision: RouteDecision;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

export interface GatewayFacadeDeps {
  registry: AccountRegistry;
  schedulerState: SchedulerState;
  keys: DownstreamKeyStore;
  ledger: UsageLedger;
  fetchImpl?: typeof fetch;
  resolveProxy?: (targetUrl: string) => { url: string; headers: Record<string, string> };
  now?: () => number;
}

export class GatewayError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
    public readonly accountId?: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

function isRetryable(status: number | undefined, message: string): boolean {
  if (status !== undefined && RETRYABLE_STATUS.has(status)) return true;
  return /rate|quota|exhausted|overloaded|timeout|cloudflare|temporarily/i.test(message);
}

function extractUsage(parsed: Record<string, any>): TokenUsage | undefined {
  const u = parsed.usage;
  if (!u) return undefined;
  const inputTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const outputTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  const cached = Number(u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0);
  return { inputTokens, outputTokens, cacheReadTokens: cached, cacheWriteTokens: 0 };
}

export class GatewayFacade {
  private readonly fetchImpl: typeof fetch;
  private readonly resolveProxy: (targetUrl: string) => { url: string; headers: Record<string, string> };
  private readonly now: () => number;

  public constructor(private readonly deps: GatewayFacadeDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.resolveProxy = deps.resolveProxy ?? ((url: string) => ({ url, headers: {} }));
    this.now = deps.now ?? (() => Date.now());
  }

  public async request(req: GatewayRequest): Promise<GatewayResult> {
    // 1. Downstream key distribution gate.
    const keyCheck = this.deps.keys.validate(req.downstreamKey, req.model);
    if (!keyCheck.ok) {
      const status = keyCheck.reason === 'not_found' || keyCheck.reason === 'disabled' ? 401 : 403;
      throw new GatewayError(`Invalid downstream key: ${keyCheck.reason}`, status, undefined, false);
    }

    const now = this.now();
    const contextLimit = req.contextLimit ?? 128_000;
    const defaultMaxOutputTokens = req.defaultMaxOutputTokens ?? 8192;
    const messages: GatewayMessage[] = req.systemPrompt
      ? [{ role: 'system', content: req.systemPrompt }, ...req.messages]
      : req.messages;

    const attempted: string[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      // 2. Smart scheduling (sticky / preferred / LRU / failover).
      const decision = selectAccount(
        this.deps.registry.byPlatform(req.platform),
        {
          model: req.model,
          platform: req.platform,
          sessionKey: req.sessionKey,
          preferredAccountId: req.preferredAccountId,
          excludeAccountIds: attempted
        },
        this.deps.schedulerState,
        now
      );
      const account = decision.account;
      attempted.push(account.id);

      // 3. Fail-closed credential check.
      assertAccountCredential(account);

      // 4. Request transformation (protocol + compat fixes).
      const transformer = new RequestTransformer({
        platform: req.platform,
        codexOAuth: account.authType !== 'api_key',
        contextLimit,
        defaultMaxOutputTokens
      });
      const body = transformer.transform({
        model: req.model,
        messages,
        temperature: req.temperature,
        stream: true,
        tools: req.tools
      });
      const spec = buildUpstreamRequest(account, body);
      const proxied = this.resolveProxy(spec.url);

      this.deps.registry.markConcurrency(account.id, +1);
      try {
        const response = await this.fetchImpl(proxied.url, {
          method: 'POST',
          signal: req.signal,
          headers: { 'Content-Type': 'application/json', ...spec.headers, ...proxied.headers },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          const error = new Error(`HTTP ${response.status}: ${(response.statusText || text).slice(0, 240)}`);
          if (isRetryable(response.status, text)) throw error;
          throw new GatewayError(`上游错误: ${error.message}`, response.status, account.id, false);
        }

        // 5. Stream + normalize events; capture usage even on disconnect.
        const { content, thinking, toolCalls, usage } = await this.consumeStream(
          response,
          adapterFor(req.platform),
          req.signal
        );

        this.deps.registry.markSuccess(account.id);
        if (req.sessionKey) {
          bindSticky(this.deps.schedulerState, req.sessionKey, account.id, account.stickySessionTtlMs, now);
        }

        const finalUsage = usage ?? { ...EMPTY_USAGE };
        const pricing = DEFAULT_PRICING[req.model] ?? { inputPerM: 0.1, outputPerM: 0.2 };
        const costUsd = computeCost(finalUsage, pricing);
        const record: UsageRecord = {
          id: `usage-${now}-${Math.random().toString(36).slice(2, 8)}`,
          accountId: account.id,
          downstreamKeyId: keyCheck.key.id,
          model: req.model,
          sessionKey: req.sessionKey ?? '',
          inputTokens: finalUsage.inputTokens,
          outputTokens: finalUsage.outputTokens,
          cacheReadTokens: finalUsage.cacheReadTokens,
          cacheWriteTokens: finalUsage.cacheWriteTokens,
          costUsd,
          startedAt: now,
          finishedAt: this.now(),
          status: 'ok'
        };
        this.deps.ledger.record(record);
        this.deps.keys.recordUsage(keyCheck.key.id, finalUsage);

        return { content, thinking, accountId: account.id, model: req.model, usage: finalUsage, costUsd, decision, toolCalls };
      } catch (err) {
        const error = err as Error;
        if (error.name === 'AbortError') throw error;
        this.deps.registry.markError(account.id, error.message);
        if (error instanceof GatewayError && !error.retryable) throw error;
                lastError = error;
        // retryable (429/5xx/network) -> continue to next account
      } finally {
        this.deps.registry.markConcurrency(account.id, -1);
      }
    }

    throw new GatewayError(`所有账号均失败: ${lastError?.message ?? 'unknown'}`, 503, undefined, false);
  }

  /**
   * Resolves an account + transformed request WITHOUT fetching, so callers can
   * drive their own incremental streaming loop (used by the desktop Agent Loop).
   */
  public prepare(req: {
    model: string;
    platform: GatewayPlatform;
    sessionKey?: string;
    preferredAccountId?: string;
    messages: GatewayMessage[];
    systemPrompt?: string;
    temperature?: number;
    tools?: ToolDef[];
    contextLimit?: number;
    defaultMaxOutputTokens?: number;
  }): PreparedGatewayRequest {
    const now = this.now();
    const contextLimit = req.contextLimit ?? 128_000;
    const defaultMaxOutputTokens = req.defaultMaxOutputTokens ?? 8192;
    const decision = selectAccount(
      this.deps.registry.byPlatform(req.platform),
      { model: req.model, platform: req.platform, sessionKey: req.sessionKey, preferredAccountId: req.preferredAccountId },
      this.deps.schedulerState,
      now
    );
    const account = decision.account;
    assertAccountCredential(account);

    const messages: GatewayMessage[] = req.systemPrompt
      ? [{ role: 'system', content: req.systemPrompt }, ...req.messages]
      : req.messages;
    const transformer = new RequestTransformer({
      platform: req.platform,
      codexOAuth: account.authType !== 'api_key',
      contextLimit,
      defaultMaxOutputTokens
    });
    const body = transformer.transform({
      model: req.model,
      messages,
      temperature: req.temperature,
      stream: true,
      tools: req.tools
    });
    const spec = buildUpstreamRequest(account, body);
    const proxied = this.resolveProxy(spec.url);
    this.deps.registry.markConcurrency(account.id, +1);
    return {
      url: proxied.url,
      headers: { 'Content-Type': 'application/json', ...spec.headers, ...proxied.headers },
      body,
      accountId: account.id,
      adapter: adapterFor(req.platform),
      decision
    };
  }

  /**
   * Records token-level usage + cost after a caller-driven stream, and releases
   * the concurrency slot reserved by prepare().
   */
  public recordCompletion(input: {
    accountId: string;
    downstreamKeyId: string;
    model: string;
    sessionKey: string;
    usage: TokenUsage;
    status: UsageRecord['status'];
  }): void {
    const now = this.now();
    const pricing = DEFAULT_PRICING[input.model] ?? { inputPerM: 0.1, outputPerM: 0.2 };
    const costUsd = computeCost(input.usage, pricing);
    const record: UsageRecord = {
      id: `usage-${now}-${Math.random().toString(36).slice(2, 8)}`,
      accountId: input.accountId,
      downstreamKeyId: input.downstreamKeyId,
      model: input.model,
      sessionKey: input.sessionKey,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheReadTokens: input.usage.cacheReadTokens,
      cacheWriteTokens: input.usage.cacheWriteTokens,
      costUsd,
      startedAt: now,
      finishedAt: now,
      status: input.status
    };
    this.deps.ledger.record(record);
    const key = this.deps.keys.findByKey(input.downstreamKeyId);
    this.deps.keys.recordUsage(key?.id ?? input.downstreamKeyId, input.usage);
    if (input.status === 'ok') this.deps.registry.markSuccess(input.accountId);
    else this.deps.registry.markError(input.accountId, `completion ${input.status}`);
    this.deps.registry.markConcurrency(input.accountId, -1);
  }

  public issueDownstreamKey(input: { name: string; groups?: string[]; modelAllowlist?: string[] | null; dailyTokenBudget?: number }) {
    return this.deps.keys.issue(input);
  }

  public revokeDownstreamKey(keyId: string): void {
    this.deps.keys.revoke(keyId);
  }

  public getBalance(keyId: string): TokenUsage {
    return this.deps.keys.getUsedTokens(keyId);
  }

  private async consumeStream(
    response: Response,
    adapter: ReturnType<typeof adapterFor>,
    signal?: AbortSignal
  ): Promise<{ content: string; thinking: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; usage?: TokenUsage }> {
    if (!response.body) throw new GatewayError('模型流异常: 上游返回空响应 (HTTP 200 无 Body)', 502, undefined, false);

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let content = '';
    let thinking = '';
    let sawDone = false;
    let receivedAnyBytes = false;
    let toolProtocolError = false;
    let sawFinish = false;
    let usage: TokenUsage | undefined;
    const merged = new Map<string, { name: string; arguments: string }>();

    while (!sawDone && !sawFinish) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      receivedAnyBytes = true;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6).trim();
        if (raw === '[DONE]') { sawDone = true; break; }
        let parsed: Record<string, any>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // P0: unparseable tool protocol must be surfaced, never silently swallowed.
          toolProtocolError = true;
          break;
        }
        const streamed = extractUsage(parsed);
        if (streamed) usage = addUsage(usage ?? { ...EMPTY_USAGE }, streamed);
        const normalized = parseGatewayEvent(adapter, parsed);
        if (normalized.reasoning) thinking += normalized.reasoning;
        if (normalized.content) content += normalized.content;
        for (const call of normalized.toolCalls) {
          const current = merged.get(call.id) ?? { name: call.name || '', arguments: '' };
          current.name = current.name || call.name || '';
          current.arguments += call.arguments || '';
          merged.set(call.id, current);
        }
        if (normalized.finished) sawFinish = true;
      }
      if (signal?.aborted) throw new GatewayError('请求已取消', 499, undefined, false);
    }

    const toolCalls = Array.from(merged.entries()).map(([id, call]) => ({ id, name: call.name, arguments: call.arguments }));

    if (!sawDone && !sawFinish) {
      if (!receivedAnyBytes) {
        throw new GatewayError('模型流异常: 上游返回空响应 (HTTP 200 无 Body)', 502, undefined, false);
      }
      if (toolProtocolError) {
        throw new GatewayError('模型流异常: 工具协议解析失败 (data: 事件非法 JSON)', 502, undefined, false);
      }
      throw new GatewayError('模型流中断：EOF without normal termination signal', 502, undefined, false);
    }
    return { content, thinking, toolCalls, usage };
  }
}

export { createSchedulerState };


