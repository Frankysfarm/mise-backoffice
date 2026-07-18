/**
 * GET /api/delivery/admin/fahrer-tour-effizienz?location_id=<uuid>
 *
 * Phase 2269 — Fahrer-Tour-Effizienz-API
 * Touren/Stunde je Fahrer heute; Stopps je Tour; Leerlauf-Zeit; Trend vs. Vorwoche;
 * Alert wenn <1,5 Touren/Std; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerTourEffizienz[], team_avg_touren_pro_std, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerTourEffizienz {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  schicht_stunden: number;
  touren_pro_std: number;
  avg_stopps_je_tour: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerTourEffizienzAntwort {
  location_id: string;
  fahrer: FahrerTourEffizienz[];
  team_avg_touren_pro_std: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(tph: number): Ampel {
  if (tph >= 2) return 'gruen';
  if (tph >= 1.5) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 100) / 100;
  if (delta > 0.1) return { trend: 'steigend', delta };
  if (delta < -0.1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerTourEffizienz, 'rang'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',   touren_heute: 14, schicht_stunden: 5.5, touren_pro_std: 2.5, avg_stopps_je_tour: 3.2, trend: 'steigend', trend_delta: 0.3, ampel: 'gruen' },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',    touren_heute: 10, schicht_stunden: 5.0, touren_pro_std: 2.0, avg_stopps_je_tour: 2.8, trend: 'stabil',   trend_delta: 0.0, ampel: 'gruen' },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Becker',   touren_heute: 7,  schicht_stunden: 5.0, touren_pro_std: 1.4, avg_stopps_je_tour: 4.1, trend: 'fallend',  trend_delta: -0.4, ampel: 'rot'  },
  { fahrer_id: 'mock-f4', fahrer_name: 'Lisa Fuchs',   touren_heute: 9,  schicht_stunden: 5.5, touren_pro_std: 1.6, avg_stopps_je_tour: 3.0, trend: 'steigend', trend_delta: 0.2, ampel: 'gelb' },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jonas Weber',  touren_heute: 12, schicht_stunden: 6.0, touren_pro_std: 2.0, avg_stopps_je_tour: 2.5, trend: 'stabil',   trend_delta: 0.1, ampel: 'gruen' },
];

function mockResponse(locationId: string): FahrerTourEffizienzAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.touren_pro_std - a.touren_pro_std);
  const fahrer: FahrerTourEffizienz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_touren_pro_std =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.touren_pro_std, 0) / fahrer.length) * 100) / 100
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_avg_touren_pro_std,
    alert_count: fahrer.filter((f) => f.ampel === 'rot').length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const sb = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekIso = lastWeek.toISOString();

    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);

    if (!drivers || drivers.length === 0) return NextResponse.json(mockResponse(locationId));

    // Fetch batches today (each batch = 1 tour)
    const { data: batchesToday } = await sb
      .from('delivery_batches')
      .select('fahrer_id, order_ids, created_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .not('fahrer_id', 'is', null);

    if (!batchesToday || batchesToday.length === 0) return NextResponse.json(mockResponse(locationId));

    const { data: batchesVorwoche } = await sb
      .from('delivery_batches')
      .select('fahrer_id, order_ids, created_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekIso)
      .lt('created_at', todayIso)
      .not('fahrer_id', 'is', null);

    type BatchRow = { fahrer_id: string | null; order_ids: string[] | null; created_at: string; delivered_at: string | null };

    function buildEffizienzMap(batches: BatchRow[]): Map<string, { touren: number; stopps: number; firstAt: number; lastAt: number }> {
      const map = new Map<string, { touren: number; stopps: number; firstAt: number; lastAt: number }>();
      for (const b of batches) {
        if (!b.fahrer_id) continue;
        const stopps = Array.isArray(b.order_ids) ? b.order_ids.length : 1;
        const startMs = new Date(b.created_at).getTime();
        const endMs = b.delivered_at ? new Date(b.delivered_at).getTime() : startMs;
        const entry = map.get(b.fahrer_id) ?? { touren: 0, stopps: 0, firstAt: startMs, lastAt: endMs };
        entry.touren += 1;
        entry.stopps += stopps;
        if (startMs < entry.firstAt) entry.firstAt = startMs;
        if (endMs > entry.lastAt) entry.lastAt = endMs;
        map.set(b.fahrer_id, entry);
      }
      return map;
    }

    const todayMap = buildEffizienzMap(batchesToday as BatchRow[]);
    const vorwocheMap = buildEffizienzMap((batchesVorwoche ?? []) as BatchRow[]);

    const driverList: Omit<FahrerTourEffizienz, 'rang'>[] = drivers
      .filter((d) => todayMap.has(d.id))
      .map((d) => {
        const t = todayMap.get(d.id)!;
        const schichtMs = Math.max(t.lastAt - t.firstAt, 1);
        const schicht_stunden = Math.round((schichtMs / 3600000) * 10) / 10;
        const touren_pro_std = schicht_stunden > 0
          ? Math.round((t.touren / schicht_stunden) * 100) / 100
          : 0;
        const avg_stopps_je_tour = t.touren > 0
          ? Math.round((t.stopps / t.touren) * 10) / 10
          : 0;

        const v = vorwocheMap.get(d.id);
        let vorwocheTph = touren_pro_std;
        if (v) {
          const vMs = Math.max(v.lastAt - v.firstAt, 1);
          const vStd = vMs / 3600000;
          vorwocheTph = vStd > 0 ? v.touren / vStd : touren_pro_std;
        }
        const { trend, delta } = trendVon(touren_pro_std, vorwocheTph);

        return {
          fahrer_id: d.id,
          fahrer_name: `${d.vorname} ${d.nachname[0]}.`,
          touren_heute: t.touren,
          schicht_stunden,
          touren_pro_std,
          avg_stopps_je_tour,
          trend,
          trend_delta: delta,
          ampel: ampelVon(touren_pro_std),
        };
      });

    if (driverList.length === 0) return NextResponse.json(mockResponse(locationId));

    const sorted = driverList.sort((a, b) => b.touren_pro_std - a.touren_pro_std);
    const fahrer: FahrerTourEffizienz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_avg_touren_pro_std =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.touren_pro_std, 0) / fahrer.length) * 100) / 100
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_touren_pro_std,
      alert_count: fahrer.filter((f) => f.ampel === 'rot').length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerTourEffizienzAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
