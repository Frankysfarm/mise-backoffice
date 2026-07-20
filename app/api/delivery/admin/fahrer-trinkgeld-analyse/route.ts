/**
 * GET /api/delivery/admin/fahrer-trinkgeld-analyse?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2609 — Fahrer-Trinkgeld-Analyse
 * Ø Trinkgeld je Fahrer heute in €; Ampel grün(≥5 €)/gelb(2–4.99 €)/rot(<2 €);
 * Alert <2 €; Trend vs. gestern; driver_id-Modus; Multi-Tenant;
 * Supabase(orders.tip_amount via delivery_tours)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZIEL_EUR  = 5;
const ALERT_EUR = 2;
const GRUEN_EUR = 5;
const GELB_EUR  = 2;

export type AmpelTrinkgeld = 'gruen' | 'gelb' | 'rot';
export type TrendTrinkgeld = 'besser' | 'schlechter' | 'stabil';

export interface FahrerTrinkgeldEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_trinkgeld_heute: number;
  avg_trinkgeld_gestern: number | null;
  lieferungen_heute: number;
  trend: TrendTrinkgeld;
  trend_delta: number;
  ampel: AmpelTrinkgeld;
  alert: boolean;
}

export interface FahrerTrinkgeldAntwort {
  location_id: string;
  fahrer: FahrerTrinkgeldEntry[];
  fahrer_single?: FahrerTrinkgeldEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(avg: number): AmpelTrinkgeld {
  if (avg >= GRUEN_EUR) return 'gruen';
  if (avg >= GELB_EUR)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendTrinkgeld; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 100) / 100;
  if (delta >= 0.5)  return { trend: 'besser',     delta };
  if (delta <= -0.5) return { trend: 'schlechter', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerTrinkgeldEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     avg_trinkgeld_heute: 6.80, avg_trinkgeld_gestern: 5.20, lieferungen_heute: 12, trend: 'besser',     trend_delta: 1.60,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    avg_trinkgeld_heute: 1.40, avg_trinkgeld_gestern: 4.10, lieferungen_heute: 8,  trend: 'schlechter', trend_delta: -2.70, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', avg_trinkgeld_heute: 3.50, avg_trinkgeld_gestern: 3.80, lieferungen_heute: 10, trend: 'stabil',     trend_delta: -0.30, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     avg_trinkgeld_heute: 5.90, avg_trinkgeld_gestern: 6.20, lieferungen_heute: 11, trend: 'stabil',     trend_delta: -0.30, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   avg_trinkgeld_heute: 0.80, avg_trinkgeld_gestern: 4.50, lieferungen_heute: 6,  trend: 'schlechter', trend_delta: -3.70, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerTrinkgeldAntwort {
  const alertCount  = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg     = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.avg_trinkgeld_heute,            0) / MOCK_FAHRER.length * 100) / 100;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.avg_trinkgeld_gestern ?? 0),   0) / MOCK_FAHRER.length * 100) / 100;
  const base: FahrerTrinkgeldAntwort = {
    location_id:      locationId,
    fahrer:           MOCK_FAHRER,
    team_avg_heute:   teamAvg,
    team_avg_gestern: teamGestern,
    ziel:             ZIEL_EUR,
    alert_count:      alertCount,
    generiert_am:     new Date().toISOString(),
  };
  if (driverId) {
    const me = MOCK_FAHRER.find(f => f.fahrer_id === driverId) ?? MOCK_FAHRER[0];
    return { ...base, fahrer_single: me };
  }
  return base;
}

export async function GET(req: NextRequest) {
  const url        = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const driverId   = url.searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(mockAntwort('demo', driverId));

  try {
    const sb = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setUTCHours(4, 0, 0, 0);
    if (now.getUTCHours() < 4) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const [{ data: todayData }, { data: yesterdayData }, { data: employeesData }] = await Promise.all([
      sb.from('delivery_tours')
        .select('driver_id, orders(tip_amount)')
        .eq('location_id', locationId)
        .gte('started_at', todayStart.toISOString())
        .lt('started_at', todayEnd.toISOString()),
      sb.from('delivery_tours')
        .select('driver_id, orders(tip_amount)')
        .eq('location_id', locationId)
        .gte('started_at', yesterdayStart.toISOString())
        .lt('started_at', yesterdayEnd.toISOString()),
      sb.from('employees')
        .select('id, vorname, nachname')
        .eq('location_id', locationId),
    ]);

    if (!todayData || todayData.length === 0) {
      return NextResponse.json(mockAntwort(locationId, driverId));
    }

    const nameMap = new Map<string, string>();
    for (const e of employeesData ?? []) {
      nameMap.set(e.id, `${e.vorname} ${e.nachname}`);
    }

    type TourRow = { driver_id: string; orders: { tip_amount: number } | { tip_amount: number }[] | null };

    function buildTipMap(tours: TourRow[]): Map<string, { sum: number; count: number }> {
      const m = new Map<string, { sum: number; count: number }>();
      for (const t of tours) {
        const tip = Array.isArray(t.orders)
          ? t.orders.reduce((s: number, o: { tip_amount: number }) => s + (o.tip_amount ?? 0), 0)
          : (t.orders as { tip_amount: number } | null)?.tip_amount ?? 0;
        const prev = m.get(t.driver_id) ?? { sum: 0, count: 0 };
        m.set(t.driver_id, { sum: prev.sum + tip, count: prev.count + 1 });
      }
      return m;
    }

    const todayMap     = buildTipMap(todayData as TourRow[]);
    const yesterdayMap = buildTipMap((yesterdayData ?? []) as TourRow[]);

    const fahrer: FahrerTrinkgeldEntry[] = Array.from(todayMap.entries()).map(([id, { sum, count }]) => {
      const avgHeute    = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      const yEntry      = yesterdayMap.get(id);
      const avgGestern  = yEntry && yEntry.count > 0 ? Math.round((yEntry.sum / yEntry.count) * 100) / 100 : null;
      const { trend, delta } = trendVon(avgHeute, avgGestern);
      return {
        fahrer_id:            id,
        fahrer_name:          nameMap.get(id) ?? 'Fahrer',
        avg_trinkgeld_heute:  avgHeute,
        avg_trinkgeld_gestern: avgGestern,
        lieferungen_heute:    count,
        trend,
        trend_delta:          delta,
        ampel:                ampelVon(avgHeute),
        alert:                avgHeute < ALERT_EUR,
      };
    });

    const teamAvg     = fahrer.length ? Math.round(fahrer.reduce((s, f) => s + f.avg_trinkgeld_heute,            0) / fahrer.length * 100) / 100 : 0;
    const gFahrer     = fahrer.filter(f => f.avg_trinkgeld_gestern !== null);
    const teamGestern = gFahrer.length ? Math.round(gFahrer.reduce((s, f) => s + (f.avg_trinkgeld_gestern ?? 0), 0) / gFahrer.length * 100) / 100 : null;

    const antwort: FahrerTrinkgeldAntwort = {
      location_id:      locationId,
      fahrer,
      team_avg_heute:   teamAvg,
      team_avg_gestern: teamGestern,
      ziel:             ZIEL_EUR,
      alert_count:      fahrer.filter(f => f.alert).length,
      generiert_am:     new Date().toISOString(),
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      if (me) antwort.fahrer_single = me;
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
