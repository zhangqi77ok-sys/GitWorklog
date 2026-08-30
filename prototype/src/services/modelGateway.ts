import type { AIModelOption, ModelProviderItem } from '../types/contracts';

export type ModelAdapter =
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-language'
  | 'openai-compatible-chat';

export type ModelProtocol =
  | 'responses'
  | 'anthropic_messages'
  | 'google_native'
  | 'chat_completions';

export interface ModelRef {
  providerId: string;
  modelId: string;
  uniqueKey: string;
}

export interface ProviderRecord {
  id: string;
  name: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  protocol?: 'openai' | 'anthropic' | 'ollama';
}

export interface RawCatalogModel {
  id: string;
  name?: string;
  enabled?: boolean;
  contextLimit?: number;
  outputLimit?: number;
  endpointPath?: string;
  adapter?: ModelAdapter;
  protocol?: ModelProtocol;
  capabilities?: string[];
  description?: string;
}

export interface ModelCatalogEntry {
  ref: ModelRef;
  displayName: string;
  enabled: boolean;
  adapter: ModelAdapter;
  protocol: ModelProtocol;
  endpointPath: string;
  contextLimit: number;
  outputLimit?: number;
  capabilities: {
    streaming: boolean;
    toolCalling: boolean;
    reasoning: boolean;
    vision: boolean;
    structuredOutput: boolean;
  };
  source: 'official_catalog' | 'custom' | 'builtin';
  description?: string;
}

export interface ResolvedModelRoute {
  providerId: string;
  modelId: string;
  endpointUrl: string;
  adapter: ModelAdapter;
  protocol: ModelProtocol;
  apiKey: string;
}

export interface ModelRegistrySnapshot {
  providers: ProviderRecord[];
  catalogs: Record<string, ModelCatalogEntry[]>;
}

function providerKind(provider: ProviderRecord): AIModelOption['provider'] {
  if (provider.name.includes('Anthropic')) return 'Anthropic';
  if (provider.name.includes('OpenAI')) return 'OpenAI';
  if (provider.name.includes('Ollama') || provider.protocol === 'ollama') return 'Local';
  return 'DeepSeek';
}

const MODEL_TAB_PROVIDER_IDS: Record<string, string> = {
  opencode: 'provider-opencode',
  deepseek: 'provider-deepseek',
  anthropic: 'provider-anthropic',
  openai: 'provider-openai',
  local: 'provider-ollama'
};

export function resolveProviderIdForModelTab(
  activeProviderTab: string,
  providers: Array<Pick<ProviderRecord, 'id' | 'enabled'>>
): string | undefined {
  const expectedId = MODEL_TAB_PROVIDER_IDS[activeProviderTab];
  if (expectedId && providers.some(provider => provider.id === expectedId)) return expectedId;
  if (activeProviderTab === 'local') {
    return providers.find(provider => provider.id === 'provider-lmstudio')?.id;
  }
  return undefined;
}

function isLocalProvider(provider: ProviderRecord): boolean {
  return provider.protocol === 'ollama' || /^(https?:\/\/)?(?:localhost|127\.0\.1|0\.0\.0\.0)(?::|\/)/i.test(provider.baseUrl.trim());
}

export function assertProviderCredentials(provider: ProviderRecord): void {
  if (!provider.baseUrl.trim()) {
    throw new Error(`Provider ${provider.id} Base URL is required`);
  }
  if (!isLocalProvider(provider) && !provider.apiKey.trim()) {
    throw new Error(`Provider ${provider.id} API Key is required`);
  }
}

function inferAdapter(provider: ProviderRecord, model: RawCatalogModel): ModelAdapter {
  if (model.adapter) return model.adapter;
  if (model.protocol === 'responses') return 'openai-responses';
  if (model.protocol === 'anthropic_messages') return 'anthropic-messages';
  if (model.protocol === 'google_native') return 'google-generative-language';
  if (provider.protocol === 'anthropic') return 'anthropic-messages';
  return 'openai-compatible-chat';
}

function inferProtocol(adapter: ModelAdapter): ModelProtocol {
  switch (adapter) {
    case 'openai-responses': return 'responses';
    case 'anthropic-messages': return 'anthropic_messages';
    case 'google-generative-language': return 'google_native';
    default: return 'chat_completions';
  }
}

function defaultEndpointPath(adapter: ModelAdapter): string {
  switch (adapter) {
    case 'openai-responses': return '/responses';
    case 'anthropic-messages': return '/messages';
    case 'google-generative-language': return '/models';
    default: return '/chat/completions';
  }
}

function hasCapability(capabilities: string[], names: string[]): boolean {
  return names.some(name => capabilities.includes(name));
}

