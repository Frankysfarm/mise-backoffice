/**
 * GET /api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=<uuid>
 *
 * Phase 1908 — Fahrer-Pünktlichkeits-Trend-API
 * Pünktlichkeit je Fahrer letzte 7 Tage als Zeitreihe.
 * Trend-Richtung (steigend/fallend/stabil).
 * Alert wenn >20% Rückgang gegenüber Vorwoche.
 * Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendRichtung = 'steigend' | 'fallend' | 'stabil';

interface TagWert {
  datum: string;
  puenktlichkeit_pct: number;
}

interface FahrerTrend {
  fahrer_id: string;
  name: string;
  zeitreihe: TagWert[];
  trend: TrendRichtung;
  aktuell_pct: number;
  vorwoche_pct: number;
  abweichung_pct: number;
  alert: boolean;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerTrend[];
  alert_count: number;
  generiert_am: string;
}

function trendRichtung(aktuell: number, vorwoche: number): TrendRichtung {
  const diff = aktuell - vorwoche;
  if (diff > 3) return 'steigend';
  if (diff < -3) return 'fallend';
  return 'stabil';
}

function datumLabel(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1',
      name: 'Max M.',
      zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
        datum: datumLabel(d),
        puenktlichkeit_pct: [82, 85, 88, 84, 90, 91, 93][6 - d],
      })),
      trend: 'steigend',
      aktuell_pct: 93,
      vorwoche_pct: 82,
      abweichung_pct: 13.4,
      alert: false,
    },
    {
      fahrer_id: 'f2',
      name: 'Sara K.',
      zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
        datum: datumLabel(d),
        puenktlichkeit_pct: [88, 82, 76, 70, 65, 62, 60][6 - d],
      })),
      trend: 'fallend',
      aktuell_pct: 60,
      vorwoche_pct: 88,
      abweichung_pct: -31.8,
      alert: true,
    },
    {
      fahrer_id: 'f3',
      name: 'Luca P.',
      zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
        datum: datumLabel(d),
        puenktlichkeit_pct: [75, 76, 74, 77, 75, 76, 75][6 - d],
      })),
      trend: 'stabil',
      aktuell_pct: 75,
      vorwoche_pct: 75,
      abweichung_pct: 0,
      alert: false,
    },
  ],
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) todayStart.setUTCDate(todayStart.getUTCDate() - 1);

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, driver_id, status, created_at, actual_delivery_time')
      .eq('location_id', locationId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('driver_id', 'is', null);

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, first_name, last_name')
      .eq('location_id', locationId);

    const driverNameMap = new Map<string, string>();
    for (const d of (drivers ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      const name = [d.first_name, d.last_name ? d.last_name[0] + '.' : ''].filter(Boolean).join(' ');
      driverNameMap.set(d.id, name || 'Fahrer');
    }

    type DayAcc = { ontime: number; gesamt: number };
    type DriverAcc = Map<string, DayAcc>;
    const driverDayMap = new Map<string, DriverAcc>();

    for (const o of orders as { driver_id: string | null; status: string; created_at: string; actual_delivery_time: string | null }[]) {
      if (!o.driver_id || o.status !== 'delivered' || !o.actual_delivery_time) continue;
      const dauer = (new Date(o.actual_delivery_time).getTime() - new Date(o.created_at).getTime()) / 60_000;
      if (dauer < 0 || dauer > 180) continue;

      const datum = o.created_at.slice(0, 10);
      let dayMap = driverDayMap.get(o.driver_id);
      if (!dayMap) { dayMap = new Map(); driverDayMap.set(o.driver_id, dayMap); }
      let acc = dayMap.get(datum);
      if (!acc) { acc = { ontime: 0, gesamt: 0 }; dayMap.set(datum, acc); }
      acc.gesamt++;
      if (dauer <= 30) acc.ontime++;
    }

    const tage = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const fahrerList: FahrerTrend[] = [];
    for (const [fahrerId, dayMap] of driverDayMap.entries()) {
      const zeitreihe: TagWert[] = tage.map((datum) => {
        const acc = dayMap.get(datum);
        const pct = acc && acc.gesamt > 0 ? Math.round((acc.ontime / acc.gesamt) * 100) : 0;
        return { datum, puenktlichkeit_pct: pct };
      });

      const aktuell = zeitreihe[6].puenktlichkeit_pct;
      const vorwoche = zeitreihe[0].puenktlichkeit_pct || aktuell;
      const abweichung = vorwoche > 0 ? Math.round(((aktuell - vorwoche) / vorwoche) * 1000) / 10 : 0;
      const alert = abweichung < -20;

      fahrerList.push({
        fahrer_id: fahrerId,
        name: driverNameMap.get(fahrerId) ?? 'Fahrer',
        zeitreihe,
        trend: trendRichtung(aktuell, vorwoche),
        aktuell_pct: aktuell,
        vorwoche_pct: vorwoche,
        abweichung_pct: abweichung,
        alert,
      });
    }

    fahrerList.sort((a, b) => b.aktuell_pct - a.aktuell_pct);

    if (fahrerList.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      alert_count: fahrerList.filter((f) => f.alert).length,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[fahrer-puenktlichkeit-trend]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
