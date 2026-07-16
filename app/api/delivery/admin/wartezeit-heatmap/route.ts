import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 1871 — Wartezeit-Heatmap-API
 * GET /api/delivery/admin/wartezeit-heatmap?location_id=<uuid>
 *
 * Ø Wartezeit (delivered_at − created_at) je Zone A/B/C/D, letzte 7 Tage.
 * Trend: Heute vs. Wochen-Ø (delta_min + richtung up/down/gleich).
 * Multi-Tenant; Supabase + Mock-Fallback.
 */

type Trend = 'up' | 'down' | 'gleich';

interface ZoneWartezeit {
  zone: string;
  avg_wartezeit_min: number;
  heute_avg_min: number;
  trend: Trend;
  delta_min: number;
  bestellungen_woche: number;
  bestellungen_heute: number;
}

interface WartezeitHeatmapAntwort {
  location_id: string;
  zonen: ZoneWartezeit[];
  generiert_am: string;
}

function trendRichtung(delta: number): Trend {
  if (delta > 1) return 'up';
  if (delta < -1) return 'down';
  return 'gleich';
}

const MOCK: WartezeitHeatmapAntwort = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', avg_wartezeit_min: 22, heute_avg_min: 20, trend: 'down', delta_min: -2, bestellungen_woche: 84, bestellungen_heute: 12 },
    { zone: 'B', avg_wartezeit_min: 31, heute_avg_min: 35, trend: 'up',   delta_min: 4,  bestellungen_woche: 62, bestellungen_heute: 9  },
    { zone: 'C', avg_wartezeit_min: 38, heute_avg_min: 38, trend: 'gleich', delta_min: 0, bestellungen_woche: 41, bestellungen_heute: 6 },
    { zone: 'D', avg_wartezeit_min: 45, heute_avg_min: 48, trend: 'up',   delta_min: 3,  bestellungen_woche: 18, bestellungen_heute: 2 },
  ],
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString();

    const { data: orders, error } = await sb
      .from('customer_orders')
      .select('created_at, delivered_at, delivery_zone')
      .eq('location_id', locationId)
      .gte('created_at', sevenDaysAgo)
      .not('delivered_at', 'is', null);

    if (error || !orders || orders.length < 5) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type ZoneBucket = { sumWoche: number; countWoche: number; sumHeute: number; countHeute: number };
    const buckets: Record<string, ZoneBucket> = {};

    for (const o of orders as { created_at: string; delivered_at: string; delivery_zone: string | null }[]) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!buckets[zone]) buckets[zone] = { sumWoche: 0, countWoche: 0, sumHeute: 0, countHeute: 0 };
      const min = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
      if (min <= 0 || min > 180) continue;
      buckets[zone].sumWoche += min;
      buckets[zone].countWoche++;
      if (o.created_at >= todayStartStr) {
        buckets[zone].sumHeute += min;
        buckets[zone].countHeute++;
      }
    }

    const ZONES = ['A', 'B', 'C', 'D'];
    const zonen: ZoneWartezeit[] = ZONES.map((z) => {
      const b = buckets[z];
      if (!b || b.countWoche === 0) {
        const mock = MOCK.zonen.find((m) => m.zone === z)!;
        return { ...mock, zone: z };
      }
      const avgWoche = parseFloat((b.sumWoche / b.countWoche).toFixed(1));
      const avgHeute = b.countHeute > 0 ? parseFloat((b.sumHeute / b.countHeute).toFixed(1)) : avgWoche;
      const delta = parseFloat((avgHeute - avgWoche).toFixed(1));
      return {
        zone: z,
        avg_wartezeit_min: avgWoche,
        heute_avg_min: avgHeute,
        trend: trendRichtung(delta),
        delta_min: delta,
        bestellungen_woche: b.countWoche,
        bestellungen_heute: b.countHeute,
      };
    });

    const body: WartezeitHeatmapAntwort = {
      location_id: locationId,
      zonen,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
