/**
 * GET /api/delivery/admin/zonen-effizienz-vergleich?location_id=<uuid>
 *
 * Phase 1507 - Zonen-Effizienz-Vergleich-API
 * Pünktlichkeit + Ø Lieferzeit + Bestellanzahl je Zone A/B/C/D heute vs. Vorwoche; Status je Zone.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZONEN = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONEN[number];

export interface ZonenEffizienzEintrag {
  zone: Zone;
  bestellungen_heute: number;
  bestellungen_vorwoche: number;
  puenktlichkeit_heute_pct: number;
  puenktlichkeit_vorwoche_pct: number;
  lieferzeit_heute_min: number;
  lieferzeit_vorwoche_min: number;
  trend_puenktlichkeit: 'besser' | 'gleich' | 'schlechter';
  trend_lieferzeit: 'besser' | 'gleich' | 'schlechter';
  status: 'gut' | 'normal' | 'kritisch';
}

export interface ZonenEffizienzVergleichResponse {
  zonen: ZonenEffizienzEintrag[];
  location_id: string;
  generiert_am: string;
}

function calcTrend(heute: number, vorwoche: number, hoeherIstBesser: boolean): 'besser' | 'gleich' | 'schlechter' {
  const diff = hoeherIstBesser ? heute - vorwoche : vorwoche - heute;
  if (diff > 3) return 'besser';
  if (diff < -3) return 'schlechter';
  return 'gleich';
}

function calcStatus(puenktlichkeit: number, lieferzeit: number): ZonenEffizienzEintrag['status'] {
  if (puenktlichkeit >= 80 && lieferzeit <= 40) return 'gut';
  if (puenktlichkeit < 60 || lieferzeit > 55) return 'kritisch';
  return 'normal';
}

function buildMock(locationId: string): ZonenEffizienzVergleichResponse {
  const mock: ZonenEffizienzEintrag[] = [
    { zone: 'A', bestellungen_heute: 42, bestellungen_vorwoche: 38, puenktlichkeit_heute_pct: 91, puenktlichkeit_vorwoche_pct: 87, lieferzeit_heute_min: 28, lieferzeit_vorwoche_min: 31, trend_puenktlichkeit: 'besser', trend_lieferzeit: 'besser', status: 'gut' },
    { zone: 'B', bestellungen_heute: 31, bestellungen_vorwoche: 35, puenktlichkeit_heute_pct: 78, puenktlichkeit_vorwoche_pct: 80, lieferzeit_heute_min: 36, lieferzeit_vorwoche_min: 34, trend_puenktlichkeit: 'gleich', trend_lieferzeit: 'gleich', status: 'normal' },
    { zone: 'C', bestellungen_heute: 19, bestellungen_vorwoche: 22, puenktlichkeit_heute_pct: 65, puenktlichkeit_vorwoche_pct: 71, lieferzeit_heute_min: 48, lieferzeit_vorwoche_min: 45, trend_puenktlichkeit: 'schlechter', trend_lieferzeit: 'schlechter', status: 'kritisch' },
    { zone: 'D', bestellungen_heute: 8, bestellungen_vorwoche: 10, puenktlichkeit_heute_pct: 82, puenktlichkeit_vorwoche_pct: 78, lieferzeit_heute_min: 55, lieferzeit_vorwoche_min: 60, trend_puenktlichkeit: 'besser', trend_lieferzeit: 'besser', status: 'normal' },
  ];
  return { zonen: mock, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const vorwocheStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    vorwocheStart.setHours(0, 0, 0, 0);
    const vorwocheEnde = new Date(vorwocheStart);
    vorwocheEnde.setHours(23, 59, 59, 999);

    const { data: tagesStopps } = await (sb as any)
      .from('mise_delivery_stops')
      .select('delivery_zone, geliefert_am, versucht_um, soll_zeit, batch_id')
      .gte('created_at', todayStart.toISOString())
      .not('geliefert_am', 'is', null);

    const { data: wocheStopps } = await (sb as any)
      .from('mise_delivery_stops')
      .select('delivery_zone, geliefert_am, versucht_um, soll_zeit, batch_id')
      .gte('created_at', vorwocheStart.toISOString())
      .lte('created_at', vorwocheEnde.toISOString())
      .not('geliefert_am', 'is', null);

    const { data: tagesOrders } = await (sb as any)
      .from('customer_orders')
      .select('delivery_zone')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: wocheOrders } = await (sb as any)
      .from('customer_orders')
      .select('delivery_zone')
      .eq('location_id', locationId)
      .gte('created_at', vorwocheStart.toISOString())
      .lte('created_at', vorwocheEnde.toISOString());

    const hasData =
      ((tagesStopps as unknown[]) ?? []).length > 0 ||
      ((tagesOrders as unknown[]) ?? []).length > 0;

    if (!hasData) {
      return NextResponse.json(buildMock(locationId));
    }

    type StoppRow = { delivery_zone?: string | null; geliefert_am?: string | null; versucht_um?: string | null; soll_zeit?: string | null };
    type OrderRow = { delivery_zone?: string | null };

    const SLA_MIN = 45;

    function lieferzeitMin(s: StoppRow): number | null {
      if (!s.geliefert_am) return null;
      if (s.versucht_um) {
        return (new Date(s.geliefert_am).getTime() - new Date(s.versucht_um).getTime()) / 60_000;
      }
      return null;
    }

    function isPuenktlich(s: StoppRow): boolean {
      if (!s.geliefert_am) return false;
      if (s.soll_zeit) {
        return new Date(s.geliefert_am).getTime() <= new Date(s.soll_zeit).getTime() + 2 * 60_000;
      }
      const lz = lieferzeitMin(s);
      return lz !== null ? lz <= SLA_MIN : true;
    }

    const zonen: ZonenEffizienzEintrag[] = ZONEN.map(zone => {
      const myTages = ((tagesStopps as StoppRow[]) ?? []).filter(s => (s.delivery_zone ?? 'A') === zone);
      const myWoche = ((wocheStopps as StoppRow[]) ?? []).filter(s => (s.delivery_zone ?? 'A') === zone);

      const ordersHeute = ((tagesOrders as OrderRow[]) ?? []).filter(o => (o.delivery_zone ?? 'A') === zone).length;
      const ordersVorwoche = ((wocheOrders as OrderRow[]) ?? []).filter(o => (o.delivery_zone ?? 'A') === zone).length;

      const puenktHeuteCount = myTages.filter(isPuenktlich).length;
      const puenktHeutePct = myTages.length > 0 ? Math.round((puenktHeuteCount / myTages.length) * 100) : 0;

      const puenktVorwocheCount = myWoche.filter(isPuenktlich).length;
      const puenktVorwochePct = myWoche.length > 0 ? Math.round((puenktVorwocheCount / myWoche.length) * 100) : 0;

      const lzHeuteArr = myTages.map(lieferzeitMin).filter((v): v is number => v !== null);
      const lzHeuteMean = lzHeuteArr.length > 0 ? Math.round(lzHeuteArr.reduce((a, b) => a + b, 0) / lzHeuteArr.length) : 0;

      const lzVorwocheArr = myWoche.map(lieferzeitMin).filter((v): v is number => v !== null);
      const lzVorwocheMean = lzVorwocheArr.length > 0 ? Math.round(lzVorwocheArr.reduce((a, b) => a + b, 0) / lzVorwocheArr.length) : 0;

      return {
        zone,
        bestellungen_heute: ordersHeute || myTages.length,
        bestellungen_vorwoche: ordersVorwoche || myWoche.length,
        puenktlichkeit_heute_pct: puenktHeutePct,
        puenktlichkeit_vorwoche_pct: puenktVorwochePct,
        lieferzeit_heute_min: lzHeuteMean,
        lieferzeit_vorwoche_min: lzVorwocheMean,
        trend_puenktlichkeit: calcTrend(puenktHeutePct, puenktVorwochePct, true),
        trend_lieferzeit: calcTrend(lzHeuteMean, lzVorwocheMean, false),
        status: calcStatus(puenktHeutePct, lzHeuteMean),
      };
    });

    return NextResponse.json({ zonen, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
