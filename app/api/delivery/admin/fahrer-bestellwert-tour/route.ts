/**
 * GET /api/delivery/admin/fahrer-bestellwert-tour?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2756 — Fahrer-Bestellwert-je-Tour Backend
 *
 * Ø Bestellwert je Lieferung je Fahrer heute (aus orders.total_amount je delivery_tour).
 * Ampel: grün(≥25€) / gelb(15–24€) / rot(<15€).
 * Alert <15€: "Niedriger Bestellwert!"
 * Trend vs. gestern. Multi-Tenant; Supabase(orders + delivery_tours) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerBestellwert {
  fahrer_id: string;
  fahrer_name: string;
  avg_bestellwert_eur: number;
  touren: number;
  avg_bestellwert_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerBestellwert[];
  team_avg_bestellwert_eur: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_bestellwert_eur: 32.5, touren: 10, avg_bestellwert_gestern: 30.0, trend: 'steigend', trend_delta:  2.5, ampel: 'gruen', alert: null,                   rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_bestellwert_eur: 21.8, touren:  8, avg_bestellwert_gestern: 23.1, trend: 'fallend',  trend_delta: -1.3, ampel: 'gelb',  alert: null,                   rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_bestellwert_eur: 18.4, touren:  6, avg_bestellwert_gestern: 17.9, trend: 'steigend', trend_delta:  0.5, ampel: 'gelb',  alert: null,                   rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', avg_bestellwert_eur: 11.2, touren:  5, avg_bestellwert_gestern: 13.8, trend: 'fallend',  trend_delta: -2.6, ampel: 'rot',   alert: 'Niedriger Bestellwert!', rang: 4 },
  ],
  team_avg_bestellwert_eur: 20.9,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(eur: number): Ampel {
  if (eur >= 25) return 'gruen';
  if (eur >= 15) return 'gelb';
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
  total_amount: number | null;
};

function aggregateTours(tours: TourRow[]): Map<string, { total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of tours) {
    if (t.total_amount === null || t.total_amount < 0) continue;
    const prev = map.get(t.driver_id) ?? { total: 0, count: 0 };
    map.set(t.driver_id, { total: prev.total + t.total_amount, count: prev.count + 1 });
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
    const yesterday = new Date(now.getTime() - 86_400_000);
    const yStr     = yesterday.toISOString().slice(0, 10);

    const buildQ = (dateStr: string) => {
      const q = sb
        .from('delivery_tours')
        .select('driver_id, total_amount')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('delivered_at', `${dateStr}T00:00:00Z`)
        .lt('delivered_at',  `${dateStr}T23:59:59Z`);
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

    const fahrer: FahrerBestellwert[] = driverIds.map((dId, idx) => {
      const today  = todayMap.get(dId)!;
      const avgEur = today.count > 0
        ? Math.round((today.total / today.count) * 10) / 10
        : 0;
      const yEntry   = yMap.get(dId);
      const avgGest = yEntry && yEntry.count > 0
        ? Math.round((yEntry.total / yEntry.count) * 10) / 10
        : null;
      const ampel  = calcAmpel(avgEur);
      const { trend, delta } = calcTrend(avgEur, avgGest);

      return {
        fahrer_id:               dId,
        fahrer_name:             nameMap[dId] ?? `Fahrer ${idx + 1}`,
        avg_bestellwert_eur:     avgEur,
        touren:                  today.count,
        avg_bestellwert_gestern: avgGest,
        trend,
        trend_delta:             delta,
        ampel,
        alert:                   ampel === 'rot' ? 'Niedriger Bestellwert!' : null,
        rang:                    idx + 1,
      };
    });

    // Absteigend nach Bestellwert: höchster (bester) zuerst
    fahrer.sort((a, b) => b.avg_bestellwert_eur - a.avg_bestellwert_eur);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_bestellwert_eur, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_bestellwert_eur: teamAvg,
      alert_count: fahrer.filter(f => f.alert !== null).length,
      generiert_am: new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
