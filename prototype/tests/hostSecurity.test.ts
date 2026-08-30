import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hostFetch,
  getHostToken,
  shouldAttachToken,
  installHostTokenInterceptor
} from '../src/services/hostClient';
import { saveProvidersToStorage, saveProjectsToStorage, resolveApiEndpoint } from '../src/types/contracts';
import { saveGatewayState } from '../src/services/gateway/store';
import { saveGlobalSettingsToStorage, DEFAULT_GLOBAL_SETTINGS } from '../src/services/settingsStore';

function installWindowStub() {
  (globalThis as any).window = {
    location: { protocol: 'http:', hostname: '127.0.0.1', port: '8010' },
    dispatchEvent: () => true,
    CustomEvent: class {},
    __TCODE_HOST_TOKEN__: 'frontend-test-token'
  };
  (globalThis as any).CustomEvent = (globalThis as any).window.CustomEvent;
}

const fetchMock = vi.fn();

beforeEach(() => {
  installWindowStub();
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
  (globalThis as any).window.fetch = fetchMock;
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  } as any);
});

describe('hostClient token scope', () => {
  it('attaches token only to same-origin /api requests', () => {
    expect(getHostToken()).toBe('frontend-test-token');
    expect(shouldAttachToken('/api/fs/tree')).toBe(true);
    expect(shouldAttachToken('http://127.0.0.1:8010/api/proxy')).toBe(true);
    expect(shouldAttachToken('http://localhost:8010/api/storage')).toBe(true);
    expect(shouldAttachToken('https://api.deepseek.com/v1/chat/completions')).toBe(false);
    expect(shouldAttachToken('https://api.openai.com/v1/models')).toBe(false);
  });

  it('global interceptor injects token into same-origin fetch', async () => {
    installHostTokenInterceptor();
    await (globalThis as any).window.fetch('/api/fs/tree');
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as any).headers as Headers;
    expect(headers.get('X-Tcode-Token')).toBe('frontend-test-token');
  });

  it('global interceptor does not touch cross-origin fetch', async () => {
    installHostTokenInterceptor();
    await (globalThis as any).window.fetch('https://api.openai.com/v1/models');
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init as any)?.headers);
    expect(headers.get('X-Tcode-Token')).toBeNull();
  });

  it('explicit hostFetch attaches token', async () => {
    await hostFetch('/api/fs/tree');
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).headers.get('X-Tcode-Token')).toBe('frontend-test-token');
  });
});

describe('sensitive storage marking', () => {
  it('marks providers write as sensitive', async () => {
    saveProvidersToStorage([{ id: 'provider-opencode', apiKey: '' } as any]);
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBe(true);
    expect(body.key).toBe('codemind_providers');
  });

  it('marks gateway state write as sensitive', async () => {
    saveGatewayState({ accounts: [], keys: [], usage: [], scheduler: {} as any });
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBe(true);
    expect(body.key).toBe('codemind_gateway_v2');
  });

  it('does not mark projects write as sensitive', async () => {
    saveProjectsToStorage([]);
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBeFalsy();
  });
});

describe('resolveApiEndpoint desktop proxy', () => {
  it('includes token header on desktop proxy route', () => {
    const resolved = resolveApiEndpoint('https://api.openai.com/v1/models');
    expect(resolved.url).toBe('/api/proxy');
    expect(resolved.headers['x-target-url']).toBe('https://api.openai.com/v1/models');
    expect(resolved.headers['X-Tcode-Token']).toBe('frontend-test-token');
  });
});

describe('air-gapped settings persistence', () => {
  it('persists global settings to host disk via /api/storage', async () => {
    saveGlobalSettingsToStorage({ ...DEFAULT_GLOBAL_SETTINGS, isAirGapped: true });
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.key).toBe('tcode_settings');
    expect(body.data.isAirGapped).toBe(true);
  });
});
