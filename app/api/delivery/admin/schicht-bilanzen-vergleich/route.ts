import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1175 — Schicht-Bilanzen-Vergleichs-API
// Aktuelle Schicht vs. gleicher Wochentag der letzten 4 Wochen

export const dynamic = 'force-dynamic';

type WochenTag = { datum: string; stopps: number; umsatz_eur: number; puenktlichkeit_pct: number; fahrer_anzahl: number };

type ApiResponse = {
  wochentag: string;
  aktuell: WochenTag;
  verlauf: WochenTag[];
  ø_stopps: number;
  ø_umsatz_eur: number;
  ø_puenktlichkeit_pct: number;
  trend_stopps: 'besser' | 'gleich' | 'schlechter';
  trend_umsatz: 'besser' | 'gleich' | 'schlechter';
  location_id: string;
  generiert_am: string;
};

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function trend(aktuell: number, avg: number): 'besser' | 'gleich' | 'schlechter' {
  if (aktuell > avg * 1.05) return 'besser';
  if (aktuell < avg * 0.95) return 'schlechter';
  return 'gleich';
}

const NOW = new Date();
const TODAY_STR = NOW.toISOString().slice(0, 10);
const WOCHENTAG_STR = WOCHENTAGE[NOW.getDay()];

const MOCK: ApiResponse = {
  wochentag: WOCHENTAG_STR,
  aktuell: { datum: TODAY_STR, stopps: 31, umsatz_eur: 412, puenktlichkeit_pct: 87, fahrer_anzahl: 4 },
  verlauf: [
    { datum: new Date(NOW.getTime() - 7 * 86400_000).toISOString().slice(0, 10), stopps: 28, umsatz_eur: 374, puenktlichkeit_pct: 82, fahrer_anzahl: 3 },
    { datum: new Date(NOW.getTime() - 14 * 86400_000).toISOString().slice(0, 10), stopps: 33, umsatz_eur: 445, puenktlichkeit_pct: 91, fahrer_anzahl: 4 },
    { datum: new Date(NOW.getTime() - 21 * 86400_000).toISOString().slice(0, 10), stopps: 25, umsatz_eur: 341, puenktlichkeit_pct: 78, fahrer_anzahl: 3 },
    { datum: new Date(NOW.getTime() - 28 * 86400_000).toISOString().slice(0, 10), stopps: 29, umsatz_eur: 388, puenktlichkeit_pct: 84, fahrer_anzahl: 4 },
  ],
  ø_stopps: 28.75,
  ø_umsatz_eur: 387,
  ø_puenktlichkeit_pct: 83.75,
  trend_stopps: 'besser',
  trend_umsatz: 'besser',
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const location_id = req.nextUrl.searchParams.get('location_id');
  if (!location_id) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    // Build date ranges for same weekday over last 4 weeks
    const pastDates = [1, 2, 3, 4].map(w => {
      const d = new Date(todayStart.getTime() - w * 7 * 86400_000);
      const dEnd = new Date(d.getTime() + 86400_000);
      return { start: d.toISOString(), end: dEnd.toISOString() };
    });

    // Current shift data
    const { data: currentStops } = await supabase
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at, estimated_delivery_at, order_id')
      .gte('delivered_at', todayStart.toISOString())
      .eq('location_id', location_id);

    const { data: currentOrders } = await supabase
      .from('customer_orders')
      .select('gesamtbetrag')
      .gte('bestellt_am', todayStart.toISOString())
      .eq('location_id', location_id)
      .eq('status', 'geliefert');

    const { data: activeDrivers } = await supabase
      .from('mise_drivers')
      .select('id')
      .eq('location_id', location_id)
      .eq('online', true);

    function calcDay(stops: typeof currentStops, orders: typeof currentOrders, driverCount: number, dateStr: string): WochenTag {
      const s = stops ?? [];
      const o = orders ?? [];
      const pünktlich = s.filter(x => x.delivered_at && x.estimated_delivery_at && new Date(x.delivered_at) <= new Date(x.estimated_delivery_at)).length;
      return {
        datum: dateStr,
        stopps: s.length,
        umsatz_eur: o.reduce((acc, x) => acc + (x.gesamtbetrag ?? 0), 0),
        puenktlichkeit_pct: s.length ? Math.round((pünktlich / s.length) * 100) : 0,
        fahrer_anzahl: driverCount,
      };
    }

    const aktuell = calcDay(currentStops, currentOrders, (activeDrivers ?? []).length, todayStart.toISOString().slice(0, 10));

    // Past weeks
    const verlaufResults = await Promise.all(
      pastDates.map(async ({ start, end }) => {
        const [{ data: pStops }, { data: pOrders }] = await Promise.all([
          supabase.from('mise_delivery_stops').select('driver_id, order_id, delivered_at, estimated_delivery_at').gte('delivered_at', start).lt('delivered_at', end).eq('location_id', location_id),
          supabase.from('customer_orders').select('gesamtbetrag').gte('bestellt_am', start).lt('bestellt_am', end).eq('location_id', location_id).eq('status', 'geliefert'),
        ]);
        const uniqDrivers = new Set((pStops ?? []).map(s => s.driver_id)).size;
        return calcDay(pStops, pOrders, uniqDrivers, start.slice(0, 10));
      }),
    );

    const verlauf = verlaufResults;
    const ø_stopps = verlauf.reduce((a, v) => a + v.stopps, 0) / Math.max(1, verlauf.length);
    const ø_umsatz = verlauf.reduce((a, v) => a + v.umsatz_eur, 0) / Math.max(1, verlauf.length);
    const ø_puenktlichkeit = verlauf.reduce((a, v) => a + v.puenktlichkeit_pct, 0) / Math.max(1, verlauf.length);

    const response: ApiResponse = {
      wochentag: WOCHENTAGE[dayOfWeek],
      aktuell,
      verlauf,
      ø_stopps: Math.round(ø_stopps * 10) / 10,
      ø_umsatz_eur: Math.round(ø_umsatz),
      ø_puenktlichkeit_pct: Math.round(ø_puenktlichkeit),
      trend_stopps: trend(aktuell.stopps, ø_stopps),
      trend_umsatz: trend(aktuell.umsatz_eur, ø_umsatz),
      location_id,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...MOCK, location_id });
  }
}
