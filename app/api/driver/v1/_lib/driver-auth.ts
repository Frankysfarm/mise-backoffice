/**
 * Helper für die /api/driver/v1/* Routes — Bearer-Token-Auth + OTP-Hashing.
 *
 * Phase 1 (2026-05-05): Dual-Token-Support.
 *  - Erst probieren als Supabase-Auth-JWT (App ruft direkt supabase.auth.signIn,
 *    schickt access_token als Bearer → Driver wird via mise_drivers.auth_user_id geladen).
 *  - Fallback: alter mise_driver_sessions-Token (Phone+OTP-Flow, bleibt für Bestand kompatibel).
 *
 * Liegt unter app/api/driver/v1/_lib/driver-auth.ts auf dem Server.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY missing');
  }
  _sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: 'no-store' }) },
  });
  return _sb;
}

const TOKEN_BYTES = 32;
const OTP_LENGTH = 6;
const OTP_TTL_MIN = 10;
const SESSION_DAYS = 90;
const MAX_OTP_ATTEMPTS = 5;

function otpSecret(): string {
  const s = process.env.DRIVER_OTP_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV !== 'production') {
      return 'dev-otp-secret-please-set-DRIVER_OTP_SECRET-in-prod';
    }
    throw new Error('DRIVER_OTP_SECRET muss gesetzt sein in production');
  }
  return s;
}

export function hashOtp(code: string): string {
  return createHmac('sha256', otpSecret()).update(code).digest('hex');
}

export function generateOtp(): string {
  let n = 0;
  while (n < 100000) n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(OTP_LENGTH, '0');
}

export interface DriverPublic {
  id: string;
  employee_id: string | null;
  phone: string | null;
  email: string | null;
  name: string;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  frank_mode: 'auto' | 'confirm' | 'manual';
  state: string;
  active: boolean;
  total_deliveries: number;
  total_earnings: number;
}

const DRIVER_SELECT =
  'id,employee_id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings';

export async function createDriverSession(driverId: string, ua: string | null) {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const { error } = await sb().from('mise_driver_sessions').insert({
    token,
    driver_id: driverId,
    expires_at: expiresAt.toISOString(),
    user_agent: ua,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

/**
 * Liest Bearer-Token + identifiziert den Driver.
 *
 * Erst Supabase-Auth-JWT (Phase 1) probiert, dann mise_driver_sessions (Legacy).
 * Returns null wenn keiner der beiden Pfade matcht.
 */
export async function getDriverFromBearer(
  req: NextRequest,
): Promise<{ driver: DriverPublic; token: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer (.+)$/i.exec(auth);
  if (!m) return null;
  const token = m[1].trim();

  // Heuristik: Supabase-JWTs haben 3 Punkt-Segmente und beginnen mit "ey".
  const looksLikeJwt = token.startsWith('ey') && token.split('.').length === 3;
  if (looksLikeJwt) {
    const viaJwt = await driverFromSupabaseJwt(token);
    if (viaJwt) return { driver: viaJwt, token };
    // Falls JWT-Form aber unbekannter User: kein Fallback nötig, ist nicht authentisiert
    return null;
  }

  // Legacy: mise_driver_sessions
  return await driverFromLegacySession(token);
}

async function driverFromSupabaseJwt(token: string): Promise<DriverPublic | null> {
  const c = sb();
  const { data: userData, error } = await c.auth.getUser(token);
  if (error || !userData.user) return null;
  const authUserId = userData.user.id;

  const { data: driver } = await c
    .from('mise_drivers')
    .select(DRIVER_SELECT)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!driver) return null;
  return driver as DriverPublic;
}

async function driverFromLegacySession(
  token: string,
): Promise<{ driver: DriverPublic; token: string } | null> {
  const c = sb();
  const { data: session } = await c
    .from('mise_driver_sessions')
    .select('token,driver_id,expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await c.from('mise_driver_sessions').delete().eq('token', token);
    return null;
  }

  const { data: driver } = await c
    .from('mise_drivers')
    .select(DRIVER_SELECT)
    .eq('id', session.driver_id)
    .maybeSingle();
  if (!driver) return null;

  await c
    .from('mise_driver_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('token', token);

  return { driver: driver as DriverPublic, token };
}

export function unauthorized() {
  return NextResponse.json(
    { error: 'Nicht autorisiert', code: 'unauthorized' },
    { status: 401 },
  );
}

export function badRequest(error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status: 400 });
}

export function normalizePhone(raw: string): string {
  const t = raw.trim();
  const plus = t.startsWith('+') ? '+' : '';
  return plus + t.replace(/\D/g, '');
}

export function otpHashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const OTP_TTL_MINUTES = OTP_TTL_MIN;
export const MAX_OTP_ATTEMPTS_CONST = MAX_OTP_ATTEMPTS;
