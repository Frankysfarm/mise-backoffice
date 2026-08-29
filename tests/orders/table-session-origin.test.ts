import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from '@/lib/orders/table-session';

function request(origin: string | null, headers: Record<string, string>, internalUrl = 'http://localhost:3300/api/order/table/session') {
  const values = new Headers(headers);
  if (origin) values.set('origin', origin);
  return { headers: values, nextUrl: new URL(internalUrl) } as never;
}

describe('table session same-origin validation', () => {
  it('accepts the public origin forwarded by the production reverse proxy', () => {
    expect(isSameOriginRequest(request('https://mise-gastro.de', {
      host: '127.0.0.1:3300',
      'x-forwarded-host': 'mise-gastro.de',
      'x-forwarded-proto': 'https',
    }))).toBe(true);
  });

  it('rejects foreign and malformed origins', () => {
    const headers = { 'x-forwarded-host': 'mise-gastro.de', 'x-forwarded-proto': 'https' };
    expect(isSameOriginRequest(request('https://evil.example', headers))).toBe(false);
    expect(isSameOriginRequest(request('not-a-url', headers))).toBe(false);
  });

  it('supports direct same-origin requests and clients without an Origin header', () => {
    expect(isSameOriginRequest(request('http://localhost:3300', { host: 'localhost:3300' }))).toBe(true);
    expect(isSameOriginRequest(request(null, {}))).toBe(true);
  });
});
