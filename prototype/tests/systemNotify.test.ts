import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isDesktopHost,
  isWindowHidden,
  requestSystemNotification,
  SystemNotifyPayload,
} from '../src/services/systemNotify';

afterEach(() => {
  vi.unstubAllGlobals();
});

const payload: SystemNotifyPayload = {
  status: 'success',
  projectName: 'agent-learning',
  sessionTitle: '构建任务',
  sessionId: 'sess-1',
  summary: '构建完成',
};

describe('isDesktopHost', () => {
  it('returns false when no __TCODE_HOST_TOKEN__', () => {
    vi.stubGlobal('window', {});
    expect(isDesktopHost()).toBe(false);
  });

  it('returns true when __TCODE_HOST_TOKEN__ present', () => {
    vi.stubGlobal('window', { __TCODE_HOST_TOKEN__: 'tok' });
    expect(isDesktopHost()).toBe(true);
  });

  it('returns false in pure node environment (no window)', () => {
    expect(isDesktopHost()).toBe(false);
  });
});

describe('isWindowHidden', () => {
  it('returns true when visibilityState is hidden', () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    expect(isWindowHidden()).toBe(true);
  });

  it('returns false when visibilityState is visible', () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    expect(isWindowHidden()).toBe(false);
  });
});

describe('requestSystemNotification', () => {
  it('returns false and skips fetch in non-host environment', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestSystemNotification(payload)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false and skips fetch when window is focused', async () => {
    vi.stubGlobal('window', { __TCODE_HOST_TOKEN__: 'tok' });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestSystemNotification(payload)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts JSON payload to /api/notify/system when host + hidden', async () => {
    vi.stubGlobal('window', { __TCODE_HOST_TOKEN__: 'tok' });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await requestSystemNotification(payload)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/notify/system');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload);
  });

  it('returns false and logs on non-ok response', async () => {
    vi.stubGlobal('window', { __TCODE_HOST_TOKEN__: 'tok' });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await requestSystemNotification(payload)).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns false and logs when fetch rejects', async () => {
    vi.stubGlobal('window', { __TCODE_HOST_TOKEN__: 'tok' });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await requestSystemNotification(payload)).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
