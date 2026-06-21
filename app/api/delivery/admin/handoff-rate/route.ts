/**
 * GET /api/delivery/admin/handoff-rate
 *   ?action=history&days=30 — Tages-Snapshots für Trend-Chart (default: 30 Tage)
 *   ?action=current          — Live-Berechnung für den heutigen Tag (kein Snapshot)
 * POST /api/delivery/admin/handoff-rate
 *   { action: 'snapshot', date?: 'YYYY-MM-DD' } — Snapshot jetzt schreiben
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getHandoffRateDailyHistory,
  snapshotHandoffRateDaily,
} from '@/lib/delivery/kitchen-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const qLoc = url.searchParams.get('location_id');
  if (qLoc) return qLoc;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });

  const url    = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'history';

  if (action === 'history') {
    const days = Math.min(Number(url.searchParams.get('days') ?? 30), 90);
    const history = await getHandoffRateDailyHistory(locationId, days).catch(() => []);
    return NextResponse.json({ ok: true, locationId, days, history });
  }

  if (action === 'current') {
    // Live-Berechnung für heute (letzten 24h als Annäherung)
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${today}T00:00:00+01:00`).toISOString();
    const serviceSb = (await import('@/lib/supabase/server')).createServiceClient();
    const { data: orders } = await serviceSb
      .from('customer_orders')
      .select('fertig_am, abgeholt_am')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .not('fertig_am', 'is', null)
      .not('abgeholt_am', 'is', null)
      .gte('fertig_am', dayStart)
      .limit(500);

    const waits = (orders ?? []).map((o) =>
      Math.max(0, (new Date(o.abgeholt_am as string).getTime() - new Date(o.fertig_am as string).getTime()) / 60_000),
    );
    const total  = waits.length;
    const quick  = waits.filter((w) => w < 3).length;
    const ok     = waits.filter((w) => w >= 3 && w <= 5).length;
    const late   = waits.filter((w) => w > 5).length;
    const avg    = total > 0 ? waits.reduce((s, w) => s + w, 0) / total : null;

    return NextResponse.json({
      ok: true,
      locationId,
      date: today,
      totalOrders:   total,
      quickPickups:  quick,
      okPickups:     ok,
      latePickups:   late,
      avgWaitMin:    avg !== null ? Math.round(avg * 100) / 100 : null,
      quickRatePct:  total > 0 ? Math.round((quick / total) * 10000) / 100 : null,
      lateRatePct:   total > 0 ? Math.round((late  / total) * 10000) / 100 : null,
    });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });

  const body   = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'snapshot') {
    const date = typeof body.date === 'string' ? body.date : undefined;
    const result = await snapshotHandoffRateDaily(locationId, date);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
