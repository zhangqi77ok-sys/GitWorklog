import { describe, expect, it } from 'vitest';
import {
  ModelRegistry,
  buildModelCatalogEntry,
  getAvailableModelOptions,
  resolveModelRoute,
  resolveProviderIdForModelTab,
  parseGatewayEvent,
  accumulateStreamedToolCalls,
  finalizeAccumulatedToolCalls,
  type ProviderRecord,
  type RawCatalogModel
} from '../src/services/modelGateway';

const opencodeProvider: ProviderRecord = {
  id: 'provider-opencode',
  name: 'OpenCode Zen',
  enabled: true,
  baseUrl: 'https://opencode.ai/zen/v1',
  apiKey: 'test-key'
};

const zenModels: RawCatalogModel[] = [
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    enabled: true,
    endpointPath: '/responses',
    adapter: 'openai-responses',
    protocol: 'responses',
    capabilities: ['streaming', 'toolCalling', 'reasoning']
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    enabled: true,
    endpointPath: '/messages',
    adapter: 'anthropic-messages',
    protocol: 'anthropic_messages',
    capabilities: ['streaming', 'toolCalling', 'reasoning']
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    enabled: true,
    endpointPath: '/chat/completions',
    adapter: 'openai-compatible-chat',
    protocol: 'chat_completions',
    capabilities: ['streaming', 'toolCalling']
  }
];

describe('OpenCode Zen model-level routing contract', () => {
  it('routes models in one Provider to their own adapter and endpoint', () => {
    const entries = zenModels.map(model => buildModelCatalogEntry(opencodeProvider, model));

    const responsesRoute = resolveModelRoute(opencodeProvider, entries[0]);
    const anthropicRoute = resolveModelRoute(opencodeProvider, entries[1]);
    const chatRoute = resolveModelRoute(opencodeProvider, entries[2]);

    expect(responsesRoute).toMatchObject({
      endpointUrl: 'https://opencode.ai/zen/v1/responses',
      adapter: 'openai-responses',
      protocol: 'responses'
    });
    expect(anthropicRoute).toMatchObject({
      endpointUrl: 'https://opencode.ai/zen/v1/messages',
      adapter: 'anthropic-messages',
      protocol: 'anthropic_messages'
    });
    expect(chatRoute).toMatchObject({
      endpointUrl: 'https://opencode.ai/zen/v1/chat/completions',
      adapter: 'openai-compatible-chat',
      protocol: 'chat_completions'
    });
  });

  it('keeps provider and model identity stable when model IDs collide', () => {
    const otherProvider: ProviderRecord = {
      ...opencodeProvider,
      id: 'provider-custom',
      name: 'Custom Gateway'
    };
    const first = buildModelCatalogEntry(opencodeProvider, { ...zenModels[0], id: 'shared-model' });
    const second = buildModelCatalogEntry(otherProvider, { ...zenModels[0], id: 'shared-model' });

    expect(first.ref.uniqueKey).toBe('provider-opencode:shared-model');
    expect(second.ref.uniqueKey).toBe('provider-custom:shared-model');
    expect(first.ref.uniqueKey).not.toBe(second.ref.uniqueKey);
  });

  it('derives ChatColumn options from the same registry after provider synchronization', () => {
    const registry = new ModelRegistry([opencodeProvider]);
    expect(registry.getAvailableModelOptions()).toHaveLength(0);

    registry.updateCatalog('provider-opencode', zenModels);
    const options = registry.getAvailableModelOptions();

    expect(options.map(model => model.uniqueKey)).toEqual([
      'provider-opencode:gpt-5.1-codex',
      'provider-opencode:claude-sonnet-4',
      'provider-opencode:deepseek-chat'
    ]);
    expect(getAvailableModelOptions(registry.getSnapshot())).toEqual(options);
  });

  it('rejects disabled providers and models from the selectable list', () => {
    const registry = new ModelRegistry([{ ...opencodeProvider, enabled: false }]);
    registry.updateCatalog('provider-opencode', zenModels);
    expect(registry.getAvailableModelOptions()).toEqual([]);

    registry.updateProviders([{ ...opencodeProvider, enabled: true }]);
    registry.updateCatalog('provider-opencode', [zenModels[0], { ...zenModels[1], enabled: false }]);
    expect(registry.getAvailableModelOptions().map(model => model.id)).toEqual(['gpt-5.1-codex']);
  });
});


describe('ModelGateway safety and protocol normalization', () => {
  it('fails closed before network access when a cloud provider has no API key', () => {
    const entry = buildModelCatalogEntry(opencodeProvider, zenModels[0]);
    expect(() => resolveModelRoute({ ...opencodeProvider, apiKey: '' }, entry)).toThrow(/API Key/i);
  });

  it('fails closed when the provider base URL is missing', () => {
    const entry = buildModelCatalogEntry(opencodeProvider, zenModels[0]);
    expect(() => resolveModelRoute({ ...opencodeProvider, baseUrl: '' }, entry)).toThrow(/Base URL/i);
  });

  it('allows a local provider without an API key', () => {
    const localProvider: ProviderRecord = {
      id: 'provider-ollama',
      name: 'Ollama Local',
      enabled: true,
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: '',
      protocol: 'ollama'
    };
    const entry = buildModelCatalogEntry(localProvider, {
      id: 'qwen2.5-coder',
      adapter: 'openai-compatible-chat',
      protocol: 'chat_completions'
    });
    expect(resolveModelRoute(localProvider, entry).endpointUrl).toBe('http://127.0.0.1:11434/v1/chat/completions');
  });

  it('maps the active model tab to the intended provider instead of the first configured provider', () => {
    const providers = [
      { id: 'provider-deepseek', enabled: true },
      { id: 'provider-opencode', enabled: true }
    ];
    expect(resolveProviderIdForModelTab('opencode', providers)).toBe('provider-opencode');
    expect(resolveProviderIdForModelTab('deepseek', providers)).toBe('provider-deepseek');
  });

  it('normalizes native tool calls from OpenAI-compatible events', () => {
    const normalized = parseGatewayEvent('openai-compatible-chat', {
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'run_command', arguments: '{"command":"npm test"}' } }] } }]
    });
    expect(normalized.toolCalls).toEqual([
      { id: 'call-1', name: 'run_command', arguments: '{"command":"npm test"}', index: 0 }
    ]);
  });

  it('correctly accumulates fragmented tool call arguments across multiple streaming chunks', () => {
    const acc = new Map();
    accumulateStreamedToolCalls(acc, [{ index: 0, id: 'call-99', name: 'run_command', arguments: '{"com' }]);
    accumulateStreamedToolCalls(acc, [{ index: 0, arguments: 'mand":"Get-' }]);
    accumulateStreamedToolCalls(acc, [{ index: 0, arguments: 'ChildItem"}' }]);
    
    const finalized = finalizeAccumulatedToolCalls(acc);
    expect(finalized).toEqual([
      { id: 'call-99', name: 'run_command', arguments: '{"command":"Get-ChildItem"}' }
    ]);
  });
});
