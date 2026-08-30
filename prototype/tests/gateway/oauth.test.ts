import { describe, it, expect, vi } from 'vitest';
import { OAuthClient, buildAuthorizeUrl, OAUTH_ENDPOINTS } from '../../src/services/gateway/oauth';

describe('Gateway v2 - OAuth lifecycle (Codex / Claude / Grok)', () => {
  it('builds platform authorize URLs', () => {
    expect(buildAuthorizeUrl('codex', { clientId: 'c1', redirectUri: 'http://localhost/cb' })).toContain('auth.openai.com');
    expect(buildAuthorizeUrl('claude', { clientId: 'c2', redirectUri: 'http://localhost/cb' })).toContain('claude.ai/oauth/authorize');
    expect(buildAuthorizeUrl('grok', { clientId: 'c3', redirectUri: 'http://localhost/cb' })).toContain('accounts.x.ai');
  });

  it('exchanges an authorization code for Codex tokens', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'at-codex', refresh_token: 'rt-codex', expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new OAuthClient(fetchMock as unknown as typeof fetch);
    const tokens = await client.exchangeCode('codex', 'the-code', { clientId: 'c1', redirectUri: 'http://localhost/cb' });
    expect(tokens.access_token).toBe('at-codex');
    expect(tokens.refresh_token).toBe('rt-codex');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OAUTH_ENDPOINTS.codex!.tokenUrl);
    const body = JSON.parse(String(init.body));
    expect(body.grant_type).toBe('authorization_code');
    expect(body.code).toBe('the-code');
  });

  it('exchanges a Claude authorization code and returns setup token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'at-claude', refresh_token: 'rt-claude', setup_token: 'st-claude', expires_in: 7200
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new OAuthClient(fetchMock as unknown as typeof fetch);
    const tokens = await client.exchangeCode('claude', 'claude-code', { clientId: 'c2', redirectUri: 'http://localhost/cb' });
    expect(tokens.setup_token).toBe('st-claude');
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(OAUTH_ENDPOINTS.claude!.tokenUrl);
  });

  it('refreshes tokens for Grok', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'at-grok-2', refresh_token: 'rt-grok-2', expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new OAuthClient(fetchMock as unknown as typeof fetch);
    const tokens = await client.refreshToken('grok', 'rt-grok-1', { clientId: 'c3' });
    expect(tokens.access_token).toBe('at-grok-2');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.grant_type).toBe('refresh_token');
    expect(body.refresh_token).toBe('rt-grok-1');
  });

  it('throws a structured error on upstream rejection', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const client = new OAuthClient(fetchMock as unknown as typeof fetch);
    await expect(client.exchangeCode('codex', 'bad', { clientId: 'c1', redirectUri: 'http://localhost/cb' })).rejects.toThrow(/invalid_grant/i);
  });

  it('keeps non-oauth platforms out of the oauth registry', () => {
    expect(OAUTH_ENDPOINTS).not.toHaveProperty('local');
  });
});
