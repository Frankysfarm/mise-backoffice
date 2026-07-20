/**
 * GET /api/delivery/admin/fahrer-fehlerquote?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2766 — Fahrer-Fehlerquote Backend
 *
 * Anzahl Lieferfehler je Fahrer heute (delivery_tours.status='failed'|'returned').
 * Fehlerquote in % (Fehler / Gesamttouren × 100).
 * Ampel: grün(<5%) / gelb(5–15%) / rot(>15%).
 * Alert >15%: "Fehlerquote zu hoch!"
 * Trend vs. gestern. Multi-Tenant; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerFehlerquote {
  fahrer_id: string;
  fahrer_name: string;
  fehler: number;
  touren: number;
  fehlerquote_pct: number;
  fehlerquote_pct_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerFehlerquote[];
  team_avg_pct: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   fehler: 0, touren: 12, fehlerquote_pct:  0.0, fehlerquote_pct_gestern:  2.0, trend: 'fallend',  trend_delta: -2.0, ampel: 'gruen', alert: null,                   rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  fehler: 1, touren: 10, fehlerquote_pct: 10.0, fehlerquote_pct_gestern:  8.0, trend: 'steigend', trend_delta:  2.0, ampel: 'gelb',  alert: null,                   rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   fehler: 1, touren:  8, fehlerquote_pct: 12.5, fehlerquote_pct_gestern: 14.0, trend: 'fallend',  trend_delta: -1.5, ampel: 'gelb',  alert: null,                   rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', fehler: 2, touren:  9, fehlerquote_pct: 22.2, fehlerquote_pct_gestern: 11.1, trend: 'steigend', trend_delta: 11.1, ampel: 'rot',   alert: 'Fehlerquote zu hoch!', rang: 4 },
  ],
  team_avg_pct: 11.2,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(pct: number): Ampel {
  if (pct < 5)  return 'gruen';
  if (pct <= 15) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >  0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

type TourRow = {
  driver_id: string;
  status: string | null;
};

interface TourAgg {
  fehler: number;
  touren: number;
}

function aggregateTours(tours: TourRow[]): Map<string, TourAgg> {
  const map = new Map<string, TourAgg>();
  for (const t of tours) {
    const prev = map.get(t.driver_id) ?? { fehler: 0, touren: 0 };
    prev.touren++;
    if (t.status === 'failed' || t.status === 'returned') prev.fehler++;
    map.set(t.driver_id, prev);
  }
  return map;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = createServiceClient();
    const now      = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yStr     = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

    const buildQ = (dateStr: string) => {
      const q = sb
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at',  `${dateStr}T23:59:59Z`);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayTours } = await buildQ(todayStr);
    const { data: yTours     } = await buildQ(yStr);

    if (!todayTours?.length) return NextResponse.json(MOCK);

    const todayMap = aggregateTours(todayTours as TourRow[]);
    const yMap     = aggregateTours((yTours ?? []) as TourRow[]);

    if (todayMap.size === 0) return NextResponse.json(MOCK);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerFehlerquote[] = driverIds.map((dId, idx) => {
      const today    = todayMap.get(dId)!;
      const pct      = today.touren > 0
        ? Math.round((today.fehler / today.touren) * 1000) / 10
        : 0;
      const yEntry   = yMap.get(dId);
      const pctGest  = yEntry && yEntry.touren > 0
        ? Math.round((yEntry.fehler / yEntry.touren) * 1000) / 10
        : null;
      const ampel    = calcAmpel(pct);
      const { trend, delta } = calcTrend(pct, pctGest);

      return {
        fahrer_id:               dId,
        fahrer_name:             nameMap[dId] ?? `Fahrer ${idx + 1}`,
        fehler:                  today.fehler,
        touren:                  today.touren,
        fehlerquote_pct:         pct,
        fehlerquote_pct_gestern: pctGest,
        trend,
        trend_delta:             delta,
        ampel,
        alert:                   pct > 15 ? 'Fehlerquote zu hoch!' : null,
        rang:                    idx + 1,
      };
    });

    // Absteigend: höchste Fehlerquote (schlechteste) zuerst
    fahrer.sort((a, b) => b.fehlerquote_pct - a.fehlerquote_pct);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.fehlerquote_pct, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_pct: teamAvg,
      alert_count: fahrer.filter(f => f.alert !== null).length,
      generiert_am: new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
