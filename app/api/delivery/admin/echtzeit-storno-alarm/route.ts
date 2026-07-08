/**
 * GET /api/delivery/admin/echtzeit-storno-alarm?location_id=<uuid>
 *
 * Phase 708 — Echtzeit-Storno-Alarm
 * Zählt Stornierungen in den letzten 15 Minuten und berechnet die Storno-Rate.
 * Alarm wenn ≥3 Stornos in 15 Min oder Storno-Rate ≥25%.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALARM_SCHWELLE = 3;
const ALARM_RATE_PCT = 25;

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
  if (fromQuery) return fromQuery;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();

  const { data: orders } = await sb
    .from('orders')
    .select('status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', since);

  const allOrders = orders ?? [];
  const stornosLetzte15Min = allOrders.filter((o) => o.status === 'cancelled').length;
  const bestellungenLetzte15Min = allOrders.length;
  const stornoRatePct =
    bestellungenLetzte15Min > 0
      ? Math.round((stornosLetzte15Min / bestellungenLetzte15Min) * 100)
      : 0;

  const ausgeloest =
    stornosLetzte15Min >= ALARM_SCHWELLE || stornoRatePct >= ALARM_RATE_PCT;

  return NextResponse.json({
    stornosLetzte15Min,
    stornoRatePct,
    bestellungenLetzte15Min,
    ausgeloest,
  });
}
