import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('driver client robustness', () => {
  it('sends GPS fixes with a cached access token instead of per-fix getSession', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('accessTokenRef');
    expect(client).toContain('onAuthStateChange');
    const pushFnBlock = client.slice(
      client.indexOf('const pushFn = async'),
      client.indexOf('startBgLocation(pushFn'),
    );
    expect(pushFnBlock).not.toContain('supabase.auth.getSession()');
    expect(pushFnBlock).toContain('accessTokenRef.current');
  });

  it('surfaces confirm_pickup_complete failures to the driver', () => {
    const client = source('app/fahrer/app/client.tsx');
    const block = client.slice(
      client.indexOf('async function completeAndRoute'),
      client.indexOf('async function markDelivered'),
    );
    expect(block).toContain('r.ok === false');
    expect(block).toContain('alert(');
  });

  it('translates the PICK_REQUIRED trigger error into driver language', () => {
    const client = source('app/fahrer/app/client.tsx');
    const block = client.slice(
      client.indexOf('async function completeAndRoute'),
      client.indexOf('async function markDelivered'),
    );
    expect(block).toContain('PICK_REQUIRED');
    expect(block).toContain('Artikel');
  });
});
