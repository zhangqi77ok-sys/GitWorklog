let patched = false;

export function getHostToken(): string {
  if (typeof window === 'undefined') return '';
  return ((window as any).__TCODE_HOST_TOKEN__ as string) || '';
}

export function shouldAttachToken(url: RequestInfo | URL): boolean {
  if (typeof url !== 'string' && !(url instanceof URL)) {
    // Request object: headers are fixed at construction; never rewrite.
    return false;
  }
  const raw = String(url);
  // Relative /api/* calls (served same-origin from the desktop host)
  if (raw.startsWith('/')) return raw.startsWith('/api/') || raw === '/health';
  // Absolute URL: only the desktop host origin itself
  try {
    const u = new URL(raw);
    const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
    return local && (u.pathname.startsWith('/api/') || u.pathname === '/health');
  } catch {
    return false;
  }
}

export function installHostTokenInterceptor(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const baseFetch = (window.fetch || (globalThis as any).fetch) as typeof fetch;
  const original = baseFetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (shouldAttachToken(input)) {
      const headers = new Headers(init?.headers);
      const token = getHostToken();
      if (token) headers.set('X-Tcode-Token', token);
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
}

export async function hostFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getHostToken();
  if (token && shouldAttachToken(input)) headers.set('X-Tcode-Token', token);
  return fetch(input, { ...init, headers });
}
