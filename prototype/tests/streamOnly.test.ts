import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildGatewayRequestBody,
  consumeSseResponse,
  ModelGateway,
  ModelRegistry,
  buildModelCatalogEntry,
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
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    enabled: true,
    endpointPath: '/v1beta/models/gemini-2.5-pro:streamGenerateContent',
    adapter: 'google-generative-language',
    protocol: 'google_native',
    capabilities: ['streaming', 'reasoning']
  }
];

function routeFor(modelId: string) {
  const provider = { ...opencodeProvider };
  const entry = buildModelCatalogEntry(provider, zenModels.find(m => m.id === modelId)!);
  return { provider, entry };
}

function sseResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
}

describe('Stream-Only contract - every generation request must stream', () => {
  it('buildGatewayRequestBody emits stream:true for all four adapters', () => {
    for (const model of zenModels) {
      const { provider, entry } = routeFor(model.id);
      const body = buildGatewayRequestBody(
        { providerId: provider.id, modelId: model.id, endpointUrl: `${provider.baseUrl}${entry.endpointPath}`, adapter: model.adapter as any, protocol: model.protocol as any, apiKey: provider.apiKey },
        [{ role: 'user', content: 'hi' }]
      ) as Record<string, any>;
      expect(body.stream).toBe(true);
    }
  });

  it('consumeSseResponse aggregates content and reasoning chunks and finishes on [DONE]', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}',
      '',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}',
      '',
      'data: [DONE]',
      ''
    ].join('\n');
    const result = await consumeSseResponse(sseResponse(sse), 'openai-compatible-chat');
    expect(result.content).toBe('Hello world');
    expect(result.reasoning).toBe('thinking...');
    expect(result.finished).toBe(true);
  });

  it('consumeSseResponse rejects an HTTP-200 empty body (provider_empty_response)', async () => {
    await expect(consumeSseResponse(sseResponse(''), 'openai-compatible-chat')).rejects.toThrow(/empty|provider_empty/i);
  });

  it('consumeSseResponse rejects EOF without a termination event (stream_interrupted)', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"partial"}}]}\n';
    await expect(consumeSseResponse(sseResponse(sse), 'openai-compatible-chat')).rejects.toThrow(/stream_interrupted|interrupted/i);
  });

  it('consumeSseResponse rejects an unparseable data: event (tool_protocol_error)', async () => {
    const sse = 'data: not-json\n\ndata: [DONE]\n';
    await expect(consumeSseResponse(sseResponse(sse), 'openai-compatible-chat')).rejects.toThrow(/JSON|protocol/i);
  });

  it('ModelGateway.request sends a stream:true body and consumes SSE to text', async () => {
    let capturedBody = '';
    const registry = new ModelRegistry([opencodeProvider]);
    registry.updateCatalog('provider-opencode', zenModels);
    const gateway = new ModelGateway(registry, async (_url, init) => {
      capturedBody = String(init?.body ?? '');
      const sse = [
        'data: {"choices":[{"delta":{"content":"streamed answer"}}]}',
        '',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        ''
      ].join('\n');
      return sseResponse(sse);
    });
    const text = await gateway.request({
      model: { providerId: 'provider-opencode', modelId: 'deepseek-chat', uniqueKey: 'provider-opencode:deepseek-chat' },
      messages: [{ role: 'user', content: 'ask' }]
    });
    expect(JSON.parse(capturedBody).stream).toBe(true);
    expect(text).toBe('streamed answer');
  });
});

describe('Stream-Only contract - static guard over prototype/src', () => {
  function collectFiles(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
        collectFiles(full, out);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        out.push(full);
      }
    }
    return out;
  }

  it('prototype/src contains no stream:false / stream = false literal', () => {
    const files = collectFiles(join(process.cwd(), 'src'), []);
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (/stream\s*[:=]\s*false/.test(content)) offenders.push(file.replace(process.cwd(), ''));
    }
    expect(offenders).toEqual([]);
  });

  it('no buildGatewayRequestBody call passes a boolean stream argument', () => {
    const files = collectFiles(join(process.cwd(), 'src'), []);
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const marker = 'buildGatewayRequestBody(';
        const startCol = line.indexOf(marker);
        if (startCol < 0) continue;
        // Accumulate the call block until the matching close paren at depth 0.
        let depth = 0;
        let block = '';
        let j = i;
        let started = false;
        for (; j < lines.length; j++) {
          for (let k = (j === i ? startCol + marker.length : 0); k < lines[j].length; k++) {
            const ch = lines[j][k];
            if (ch === '(') { depth++; started = true; }
            else if (ch === ')') { depth--; }
            if (started && depth <= 0) break;
          }
          block += lines[j].slice(j === i ? startCol + marker.length : 0) + '\n';
          if (started && depth <= 0) break;
        }
        const inner = block.slice(0, block.lastIndexOf(')'));
        let argDepth = 0;
        let current = '';
        const argsList: string[] = [];
        for (const ch of inner) {
          if (ch === '(') argDepth++;
          else if (ch === ')') argDepth--;
          if (ch === ',' && argDepth === 0) {
            argsList.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        argsList.push(current.trim());
        if (argsList.some(a => a === 'true' || a === 'false')) {
          offenders.push(`${file.replace(process.cwd(), '')}:${i + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
