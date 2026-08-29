import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const TABLE_SESSION_COOKIE = 'mise_table_session';

export type ValidTableSession = {
  id: string;
  tenant_id: string;
  location_id: string;
  table_id: string;
  qr_version: number;
  status: 'aktiv' | 'wartet_auf_bestaetigung';
  expires_at: string;
  order_count: number;
};

export function tableSessionSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTableSessionSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function privateFingerprint(secret: string, value: string | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(secret).update('\0').update(value).digest('hex');
}

export function tableSessionCookieValue(id: string, secret: string): string {
  return `${id}.${secret}`;
}

function parseCookie(value: string | undefined): { id: string; secret: string } | null {
  if (!value) return null;
  const split = value.indexOf('.');
  if (split < 1) return null;
  const id = value.slice(0, split);
  const secret = value.slice(split + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{32,128}$/.test(secret)) return null;
  return { id, secret };
}

export async function getValidTableSession(
  request: NextRequest,
  expectedTableId?: string,
): Promise<ValidTableSession | null> {
  const parsed = parseCookie(request.cookies.get(TABLE_SESSION_COOKIE)?.value);
  if (!parsed) return null;

  const service = createServiceClient();
  let query = service
    .from('table_sessions')
    .select('id,tenant_id,location_id,table_id,qr_version,status,expires_at,order_count')
    .eq('id', parsed.id)
    .eq('token_hash', hashTableSessionSecret(parsed.secret))
    .in('status', ['aktiv', 'wartet_auf_bestaetigung'])
    .gt('expires_at', new Date().toISOString());
  if (expectedTableId) query = query.eq('table_id', expectedTableId);
  const { data } = await query.maybeSingle();
  return data as ValidTableSession | null;
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