export function buildModelCatalogEntry(
  provider: ProviderRecord,
  model: RawCatalogModel
): ModelCatalogEntry {
  const adapter = inferAdapter(provider, model);
  const capabilities = model.capabilities || [];
  return {
    ref: {
      providerId: provider.id,
      modelId: model.id,
      uniqueKey: `${provider.id}:${model.id}`
    },
    displayName: model.name || model.id,
    enabled: model.enabled !== false,
    adapter,
    protocol: model.protocol || inferProtocol(adapter),
    endpointPath: model.endpointPath || defaultEndpointPath(adapter),
    contextLimit: model.contextLimit || 128000,
    outputLimit: model.outputLimit,
    capabilities: {
      streaming: hasCapability(capabilities, ['streaming', 'stream']) || capabilities.length === 0,
      toolCalling: hasCapability(capabilities, ['toolCalling', 'tools', 'tool-calling']),
      reasoning: hasCapability(capabilities, ['reasoning', 'thinking']),
      vision: hasCapability(capabilities, ['vision', 'multimodal']),
      structuredOutput: hasCapability(capabilities, ['structuredOutput', 'structured-output'])
    },
    source: 'official_catalog',
    description: model.description
  };
}

function joinEndpoint(baseUrl: string, endpointPath: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const path = endpointPath.trim();
  if (/^https?:\/\//i.test(path)) return path;
  if (!path) return base;

  // The OpenCode base URL already ends in /v1; tolerate catalog entries that
  // include the version prefix without producing /v1/v1/....
  if (base.endsWith('/v1') && path.startsWith('/v1/')) {
    return `${base}${path.slice(3)}`;
  }
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function resolveModelRoute(
  provider: ProviderRecord,
  model: ModelCatalogEntry
): ResolvedModelRoute {
  if (!provider.enabled) throw new Error(`Provider disabled: ${provider.id}`);
  if (!model.enabled) throw new Error(`Model disabled: ${model.ref.uniqueKey}`);
  assertProviderCredentials(provider);
  return {
    providerId: provider.id,
    modelId: model.ref.modelId,
    endpointUrl: joinEndpoint(provider.baseUrl, model.endpointPath),
    adapter: model.adapter,
    protocol: model.protocol,
    apiKey: provider.apiKey
  };
}

export function getAvailableModelOptions(snapshot: ModelRegistrySnapshot): AIModelOption[] {
  const options: AIModelOption[] = [];
  for (const provider of snapshot.providers) {
    if (!provider.enabled) continue;
    for (const entry of snapshot.catalogs[provider.id] || []) {
      if (!entry.enabled) continue;
      options.push({
        id: entry.ref.modelId,
        name: entry.displayName,
        provider: providerKind(provider),
        providerId: provider.id,
        uniqueKey: entry.ref.uniqueKey,
        contextLimit: entry.contextLimit,
        inputPricePerM: 0,
        outputPricePerM: 0,
        badge: provider.id === 'provider-opencode' ? 'OpenCode Zen' : provider.name.split(' ')[0],
        description: entry.description || `${provider.name} · ${entry.adapter}`,
        adapter: entry.adapter,
        endpointPath: entry.endpointPath,
        protocol: entry.protocol,
        capabilities: entry.capabilities
      });
    }
  }
  return options;
}

export class ModelRegistry {
  private providers: ProviderRecord[];
  private catalogs: Record<string, ModelCatalogEntry[]>;
  private listeners = new Set<(snapshot: ModelRegistrySnapshot) => void>();

  public constructor(providers: ProviderRecord[] = []) {
    this.providers = [...providers];
    this.catalogs = {};
    for (const provider of providers) {
      const models = (provider as ProviderRecord & { models?: RawCatalogModel[] }).models || [];
      if (models.length > 0) {
        this.catalogs[provider.id] = models.map(model => buildModelCatalogEntry(provider, model));
      }
    }
  }

  public updateProviders(providers: ProviderRecord[]): void {
    this.providers = [...providers];
    this.emit();
  }

  public updateCatalog(providerId: string, models: RawCatalogModel[]): void {
    const provider = this.providers.find(item => item.id === providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);
    this.catalogs[providerId] = models.map(model => buildModelCatalogEntry(provider, model));
    this.emit();
  }

  public getSnapshot(): ModelRegistrySnapshot {
    return {
      providers: [...this.providers],
      catalogs: Object.fromEntries(Object.entries(this.catalogs).map(([id, entries]) => [id, [...entries]]))
    };
  }

  public getAvailableModelOptions(): AIModelOption[] {
    return getAvailableModelOptions(this.getSnapshot());
  }

  public resolve(ref: ModelRef): ResolvedModelRoute {
    const provider = this.providers.find(item => item.id === ref.providerId);
    const model = this.catalogs[ref.providerId]?.find(item => item.ref.uniqueKey === ref.uniqueKey);
    if (!provider) throw new Error(`Provider not found: ${ref.providerId}`);
    if (!model) throw new Error(`Model not found: ${ref.uniqueKey}`);
    return resolveModelRoute(provider, model);
  }

  public subscribe(listener: (snapshot: ModelRegistrySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export function createModelRef(providerId: string, modelId: string): ModelRef {
  return { providerId, modelId, uniqueKey: `${providerId}:${modelId}` };
}

export function providerItemsToRecords(providers: ModelProviderItem[]): ProviderRecord[] {
  return providers.map(provider => ({
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    protocol: provider.protocol
  }));
}

export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface GatewayRequestBody {
  model: string;
  stream: boolean;
  [key: string]: unknown;
}

export interface NormalizedToolCall {
  id: string;
  name?: string;
  arguments?: string;
}

export interface NormalizedGatewayChunk {
  content: string;
  reasoning: string;
  finished: boolean;
  toolCalls: NormalizedToolCall[];
}

export function buildGatewayRequestBody(
  route: ResolvedModelRoute,
  messages: GatewayMessage[],
  stream = true,
  temperature = 0.3
): GatewayRequestBody {
  const systemMessage = messages.find(message => message.role === 'system');
  const conversation = messages.filter(message => message.role !== 'system');

  switch (route.adapter) {
    case 'openai-responses':
      return {
        model: route.modelId,
        input: messages,
        stream,
        temperature
      };
    case 'anthropic-messages':
      return {
        model: route.modelId,
        system: systemMessage?.content,
        messages: conversation,
        max_tokens: 8192,
        stream,
        temperature
      };
    case 'google-generative-language':
      return {
        model: route.modelId,
        contents: conversation.map(message => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
        generationConfig: { temperature },
        stream
      };
    default:
      return {
        model: route.modelId,
        messages,
        stream,
        temperature
      };
  }
}

export function parseGatewayEvent(
  adapter: ModelAdapter,
  parsed: Record<string, any>
): NormalizedGatewayChunk {
  if (adapter === 'openai-responses') {
    const type = parsed.type || '';
    const item = parsed.item || parsed.output_item || {};
    const toolCall = item.type === 'function_call' || parsed.type === 'response.function_call_arguments.delta'
      ? {
          id: item.call_id || item.id || parsed.call_id || parsed.id || `response-tool-${Date.now()}`,
          name: item.name || parsed.name,
          arguments: item.arguments || parsed.delta || parsed.arguments || ''
        }
      : undefined;
    return {
      content: parsed.delta || parsed.output_text || '',
      reasoning: parsed.reasoning || '',
      finished: type === 'response.completed' || type === 'response.done',
      toolCalls: toolCall ? [toolCall] : []
    };
  }
  if (adapter === 'anthropic-messages') {
    const block = parsed.content_block || {};
    const toolCall = block.type === 'tool_use' || parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta'
      ? {
          id: block.id || parsed.id || `anthropic-tool-${Date.now()}`,
          name: block.name,
          arguments: block.input ? JSON.stringify(block.input) : parsed.delta?.partial_json || ''
        }
      : undefined;
    return {
      content: parsed.delta?.text || (parsed.type === 'message_start' ? '' : ''),
      reasoning: parsed.delta?.thinking || '',
      finished: parsed.type === 'message_stop',
      toolCalls: toolCall ? [toolCall] : []
    };
  }
  if (adapter === 'google-generative-language') {
    const parts = parsed.candidates?.[0]?.content?.parts || [];
    const functionCall = parts.find((part: any) => part.functionCall)?.functionCall;
    return {
      content: parts.map((part: any) => part.text || '').join(''),
      reasoning: '',
      finished: Boolean(parsed.candidates?.[0]?.finishReason),
      toolCalls: functionCall ? [{
        id: functionCall.id || `google-tool-${Date.now()}`,
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.args || {})
      }] : []
    };
  }
  const choice = parsed.choices?.[0];
  const nativeToolCalls = choice?.delta?.tool_calls || choice?.message?.tool_calls || [];
  return {
    content: choice?.delta?.content || choice?.message?.content || '',
    reasoning: choice?.delta?.reasoning_content || '',
    finished: Boolean(choice?.finish_reason),
    toolCalls: nativeToolCalls.map((tool: any, index: number) => ({
      id: tool.id || `chat-tool-${tool.index ?? index}`,
      name: tool.function?.name || tool.name,
      arguments: tool.function?.arguments || (tool.arguments ? JSON.stringify(tool.arguments) : '')
    }))
  };
}

export function extractGatewayResponseText(adapter: ModelAdapter, data: Record<string, any>): string {
  if (adapter === 'openai-responses') {
    return data.output_text || data.output?.flatMap((item: any) => item.content || [])
      ?.map((item: any) => item.text || '').join('') || '';
  }
  if (adapter === 'anthropic-messages') {
    return data.content?.map((item: any) => item.text || '').join('') || '';
  }
  if (adapter === 'google-generative-language') {
    return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
  }
  return data.choices?.[0]?.message?.content || '';
}

export interface ModelGatewayRequest {
  model: ModelRef;
  messages: GatewayMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

export class ModelGateway {
  public constructor(
    private readonly registry: ModelRegistry,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  public resolve(model: ModelRef): ResolvedModelRoute {
    return this.registry.resolve(model);
  }

  public async request(request: ModelGatewayRequest): Promise<string> {
    const route = this.resolve(request.model);
    const response = await this.fetchImpl(route.endpointUrl, {
      method: 'POST',
      signal: request.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {})
      },
      body: JSON.stringify(buildGatewayRequestBody(route, request.messages, false, request.temperature ?? 0.3))
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return extractGatewayResponseText(route.adapter, await response.json());
  }
}
