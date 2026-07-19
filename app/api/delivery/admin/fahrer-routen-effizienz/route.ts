/**
 * GET /api/delivery/admin/fahrer-routen-effizienz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2564 — Fahrer-Routen-Effizienz
 * Effizienz = Direkt-km / Ist-km × 100; Ampel grün(≥80%)/gelb(60–79%)/rot(<60%);
 * Alert <60%; Trend vs. VW; driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_PCT = 60;
const GRUEN_PCT = 80;

export type TrendRE = 'steigend' | 'fallend' | 'stabil';
export type AmpelRE = 'gruen' | 'gelb' | 'rot';

export interface FahrerRoutenEffizienzEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_pct: number;
  effizienz_pct_vw: number | null;
  direkt_km: number;
  ist_km: number;
  lieferungen_count: number;
  trend: TrendRE;
  trend_delta: number;
  ampel: AmpelRE;
  alert: boolean;
}

export interface FahrerRoutenEffizienzAntwort {
  location_id: string;
  fahrer: FahrerRoutenEffizienzEntry[];
  fahrer_single?: FahrerRoutenEffizienzEntry;
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelRE {
  if (pct >= GRUEN_PCT) return 'gruen';
  if (pct >= ALERT_PCT) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vw: number | null): { trend: TrendRE; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerRoutenEffizienzEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     effizienz_pct: 85.2, effizienz_pct_vw: 82.0, direkt_km: 3.4, ist_km: 4.0, lieferungen_count: 12, trend: 'steigend', trend_delta:  3.2, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    effizienz_pct: 54.7, effizienz_pct_vw: 59.0, direkt_km: 2.6, ist_km: 4.8, lieferungen_count:  9, trend: 'fallend',  trend_delta: -4.3, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', effizienz_pct: 68.9, effizienz_pct_vw: 67.0, direkt_km: 3.1, ist_km: 4.5, lieferungen_count: 11, trend: 'steigend', trend_delta:  1.9, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     effizienz_pct: 91.0, effizienz_pct_vw: 88.5, direkt_km: 4.1, ist_km: 4.5, lieferungen_count: 14, trend: 'steigend', trend_delta:  2.5, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   effizienz_pct: 48.3, effizienz_pct_vw: 52.0, direkt_km: 2.2, ist_km: 4.6, lieferungen_count:  7, trend: 'fallend',  trend_delta: -3.7, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerRoutenEffizienzAntwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvgPct = Math.round(fahrer.reduce((s, f) => s + f.effizienz_pct, 0) / fahrer.length * 10) / 10;
  const teamAvgVw  = Math.round(fahrer.reduce((s, f) => s + (f.effizienz_pct_vw ?? f.effizienz_pct), 0) / fahrer.length * 10) / 10;
  const base: FahrerRoutenEffizienzAntwort = {
    location_id: locationId,
    fahrer,
    team_avg_pct: teamAvgPct,
    team_avg_pct_vw: teamAvgVw,
    alert_count: alertCount,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    const single = fahrer.find(f => f.fahrer_id === driverId) ?? { ...fahrer[0], fahrer_id: driverId };
    return { ...base, fahrer_single: single };
  }
  return base;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const vwStart = new Date(todayStart);
    vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd = new Date(todayEnd);
    vwEnd.setDate(vwEnd.getDate() - 7);

    let query = supabase
      .from('delivery_tours')
      .select('driver_id, actual_distance_km, direct_distance_km, employees(first_name, last_name)')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .not('actual_distance_km', 'is', null)
      .gt('actual_distance_km', 0);

    if (driverId) query = query.eq('driver_id', driverId);

    const { data: tours, error } = await query;
    if (error || !tours || tours.length === 0) {
      return NextResponse.json(mockAntwort(locationId, driverId));
    }

    const driverMap = new Map<string, { name: string; direktSum: number; istSum: number; count: number }>();
    for (const t of tours) {
      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      const name = emp ? `${(emp as any).first_name ?? ''} ${(emp as any).last_name ?? ''}`.trim() : t.driver_id;
      const entry = driverMap.get(t.driver_id) ?? { name, direktSum: 0, istSum: 0, count: 0 };
      entry.direktSum += (t.direct_distance_km ?? t.actual_distance_km * 0.75);
      entry.istSum    += t.actual_distance_km;
      entry.count++;
      driverMap.set(t.driver_id, entry);
    }

    let vwQuery = supabase
      .from('delivery_tours')
      .select('driver_id, actual_distance_km, direct_distance_km')
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString())
      .not('actual_distance_km', 'is', null)
      .gt('actual_distance_km', 0);

    if (driverId) vwQuery = vwQuery.eq('driver_id', driverId);

    const { data: vwTours } = await vwQuery;
    const vwMap = new Map<string, { direktSum: number; istSum: number }>();
    for (const t of (vwTours ?? [])) {
      const entry = vwMap.get(t.driver_id) ?? { direktSum: 0, istSum: 0 };
      entry.direktSum += (t.direct_distance_km ?? t.actual_distance_km * 0.75);
      entry.istSum    += t.actual_distance_km;
      vwMap.set(t.driver_id, entry);
    }

    const fahrerList: FahrerRoutenEffizienzEntry[] = [];
    for (const [fId, d] of driverMap.entries()) {
      const effPct = Math.round((d.direktSum / d.istSum) * 1000) / 10;
      const vw = vwMap.get(fId);
      const effVw = vw && vw.istSum > 0
        ? Math.round((vw.direktSum / vw.istSum) * 1000) / 10
        : null;
      const { trend, delta } = trendVon(effPct, effVw);
      fahrerList.push({
        fahrer_id: fId,
        fahrer_name: d.name,
        effizienz_pct: effPct,
        effizienz_pct_vw: effVw,
        direkt_km: Math.round(d.direktSum / d.count * 10) / 10,
        ist_km:    Math.round(d.istSum    / d.count * 10) / 10,
        lieferungen_count: d.count,
        trend,
        trend_delta: delta,
        ampel: ampelVon(effPct),
        alert: effPct < ALERT_PCT,
      });
    }

    const alertCount = fahrerList.filter(f => f.alert).length;
    const teamAvgPct = fahrerList.length > 0
      ? Math.round(fahrerList.reduce((s, f) => s + f.effizienz_pct, 0) / fahrerList.length * 10) / 10
      : 0;
    const allVw = fahrerList.filter(f => f.effizienz_pct_vw != null);
    const teamAvgVw = allVw.length > 0
      ? Math.round(allVw.reduce((s, f) => s + (f.effizienz_pct_vw ?? 0), 0) / allVw.length * 10) / 10
      : null;

    const resp: FahrerRoutenEffizienzAntwort = {
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_pct: teamAvgPct,
      team_avg_pct_vw: teamAvgVw,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    };
    if (driverId) {
      resp.fahrer_single = fahrerList.find(f => f.fahrer_id === driverId);
    }
    return NextResponse.json(resp);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
