/**
 * GET /api/delivery/admin/fahrer-schicht-erloes?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2604 — Fahrer-Schicht-Erlös
 * Erlös (Bestellwert) je Fahrer heute in €; Ampel grün(≥200 €)/gelb(100–199 €)/rot(<100 €);
 * Alert <100 €; Trend vs. gestern; driver_id-Modus; Multi-Tenant;
 * Supabase(orders.total_amount via delivery_tours)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZIEL_EUR   = 200;
const ALERT_EUR  = 100;
const GRUEN_EUR  = 200;
const GELB_EUR   = 100;

export type AmpelErloes = 'gruen' | 'gelb' | 'rot';
export type TrendErloes = 'besser' | 'schlechter' | 'stabil';

export interface FahrerSchichtErloesEntry {
  fahrer_id: string;
  fahrer_name: string;
  erloes_heute: number;
  erloes_gestern: number | null;
  trend: TrendErloes;
  trend_delta: number;
  ampel: AmpelErloes;
  alert: boolean;
}

export interface FahrerSchichtErloesAntwort {
  location_id: string;
  fahrer: FahrerSchichtErloesEntry[];
  fahrer_single?: FahrerSchichtErloesEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(erloes: number): AmpelErloes {
  if (erloes >= GRUEN_EUR) return 'gruen';
  if (erloes >= GELB_EUR)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendErloes; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 100) / 100;
  if (delta >= 10)  return { trend: 'besser',     delta };
  if (delta <= -10) return { trend: 'schlechter', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerSchichtErloesEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     erloes_heute: 248.50, erloes_gestern: 211.20, trend: 'besser',     trend_delta: 37.30,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    erloes_heute: 78.30,  erloes_gestern: 165.40, trend: 'schlechter', trend_delta: -87.10, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', erloes_heute: 142.60, erloes_gestern: 138.90, trend: 'stabil',     trend_delta: 3.70,   ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     erloes_heute: 215.80, erloes_gestern: 229.10, trend: 'stabil',     trend_delta: -13.30, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   erloes_heute: 62.40,  erloes_gestern: 183.70, trend: 'schlechter', trend_delta: -121.30,ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerSchichtErloesAntwort {
  const alertCount  = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg     = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.erloes_heute,            0) / MOCK_FAHRER.length * 100) / 100;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.erloes_gestern ?? 0),   0) / MOCK_FAHRER.length * 100) / 100;
  const base: FahrerSchichtErloesAntwort = {
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

    // delivery_tours joins orders via order_id to get total_amount
    const [{ data: todayData }, { data: yesterdayData }, { data: employeesData }] = await Promise.all([
      sb.from('delivery_tours')
        .select('driver_id, orders(total_amount)')
        .eq('location_id', locationId)
        .gte('started_at', todayStart.toISOString())
        .lt('started_at', todayEnd.toISOString()),
      sb.from('delivery_tours')
        .select('driver_id, orders(total_amount)')
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

    function sumErloes(tours: { driver_id: string; orders: { total_amount: number } | { total_amount: number }[] | null }[]): Map<string, number> {
      const m = new Map<string, number>();
      for (const t of tours) {
        const amount = Array.isArray(t.orders)
          ? t.orders.reduce((s: number, o: { total_amount: number }) => s + (o.total_amount ?? 0), 0)
          : (t.orders as { total_amount: number } | null)?.total_amount ?? 0;
        m.set(t.driver_id, (m.get(t.driver_id) ?? 0) + amount);
      }
      return m;
    }

    const todayMap     = sumErloes(todayData as { driver_id: string; orders: { total_amount: number } | { total_amount: number }[] | null }[]);
    const yesterdayMap = sumErloes((yesterdayData ?? []) as { driver_id: string; orders: { total_amount: number } | { total_amount: number }[] | null }[]);

    const fahrer: FahrerSchichtErloesEntry[] = Array.from(todayMap.entries()).map(([id, erloesHeute]) => {
      const erloesGestern = yesterdayMap.has(id) ? yesterdayMap.get(id)! : null;
      const { trend, delta } = trendVon(erloesHeute, erloesGestern);
      return {
        fahrer_id:     id,
        fahrer_name:   nameMap.get(id) ?? 'Fahrer',
        erloes_heute:  Math.round(erloesHeute  * 100) / 100,
        erloes_gestern: erloesGestern !== null ? Math.round(erloesGestern * 100) / 100 : null,
        trend,
        trend_delta:   delta,
        ampel:         ampelVon(erloesHeute),
        alert:         erloesHeute < ALERT_EUR,
      };
    });

    const teamAvg     = fahrer.length ? Math.round(fahrer.reduce((s, f) => s + f.erloes_heute,              0) / fahrer.length * 100) / 100 : 0;
    const gFahrer     = fahrer.filter(f => f.erloes_gestern !== null);
    const teamGestern = gFahrer.length ? Math.round(gFahrer.reduce((s, f) => s + (f.erloes_gestern ?? 0),   0) / gFahrer.length * 100) / 100 : null;

    const antwort: FahrerSchichtErloesAntwort = {
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
