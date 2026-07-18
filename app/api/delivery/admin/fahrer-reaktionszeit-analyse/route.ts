/**
 * GET /api/delivery/admin/fahrer-reaktionszeit-analyse?location_id=...
 *
 * Ø Reaktionszeit je Fahrer heute (Zeit von Zuweisung bis Abfahrt in Sekunden).
 * Alert wenn >120s. Ampel grün(≤60s)/gelb(61–120s)/rot(>120s).
 * Trend vs. gleicher Wochentag letzte Woche. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerReaktionszeitAnalyse {
  id: string;
  name: string;
  avg_sek: number;
  avg_sek_vw: number;
  min_sek: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

export interface ReaktionszeitAnalyseResponse {
  fahrer: FahrerReaktionszeitAnalyse[];
  team_avg_sek: number;
  team_avg_sek_vw: number;
  alert_count: number;
  generiert_am: string;
  mock?: boolean;
}

function classifyAmpel(sek: number): 'gruen' | 'gelb' | 'rot' {
  if (sek <= 60) return 'gruen';
  if (sek <= 120) return 'gelb';
  return 'rot';
}

function mockData(): ReaktionszeitAnalyseResponse {
  const fahrer: FahrerReaktionszeitAnalyse[] = [
    { id: 'd1', name: 'Anna K.', avg_sek: 42, avg_sek_vw: 55, min_sek: 28, touren: 12, trend: 'up', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.', avg_sek: 78, avg_sek_vw: 72, min_sek: 45, touren: 15, trend: 'down', ampel: 'gelb', alert: false },
    { id: 'd3', name: 'Chris M.', avg_sek: 145, avg_sek_vw: 130, min_sek: 90, touren: 10, trend: 'down', ampel: 'rot', alert: true },
    { id: 'd4', name: 'Diana P.', avg_sek: 55, avg_sek_vw: 60, min_sek: 30, touren: 14, trend: 'up', ampel: 'gruen', alert: false },
  ];
  const sorted = [...fahrer].sort((a, b) => a.avg_sek - b.avg_sek);
  const team_avg_sek = Math.round(sorted.reduce((s, d) => s + d.avg_sek, 0) / sorted.length);
  const team_avg_sek_vw = Math.round(sorted.reduce((s, d) => s + d.avg_sek_vw, 0) / sorted.length);
  return {
    fahrer: sorted,
    team_avg_sek,
    team_avg_sek_vw,
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
      .select('driver_id, assigned_at, departed_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .not('assigned_at', 'is', null)
      .not('departed_at', 'is', null)
      .gte('assigned_at', todayStart.toISOString());

    const { data: toursVW } = await ssb
      .from('delivery_tours')
      .select('driver_id, assigned_at, departed_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .not('assigned_at', 'is', null)
      .not('departed_at', 'is', null)
      .gte('assigned_at', vwStart.toISOString())
      .lt('assigned_at', vwEnd.toISOString());

    function buildMap(tours: Array<{ driver_id: string; assigned_at: string; departed_at: string }>) {
      const map = new Map<string, { sum: number; count: number; min: number }>();
      for (const t of tours) {
        const diffMs = new Date(t.departed_at).getTime() - new Date(t.assigned_at).getTime();
        const diffSek = diffMs / 1000;
        if (diffSek <= 0 || diffSek > 3600) continue;
        if (!map.has(t.driver_id)) map.set(t.driver_id, { sum: 0, count: 0, min: Infinity });
        const e = map.get(t.driver_id)!;
        e.sum += diffSek;
        e.count++;
        if (diffSek < e.min) e.min = diffSek;
      }
      return map;
    }

    const todayMap = buildMap(
      (toursToday ?? []) as Array<{ driver_id: string; assigned_at: string; departed_at: string }>
    );
    const vwMap = buildMap(
      (toursVW ?? []) as Array<{ driver_id: string; assigned_at: string; departed_at: string }>
    );

    const fahrer: FahrerReaktionszeitAnalyse[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { sum: 0, count: 0, min: 0 };
      const v = vwMap.get(d.id) ?? { sum: 0, count: 0, min: 0 };

      const avg = t.count > 0 ? Math.round(t.sum / t.count) : 0;
      const avgVW = v.count > 0 ? Math.round(v.sum / v.count) : 0;
      const minSek = t.min === Infinity ? 0 : Math.round(t.min);

      const trend: 'up' | 'down' | 'neutral' =
        avg < avgVW - 3 ? 'up' : avg > avgVW + 3 ? 'down' : 'neutral';
      const ampel = classifyAmpel(avg);

      return {
        id: d.id,
        name: d.name as string,
        avg_sek: avg,
        avg_sek_vw: avgVW,
        min_sek: minSek,
        touren: t.count,
        trend,
        ampel,
        alert: avg > 120,
      };
    });

    const sorted = fahrer.filter(f => f.touren > 0).sort((a, b) => a.avg_sek - b.avg_sek);
    const all = sorted.length > 0 ? sorted : fahrer;

    if (driverId) {
      const f = fahrer.find(d => d.id === driverId) ?? all[0] ?? null;
      const team_avg_sek = all.length > 0 ? Math.round(all.reduce((s, d) => s + d.avg_sek, 0) / all.length) : 0;
      return NextResponse.json({ ok: true, fahrer_single: f, team_avg_sek, generiert_am: now.toISOString() });
    }

    const team_avg_sek = all.length > 0 ? Math.round(all.reduce((s, d) => s + d.avg_sek, 0) / all.length) : 0;
    const team_avg_sek_vw = all.length > 0 ? Math.round(all.reduce((s, d) => s + d.avg_sek_vw, 0) / all.length) : 0;

    return NextResponse.json({
      ok: true,
      fahrer: all,
      team_avg_sek,
      team_avg_sek_vw,
      alert_count: all.filter(d => d.alert).length,
      generiert_am: now.toISOString(),
    });
  } catch (err) {
    console.error('[fahrer-reaktionszeit-analyse]', err);
    return NextResponse.json({ ok: true, ...mockData() });
  }
}
