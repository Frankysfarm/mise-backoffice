/**
 * GET /api/delivery/admin/tour-auslastungs-kapazitaet?location_id=<uuid>
 *
 * Phase 894 — Tour-Auslastungs-Kapazitäts-API
 * Aktive Touren vs. maximale gleichzeitige Kapazität; Auslastung 0–100% + Trend.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
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
  const now = new Date();
  const since1h = new Date(now.getTime() - 3_600_000);
  const since2h = new Date(now.getTime() - 2 * 3_600_000);

  // Active tours now
  const { data: activeTours } = await sb
    .from('delivery_batches')
    .select('id, driver_id, started_at, stops_count')
    .eq('location_id', locationId)
    .in('status', ['unterwegs', 'in_delivery', 'dispatched'])
    .not('started_at', 'is', null);

  // Max concurrent drivers (online in last hour)
  const { data: onlineDrivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_online', true);

  const aktiveTours = activeTours ?? [];
  const maxKapazitaet = Math.max((onlineDrivers ?? []).length, aktiveTours.length, 1);
  const auslastungPct = Math.min(100, Math.round((aktiveTours.length / maxKapazitaet) * 100));

  // Trend: compare last 30 min vs. 30 min before that
  const since30min = new Date(now.getTime() - 30 * 60_000);
  const since60min = new Date(now.getTime() - 60 * 60_000);

  const { count: toursLast30 } = await sb
    .from('delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('started_at', since30min.toISOString());

  const { count: toursPrev30 } = await sb
    .from('delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('started_at', since60min.toISOString())
    .lt('started_at', since30min.toISOString());

  const last30 = toursLast30 ?? 0;
  const prev30 = toursPrev30 ?? 0;
  const trend: 'steigend' | 'fallend' | 'stabil' =
    last30 > prev30 + 1 ? 'steigend' :
    last30 < prev30 - 1 ? 'fallend' : 'stabil';

  // Completed tours last hour for context
  const { count: abgeschlossenLetzte1h } = await sb
    .from('delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'abgeschlossen')
    .gte('completed_at', since1h.toISOString());

  const { count: abgeschlossenLetzte2h } = await sb
    .from('delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'abgeschlossen')
    .gte('completed_at', since2h.toISOString())
    .lt('completed_at', since1h.toISOString());

  return NextResponse.json({
    aktive_touren: aktiveTours.length,
    max_kapazitaet: maxKapazitaet,
    auslastung_pct: auslastungPct,
    trend,
    abgeschlossen_letzte_1h: abgeschlossenLetzte1h ?? 0,
    abgeschlossen_letzte_2h: abgeschlossenLetzte2h ?? 0,
    fahrer_online: (onlineDrivers ?? []).length,
    generatedAt: now.toISOString(),
  });
}
