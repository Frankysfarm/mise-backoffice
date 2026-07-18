/**
 * GET /api/delivery/admin/fahrer-abbruchquote?location_id=...
 *
 * Abbruchquote je Fahrer heute (abgebrochene Touren / Gesamt-Touren × 100%).
 * Alert wenn >10%. Ampel grün(<5%)/gelb(5–10%)/rot(>10%).
 * Trend vs. gleicher Wochentag letzte Woche. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerAbbruchquote {
  id: string;
  name: string;
  quote_pct: number;
  quote_pct_vw: number;
  abbrueche: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

export interface AbbruchquoteResponse {
  fahrer: FahrerAbbruchquote[];
  team_avg_pct: number;
  team_avg_pct_vw: number;
  alert_count: number;
  generiert_am: string;
  mock?: boolean;
}

function classifyAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct < 5) return 'gruen';
  if (pct <= 10) return 'gelb';
  return 'rot';
}

function mockData(): AbbruchquoteResponse {
  const fahrer: FahrerAbbruchquote[] = [
    { id: 'd1', name: 'Anna K.', quote_pct: 2.1, quote_pct_vw: 3.0, abbrueche: 0, touren: 12, trend: 'up', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.', quote_pct: 6.7, quote_pct_vw: 5.0, abbrueche: 1, touren: 15, trend: 'down', ampel: 'gelb', alert: false },
    { id: 'd3', name: 'Chris M.', quote_pct: 14.3, quote_pct_vw: 10.0, abbrueche: 2, touren: 14, trend: 'down', ampel: 'rot', alert: true },
    { id: 'd4', name: 'Diana P.', quote_pct: 0.0, quote_pct_vw: 2.0, abbrueche: 0, touren: 11, trend: 'up', ampel: 'gruen', alert: false },
  ];
  const sorted = [...fahrer].sort((a, b) => a.quote_pct - b.quote_pct);
  const team_avg_pct = Math.round((sorted.reduce((s, d) => s + d.quote_pct, 0) / sorted.length) * 10) / 10;
  const team_avg_pct_vw = Math.round((sorted.reduce((s, d) => s + d.quote_pct_vw, 0) / sorted.length) * 10) / 10;
  return {
    fahrer: sorted,
    team_avg_pct,
    team_avg_pct_vw,
    alert_count: sorted.filter(d => d.alert).length,
    generiert_am: new Date().toISOString(),
    mock: true,
  };
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', userId)
    .single();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');

    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user && !locationId) locationId = await resolveLocationId(user.id);
    } catch {
      // unauthenticated — fall through to mock
    }

    if (!locationId) {
      return NextResponse.json({ ok: true, ...mockData() });
    }

    const ssb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(todayStart.getTime() - 7 * 24 * 3_600_000);
    const vwEnd = new Date(todayStart.getTime() - 6 * 24 * 3_600_000);

    const { data: driversRaw } = await ssb
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (!driversRaw || driversRaw.length === 0) {
      return NextResponse.json({ ok: true, ...mockData() });
    }

    const driverIds = (driversRaw as { id: string }[]).map((d) => d.id);

    const { data: toursToday } = await ssb
      .from('delivery_tours')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart.toISOString());

    const { data: toursVW } = await ssb
      .from('delivery_tours')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', vwStart.toISOString())
      .lt('created_at', vwEnd.toISOString());

    const CANCELLED_STATUSES = new Set(['cancelled', 'aborted', 'storniert', 'abgebrochen']);

    function buildMap(tours: Array<{ driver_id: string; status: string }>) {
      const map = new Map<string, { total: number; cancelled: number }>();
      for (const t of tours) {
        if (!map.has(t.driver_id)) map.set(t.driver_id, { total: 0, cancelled: 0 });
        const e = map.get(t.driver_id)!;
        e.total++;
        if (CANCELLED_STATUSES.has((t.status ?? '').toLowerCase())) e.cancelled++;
      }
      return map;
    }

    const todayMap = buildMap(
      (toursToday ?? []) as Array<{ driver_id: string; status: string }>
    );
    const vwMap = buildMap(
      (toursVW ?? []) as Array<{ driver_id: string; status: string }>
    );

    const fahrer: FahrerAbbruchquote[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { total: 0, cancelled: 0 };
      const v = vwMap.get(d.id) ?? { total: 0, cancelled: 0 };

      const pct = t.total > 0 ? Math.round((t.cancelled / t.total) * 1000) / 10 : 0;
      const pctVW = v.total > 0 ? Math.round((v.cancelled / v.total) * 1000) / 10 : 0;

      const trend: 'up' | 'down' | 'neutral' =
        pct < pctVW - 0.5 ? 'up' : pct > pctVW + 0.5 ? 'down' : 'neutral';
      const ampel = classifyAmpel(pct);

      return {
        id: d.id,
        name: d.name as string,
        quote_pct: pct,
        quote_pct_vw: pctVW,
        abbrueche: t.cancelled,
        touren: t.total,
        trend,
        ampel,
        alert: pct > 10,
      };
    });

    const sorted = fahrer.filter(f => f.touren > 0).sort((a, b) => a.quote_pct - b.quote_pct);
    const all = sorted.length > 0 ? sorted : fahrer;

    if (driverId) {
      const f = fahrer.find(d => d.id === driverId) ?? all[0] ?? null;
      const team_avg_pct = all.length > 0
        ? Math.round((all.reduce((s, d) => s + d.quote_pct, 0) / all.length) * 10) / 10
        : 0;
      return NextResponse.json({ ok: true, fahrer_single: f, team_avg_pct, generiert_am: now.toISOString() });
    }

    const team_avg_pct = all.length > 0
      ? Math.round((all.reduce((s, d) => s + d.quote_pct, 0) / all.length) * 10) / 10
      : 0;
    const team_avg_pct_vw = all.length > 0
      ? Math.round((all.reduce((s, d) => s + d.quote_pct_vw, 0) / all.length) * 10) / 10
      : 0;

    return NextResponse.json({
      ok: true,
      fahrer: all,
      team_avg_pct,
      team_avg_pct_vw,
      alert_count: all.filter(d => d.alert).length,
      generiert_am: now.toISOString(),
    });
  } catch (err) {
    console.error('[fahrer-abbruchquote]', err);
    return NextResponse.json({ ok: true, ...mockData() });
  }
}
