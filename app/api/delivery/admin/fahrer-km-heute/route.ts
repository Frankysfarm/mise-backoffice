/**
 * GET /api/delivery/admin/fahrer-km-heute?location_id=<uuid>
 *
 * Phase 2311 — Fahrer-KM-Heute-API
 * Gesamt-km und km/Tour je Fahrer heute; Alert wenn >150 km/Tag;
 * Kosten-Schätzung (km × 0,30€); Trend vs. gleicher Wochentag letzte Woche;
 * Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KM_SATZ = 0.3;
const ALERT_KM = 150;

export type TrendKm = 'steigend' | 'fallend' | 'stabil';
export type AmpelKm = 'gruen' | 'gelb' | 'rot';

export interface FahrerKmHeute {
  fahrer_id: string;
  fahrer_name: string;
  km_gesamt: number;
  touren_anzahl: number;
  km_pro_tour: number;
  kosten_eur: number;
  km_vorwoche: number | null;
  trend: TrendKm;
  trend_delta: number;
  ampel: AmpelKm;
  alert: boolean;
  rang: number;
}

export interface FahrerKmHeuteAntwort {
  location_id: string;
  fahrer: FahrerKmHeute[];
  team_avg_km: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(km: number): AmpelKm {
  if (km >= ALERT_KM) return 'rot';
  if (km >= 100) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vorwoche: number | null): { trend: TrendKm; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 5) return { trend: 'steigend', delta };
  if (delta < -5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerKmHeute, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    km_gesamt: 87,
    touren_anzahl: 9,
    km_pro_tour: 9.7,
    kosten_eur: 26.1,
    km_vorwoche: 80,
    trend: 'steigend',
    trend_delta: 7,
    ampel: 'gruen',
    alert: false,
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sarah König',
    km_gesamt: 158,
    touren_anzahl: 14,
    km_pro_tour: 11.3,
    kosten_eur: 47.4,
    km_vorwoche: 142,
    trend: 'steigend',
    trend_delta: 16,
    ampel: 'rot',
    alert: true,
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tom Bauer',
    km_gesamt: 112,
    touren_anzahl: 11,
    km_pro_tour: 10.2,
    kosten_eur: 33.6,
    km_vorwoche: 118,
    trend: 'fallend',
    trend_delta: -6,
    ampel: 'gelb',
    alert: false,
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Anna Lang',
    km_gesamt: 65,
    touren_anzahl: 7,
    km_pro_tour: 9.3,
    kosten_eur: 19.5,
    km_vorwoche: 68,
    trend: 'stabil',
    trend_delta: -3,
    ampel: 'gruen',
    alert: false,
  },
];

const MOCK: FahrerKmHeuteAntwort = {
  location_id: 'mock',
  fahrer: MOCK_FAHRER.map((f, i) => ({ ...f, rang: i + 1 })),
  team_avg_km: Math.round(MOCK_FAHRER.reduce((s, f) => s + f.km_gesamt, 0) / MOCK_FAHRER.length),
  alert_count: MOCK_FAHRER.filter((f) => f.alert).length,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const now = new Date();
    const heuteStart = new Date(now);
    heuteStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) heuteStart.setUTCDate(heuteStart.getUTCDate() - 1);

    const vorwocheStart = new Date(heuteStart);
    vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
    const vorwocheEnde = new Date(vorwocheStart);
    vorwocheEnde.setUTCDate(vorwocheEnde.getUTCDate() + 1);

    const [{ data: batchesHeute }, { data: batchesVorwoche }] = await Promise.all([
      sb
        .from('delivery_batches')
        .select('driver_id, distance_km, employees!inner(vorname, nachname)')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('completed_at', heuteStart.toISOString()),
      sb
        .from('delivery_batches')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('completed_at', vorwocheStart.toISOString())
        .lt('completed_at', vorwocheEnde.toISOString()),
    ]);

    if (!batchesHeute || batchesHeute.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type BatchRow = { driver_id: string; distance_km: number | null; employees: unknown };
    const heuteMap = new Map<string, { name: string; km: number; touren: number }>();
    for (const b of batchesHeute as BatchRow[]) {
      const emps = b.employees as { vorname: string; nachname: string }[] | null;
      const emp = Array.isArray(emps) ? emps[0] ?? null : null;
      const name = emp ? `${emp.vorname} ${emp.nachname}` : 'Unbekannt';
      const prev = heuteMap.get(b.driver_id) ?? { name, km: 0, touren: 0 };
      prev.km += b.distance_km ?? 0;
      prev.touren += 1;
      heuteMap.set(b.driver_id, prev);
    }

    type VwRow = { driver_id: string; distance_km: number | null };
    const vorwocheMap = new Map<string, number>();
    for (const b of (batchesVorwoche ?? []) as VwRow[]) {
      vorwocheMap.set(b.driver_id, (vorwocheMap.get(b.driver_id) ?? 0) + (b.distance_km ?? 0));
    }

    const unsorted: Omit<FahrerKmHeute, 'rang'>[] = Array.from(heuteMap.entries()).map(
      ([id, { name, km, touren }]) => {
        const vw = vorwocheMap.get(id) ?? null;
        const { trend, delta } = trendVon(km, vw);
        const kmRound = Math.round(km * 10) / 10;
        return {
          fahrer_id: id,
          fahrer_name: name,
          km_gesamt: kmRound,
          touren_anzahl: touren,
          km_pro_tour: touren > 0 ? Math.round((km / touren) * 10) / 10 : 0,
          kosten_eur: Math.round(km * KM_SATZ * 100) / 100,
          km_vorwoche: vw !== null ? Math.round(vw * 10) / 10 : null,
          trend,
          trend_delta: delta,
          ampel: ampelVon(kmRound),
          alert: kmRound >= ALERT_KM,
        };
      }
    );

    const sorted = unsorted
      .sort((a, b) => b.km_gesamt - a.km_gesamt)
      .map((f, i) => ({ ...f, rang: i + 1 }));

    const teamAvg =
      sorted.length > 0
        ? Math.round((sorted.reduce((s, f) => s + f.km_gesamt, 0) / sorted.length) * 10) / 10
        : 0;

    const result: FahrerKmHeuteAntwort = {
      location_id: locationId,
      fahrer: sorted,
      team_avg_km: teamAvg,
      alert_count: sorted.filter((f) => f.alert).length,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
