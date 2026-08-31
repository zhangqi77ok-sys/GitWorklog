import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGatewayStreamChat,
  GatewayStreamChatDeps,
} from '../src/services/swarmGatewayStream';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(new TextEncoder().encode(c)));
      controller.close();
    },
  });
}

const sseChunks = [
  'data: {"content":"你"}\n\n',
  'data: {"content":"好"}\n\n',
  'data: [DONE]\n\n',
];

function makeDeps(overrides: Partial<GatewayStreamChatDeps> = {}): GatewayStreamChatDeps {
  return {
    streamingModel: { id: 'gpt-5.2', name: 'GPT-5.2', providerId: 'openai' },
    sessionKey: 'sess-1',
    gatewayRuntime: {
      facade: {
        prepare: vi.fn().mockReturnValue({
          url: 'http://gw.local/v1/chat',
          headers: { 'X-Gw': '1' },
          body: { model: 'gpt-5.2' },
          adapter: 'openai-compatible-chat',
          accountId: 'acct-1',
        }),
      },
    },
    hasGatewayAccountsFor: () => true,
    platformForProvider: () => 'openai',
    loadSavedProviders: () => [],
    loadSavedChannels: () => [],
    buildModelCatalogEntry: vi.fn(),
    resolveModelRoute: vi.fn(),
    buildGatewayRequestBody: vi.fn(),
    parseGatewayEvent: (adapter: string, raw: any) => ({ content: raw.content, reasoning: '', toolCalls: [], finished: raw.finished }),
    resolveApiEndpoint: (u: string) => ({ url: u, headers: {} }),
    addLog: vi.fn(),
    ...overrides,
  };
}

async function okResponse(body: ReadableStream<Uint8Array>): Promise<Response> {
  return { ok: true, status: 200, body } as unknown as Response;
}

describe('createGatewayStreamChat', () => {
  it('routes through Gateway v2 and streams SSE deltas', async () => {
    const deps = makeDeps();
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(sseChunks)));
    vi.stubGlobal('fetch', fetchMock);

    const deltas: string[] = [];
    const streamChat = createGatewayStreamChat(deps);
    const full = await streamChat({
      system: 'sys',
      user: 'user',
      modelId: 'gpt-5.2',
      onDelta: d => deltas.push(d),
    });

    expect(full).toBe('你好');
    expect(deltas).toEqual(['你', '好']);
    const prepare = deps.gatewayRuntime.facade.prepare as ReturnType<typeof vi.fn>;
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0][0]).toMatchObject({
      model: 'gpt-5.2',
      platform: 'openai',
      sessionKey: 'sess-1',
      systemPrompt: 'sys',
      defaultMaxOutputTokens: 4096,
    });
    expect(prepare.mock.calls[0][0].messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gw.local/v1/chat');
    expect((init as RequestInit).headers).toMatchObject({ 'X-Gw': '1' });
    expect((deps.addLog as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('INFO');
    expect((deps.addLog as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('GatewayV2');
  });

  it('falls back to v1 provider routing when no gateway account', async () => {
    const deps = makeDeps({
      hasGatewayAccountsFor: () => false,
      loadSavedProviders: () => [{
        id: 'openai',
        enabled: true,
        apiKey: 'k',
        baseUrl: 'http://v1.local',
        models: [{ id: 'gpt-5.2', name: 'GPT-5.2' }],
      }],
      buildModelCatalogEntry: (() => ({ catalog: 1 })) as never,
      resolveModelRoute: (() => ({ endpointUrl: 'http://v1.local/v1', adapter: 'openai-compatible-chat' })) as never,
      buildGatewayRequestBody: ((_route: unknown, msgs: unknown) => ({ model: 'gpt-5.2', messages: msgs })) as never,
      resolveApiEndpoint: (u: string) => ({ url: u.replace('http://v1.local', 'http://proxy.local'), headers: { 'X-P': '1' } }),
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(sseChunks)));
    vi.stubGlobal('fetch', fetchMock);

    const streamChat = createGatewayStreamChat(deps);
    const full = await streamChat({ system: 'sys', user: 'user', modelId: 'gpt-5.2', onDelta: () => {} });

    expect(full).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://proxy.local/v1');
    expect((init as RequestInit).body).toContain('gpt-5.2');
    expect((deps.addLog as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('SwarmGateway');
  });

  it('routes through active channel (Priority 1) when provider lacks API key', async () => {
    // 复刻用户环境: 模型绑定 channel (chan-opencode-go, key 在渠道里), provider 目录无 key
    const deps = {
      ...makeDeps(),
      streamingModel: { id: 'deepseek-v4-flash', name: 'deepseek-v4-flash', providerId: 'chan-opencode-go' },
      hasGatewayAccountsFor: () => false,
      loadSavedChannels: () => [{
        id: 'chan-opencode-go',
        name: 'OpenCode (Go 套餐直连)',
        type: 60,
        key: 'real-key-line1\nreal-key-line2',
        baseUrl: 'https://opencode.ai/zen/go/v1',
        defaultBaseUrl: '',
        models: ['deepseek-v4-flash'],
        status: 'active',
        responseTime: 0,
        priority: 10,
        weight: 10,
        group: 'default',
      }],
      // v1 provider 目录存在 provider-opencode-zen 但无 apiKey（复刻用户配置）
      loadSavedProviders: () => [{
        id: 'provider-opencode-zen',
        name: 'OpenCode Zen',
        enabled: true,
        baseUrl: 'https://opencode.ai',
        apiKey: '',
        models: [{ id: 'deepseek-v4-flash', name: 'deepseek-v4-flash', enabled: true, contextLimit: 131072, capabilities: [] }],
      }],
      resolveModelRoute: (() => { throw new Error('不应走到 v1 provider 兜底'); }) as never,
    } as GatewayStreamChatDeps;
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(sseChunks)));
    vi.stubGlobal('fetch', fetchMock);

    const streamChat = createGatewayStreamChat(deps);
    const full = await streamChat({ system: 'sys', user: 'user', modelId: 'deepseek-v4-flash', onDelta: () => {} });

    expect(full).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer real-key-line1' });
    expect((deps.addLog as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('ChannelRouter');
  });

  it('throws when no provider available in v1 fallback', async () => {
    const deps = makeDeps({ hasGatewayAccountsFor: () => false, loadSavedProviders: () => [] });
    const streamChat = createGatewayStreamChat(deps);
    await expect(streamChat({ system: 's', user: 'u', modelId: 'gpt-5.2', onDelta: () => {} }))
      .rejects.toThrow('没有可用的模型服务商渠道');
  });

  it('throws on HTTP error', async () => {
    const deps = makeDeps();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal' }));
    const streamChat = createGatewayStreamChat(deps);
    await expect(streamChat({ system: 's', user: 'u', modelId: 'gpt-5.2', onDelta: () => {} }))
      .rejects.toThrow('HTTP 500');
  });

  it('throws on SSE parse failure', async () => {
    const deps = makeDeps();
    const bad = 'data: {bad-json}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(sseBody([bad]))));
    const streamChat = createGatewayStreamChat(deps);
    await expect(streamChat({ system: 's', user: 'u', modelId: 'gpt-5.2', onDelta: () => {} }))
      .rejects.toThrow('流事件解析失败');
  });
});
