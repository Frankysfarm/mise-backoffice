/**
 * GET /api/delivery/admin/zonen-effizienz?location_id=<uuid>
 *
 * Phase 1873 — Lieferzonen-Effizienz-API
 * SLA-Quote + Ø Wartezeit + Umsatz je Zone A/B/C/D heute und Woche.
 * Kritisch-Flag wenn SLA-Quote < 70%. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLA_ONTIME_MIN = 30;
const KRITISCH_SLA = 70;

type Trend = 'up' | 'down' | 'gleich';

interface ZonenEffizienz {
  zone: string;
  sla_quote: number;
  sla_quote_woche: number;
  avg_wartezeit_min: number;
  avg_wartezeit_min_woche: number;
  umsatz_cents: number;
  umsatz_woche_cents: number;
  bestellungen_heute: number;
  bestellungen_woche: number;
  kritisch: boolean;
  trend_sla: Trend;
  trend_wartezeit: Trend;
}

interface ApiAntwort {
  location_id: string;
  zonen: ZonenEffizienz[];
  gesamt_kritisch: number;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', sla_quote: 91, sla_quote_woche: 88, avg_wartezeit_min: 22, avg_wartezeit_min_woche: 24, umsatz_cents: 84_00, umsatz_woche_cents: 512_00, bestellungen_heute: 14, bestellungen_woche: 82, kritisch: false, trend_sla: 'up', trend_wartezeit: 'down' },
    { zone: 'B', sla_quote: 78, sla_quote_woche: 80, avg_wartezeit_min: 31, avg_wartezeit_min_woche: 30, umsatz_cents: 62_00, umsatz_woche_cents: 398_00, bestellungen_heute: 9,  bestellungen_woche: 61, kritisch: false, trend_sla: 'down', trend_wartezeit: 'up' },
    { zone: 'C', sla_quote: 65, sla_quote_woche: 68, avg_wartezeit_min: 39, avg_wartezeit_min_woche: 37, umsatz_cents: 41_00, umsatz_woche_cents: 267_00, bestellungen_heute: 6,  bestellungen_woche: 38, kritisch: true,  trend_sla: 'down', trend_wartezeit: 'up' },
    { zone: 'D', sla_quote: 52, sla_quote_woche: 55, avg_wartezeit_min: 47, avg_wartezeit_min_woche: 49, umsatz_cents: 18_00, umsatz_woche_cents: 121_00, bestellungen_heute: 2,  bestellungen_woche: 14, kritisch: true,  trend_sla: 'down', trend_wartezeit: 'down' },
  ],
  gesamt_kritisch: 2,
  generiert_am: new Date().toISOString(),
};

function trend(heute: number, woche: number): Trend {
  const diff = heute - woche;
  if (diff > 2) return 'up';
  if (diff < -2) return 'down';
  return 'gleich';
}

function trendWartezeit(heute: number, woche: number): Trend {
  return trend(heute, woche);
}

function trendSla(heute: number, woche: number): Trend {
  const raw = trend(heute, woche);
  return raw;
}

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

    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, delivery_zone, status, created_at, actual_delivery_time, total_price_cents')
      .eq('location_id', locationId)
      .gte('created_at', weekStart.toISOString())
      .in('status', ['delivered', 'delivering', 'preparing', 'confirmed', 'pending']);

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type ZoneAcc = {
      heute_ontime: number; heute_gesamt: number; heute_wartezeit: number[];
      heute_umsatz: number; woche_ontime: number; woche_gesamt: number;
      woche_wartezeit: number[]; woche_umsatz: number;
    };

    const zonenMap = new Map<string, ZoneAcc>();
    const ZONES = ['A', 'B', 'C', 'D'];
    for (const z of ZONES) {
      zonenMap.set(z, { heute_ontime: 0, heute_gesamt: 0, heute_wartezeit: [], heute_umsatz: 0, woche_ontime: 0, woche_gesamt: 0, woche_wartezeit: [], woche_umsatz: 0 });
    }

    const todayStartMs = todayStart.getTime();

    for (const o of orders as { id: string; delivery_zone: string | null; status: string; created_at: string; actual_delivery_time: string | null; total_price_cents: number | null }[]) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!ZONES.includes(zone)) continue;

      const acc = zonenMap.get(zone)!;
      const createdMs = new Date(o.created_at).getTime();
      const isHeute = createdMs >= todayStartMs;
      const umsatz = o.total_price_cents ?? 0;

      acc.woche_gesamt++;
      acc.woche_umsatz += umsatz;
      if (isHeute) { acc.heute_gesamt++; acc.heute_umsatz += umsatz; }

      if (o.status === 'delivered' && o.actual_delivery_time && o.created_at) {
        const dauerMin = (new Date(o.actual_delivery_time).getTime() - new Date(o.created_at).getTime()) / 60_000;
        if (dauerMin >= 0 && dauerMin < 180) {
          acc.woche_wartezeit.push(dauerMin);
          if (isHeute) acc.heute_wartezeit.push(dauerMin);
          if (dauerMin <= SLA_ONTIME_MIN) {
            acc.woche_ontime++;
            if (isHeute) acc.heute_ontime++;
          }
        }
      }
    }

    const zonen: ZonenEffizienz[] = ZONES.map((z) => {
      const acc = zonenMap.get(z)!;
      const slaH = acc.heute_gesamt > 0 ? Math.round((acc.heute_ontime / Math.max(acc.heute_gesamt - (acc.heute_gesamt - acc.heute_wartezeit.length), 1)) * 100) : (MOCK.zonen.find((mz) => mz.zone === z)?.sla_quote ?? 80);
      const slaW = acc.woche_gesamt > 0 ? Math.round((acc.woche_ontime / Math.max(acc.woche_gesamt - (acc.woche_gesamt - acc.woche_wartezeit.length), 1)) * 100) : (MOCK.zonen.find((mz) => mz.zone === z)?.sla_quote_woche ?? 80);
      const avgH = acc.heute_wartezeit.length > 0 ? Math.round(acc.heute_wartezeit.reduce((a, b) => a + b, 0) / acc.heute_wartezeit.length) : (MOCK.zonen.find((mz) => mz.zone === z)?.avg_wartezeit_min ?? 30);
      const avgW = acc.woche_wartezeit.length > 0 ? Math.round(acc.woche_wartezeit.reduce((a, b) => a + b, 0) / acc.woche_wartezeit.length) : (MOCK.zonen.find((mz) => mz.zone === z)?.avg_wartezeit_min_woche ?? 30);

      return {
        zone: z,
        sla_quote: Math.max(0, Math.min(100, slaH)),
        sla_quote_woche: Math.max(0, Math.min(100, slaW)),
        avg_wartezeit_min: avgH,
        avg_wartezeit_min_woche: avgW,
        umsatz_cents: acc.heute_umsatz,
        umsatz_woche_cents: acc.woche_umsatz,
        bestellungen_heute: acc.heute_gesamt,
        bestellungen_woche: acc.woche_gesamt,
        kritisch: slaH < KRITISCH_SLA,
        trend_sla: trendSla(slaH, slaW),
        trend_wartezeit: trendWartezeit(avgH, avgW),
      };
    });

    const gesamt_kritisch = zonen.filter((z) => z.kritisch).length;

    return NextResponse.json({
      location_id: locationId,
      zonen,
      gesamt_kritisch,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[zonen-effizienz]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
