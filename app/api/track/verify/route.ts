import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_NUMBER_RX = /^[A-Za-z0-9_-]{1,64}$/;
const WINDOW_MS = 15 * 60 * 1000;

function digest(value: string, pepper: string) {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

function sameLast4(phone: string | null, submitted: string) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return false;
  return timingSafeEqual(Buffer.from(digits.slice(-4)), Buffer.from(submitted));
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { bestellnummer?: unknown; last4?: unknown } | null;
  const bestellnummer = typeof body?.bestellnummer === 'string' ? body.bestellnummer.trim() : '';
  const last4 = typeof body?.last4 === 'string' ? body.last4 : '';
  if (!ORDER_NUMBER_RX.test(bestellnummer) || !/^\d{4}$/.test(last4)) {
    return noStore({ error: 'Ungültige Angaben' }, 400);
  }

  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) return noStore({ error: 'Prüfung nicht verfügbar' }, 503);

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  const ipHash = digest(`ip:${ip}`, pepper);
  const orderHash = digest(`order:${bestellnummer.toUpperCase()}`, pepper);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const svc = createServiceClient();

  const [{ count: ipFailures }, { count: orderFailures }] = await Promise.all([
    svc.from('tracking_verification_attempts').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).eq('success', false).gte('created_at', since),
    svc.from('tracking_verification_attempts').select('id', { count: 'exact', head: true })
      .eq('order_ref_hash', orderHash).eq('success', false).gte('created_at', since),
  ]);

  if ((ipFailures ?? 0) >= 20 || (orderFailures ?? 0) >= 8) {
    return noStore({ error: 'Zu viele Versuche' }, 429);
  }

  const { data: candidates, error } = await svc
    .from('customer_orders')
    .select('id, tracking_token, kunde_telefon')
    .eq('bestellnummer', bestellnummer)
    .limit(20);
  if (error) return noStore({ error: 'Prüfung nicht verfügbar' }, 503);

  const matches = (candidates ?? []).filter((candidate) =>
    candidate.tracking_token && sameLast4(candidate.kunde_telefon, last4),
  );
  const match = matches.length === 1 ? matches[0] : null;

  await svc.from('tracking_verification_attempts').insert({
    order_id: match?.id ?? null,
    ip_hash: ipHash,
    order_ref_hash: orderHash,
    success: Boolean(match),
  });

  if (!match) return noStore({ error: 'Bestellung nicht gefunden' }, 401);

  const url = `/track/${encodeURIComponent(bestellnummer)}?token=${encodeURIComponent(match.tracking_token)}`;
  return noStore({ ok: true, url });
}
