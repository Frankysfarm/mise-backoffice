/**
 * GET /api/delivery/admin/fahrer-zonen-rangliste?location_id=<uuid>
 *
 * Phase 1878 — Fahrer-Zonen-Rangliste-API
 * Top-Fahrer je Zone A/B/C/D nach Pünktlichkeit + Stopps heute.
 * Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Trend = 'up' | 'down' | 'gleich';

interface FahrerZonenEintrag {
  fahrer_id: string;
  name: string;
  stopps_heute: number;
  puenktlichkeit_pct: number;
  trend: Trend;
  rang: number;
}

interface ZonenRangliste {
  zone: string;
  top_fahrer: FahrerZonenEintrag[];
}

interface ApiAntwort {
  location_id: string;
  zonen: ZonenRangliste[];
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    {
      zone: 'A',
      top_fahrer: [
        { fahrer_id: 'f1', name: 'Max M.', stopps_heute: 12, puenktlichkeit_pct: 94, trend: 'up', rang: 1 },
        { fahrer_id: 'f2', name: 'Sara K.', stopps_heute: 10, puenktlichkeit_pct: 88, trend: 'gleich', rang: 2 },
        { fahrer_id: 'f3', name: 'Tim S.', stopps_heute: 8, puenktlichkeit_pct: 82, trend: 'down', rang: 3 },
      ],
    },
    {
      zone: 'B',
      top_fahrer: [
        { fahrer_id: 'f4', name: 'Ana P.', stopps_heute: 9, puenktlichkeit_pct: 91, trend: 'up', rang: 1 },
        { fahrer_id: 'f5', name: 'Leon B.', stopps_heute: 7, puenktlichkeit_pct: 85, trend: 'gleich', rang: 2 },
        { fahrer_id: 'f6', name: 'Mia H.', stopps_heute: 5, puenktlichkeit_pct: 76, trend: 'down', rang: 3 },
      ],
    },
    {
      zone: 'C',
      top_fahrer: [
        { fahrer_id: 'f7', name: 'Noah F.', stopps_heute: 6, puenktlichkeit_pct: 87, trend: 'up', rang: 1 },
        { fahrer_id: 'f8', name: 'Lena W.', stopps_heute: 4, puenktlichkeit_pct: 79, trend: 'gleich', rang: 2 },
        { fahrer_id: 'f3', name: 'Tim S.', stopps_heute: 3, puenktlichkeit_pct: 72, trend: 'down', rang: 3 },
      ],
    },
    {
      zone: 'D',
      top_fahrer: [
        { fahrer_id: 'f9', name: 'Jan V.', stopps_heute: 4, puenktlichkeit_pct: 83, trend: 'gleich', rang: 1 },
        { fahrer_id: 'f2', name: 'Sara K.', stopps_heute: 3, puenktlichkeit_pct: 78, trend: 'down', rang: 2 },
        { fahrer_id: 'f1', name: 'Max M.', stopps_heute: 2, puenktlichkeit_pct: 70, trend: 'gleich', rang: 3 },
      ],
    },
  ],
  generiert_am: new Date().toISOString(),
};

const ZONES = ['A', 'B', 'C', 'D'] as const;

function calcTrend(heute: number, woche_avg: number): Trend {
  const diff = heute - woche_avg;
  if (diff > 3) return 'up';
  if (diff < -3) return 'down';
  return 'gleich';
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
      .select('id, delivery_zone, driver_id, status, created_at, actual_delivery_time')
      .eq('location_id', locationId)
      .gte('created_at', weekStart.toISOString())
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

    type DriverZoneAcc = {
      stopps_heute: number;
      ontime_heute: number;
      gesamt_heute: number;
      stopps_woche: number;
      ontime_woche: number;
      gesamt_woche: number;
    };

    const accMap = new Map<string, Map<string, DriverZoneAcc>>();

    const todayStartMs = todayStart.getTime();

    for (const o of orders as { id: string; delivery_zone: string | null; driver_id: string | null; status: string; created_at: string; actual_delivery_time: string | null }[]) {
      if (!o.driver_id) continue;
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!ZONES.includes(zone as typeof ZONES[number])) continue;

      const isHeute = new Date(o.created_at).getTime() >= todayStartMs;
      let zoneMap = accMap.get(zone);
      if (!zoneMap) { zoneMap = new Map(); accMap.set(zone, zoneMap); }

      let acc = zoneMap.get(o.driver_id);
      if (!acc) {
        acc = { stopps_heute: 0, ontime_heute: 0, gesamt_heute: 0, stopps_woche: 0, ontime_woche: 0, gesamt_woche: 0 };
        zoneMap.set(o.driver_id, acc);
      }

      acc.stopps_woche++;
      if (isHeute) acc.stopps_heute++;

      if (o.status === 'delivered' && o.actual_delivery_time) {
        const dauerMin = (new Date(o.actual_delivery_time).getTime() - new Date(o.created_at).getTime()) / 60_000;
        if (dauerMin >= 0 && dauerMin < 180) {
          acc.gesamt_woche++;
          if (isHeute) acc.gesamt_heute++;
          if (dauerMin <= 30) {
            acc.ontime_woche++;
            if (isHeute) acc.ontime_heute++;
          }
        }
      }
    }

    const zonen: ZonenRangliste[] = ZONES.map((zone) => {
      const zoneMap = accMap.get(zone) ?? new Map<string, DriverZoneAcc>();
      const top_fahrer: FahrerZonenEintrag[] = [...zoneMap.entries()]
        .map(([fahrer_id, acc]) => {
          const puenktH = acc.gesamt_heute > 0 ? Math.round((acc.ontime_heute / acc.gesamt_heute) * 100) : 0;
          const puenktW = acc.gesamt_woche > 0 ? Math.round((acc.ontime_woche / acc.gesamt_woche) * 100) : 0;
          return {
            fahrer_id,
            name: driverNameMap.get(fahrer_id) ?? 'Fahrer',
            stopps_heute: acc.stopps_heute,
            puenktlichkeit_pct: puenktH > 0 ? puenktH : puenktW,
            trend: calcTrend(puenktH, puenktW),
            rang: 0,
          };
        })
        .filter((f) => f.stopps_heute > 0 || f.puenktlichkeit_pct > 0)
        .sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct || b.stopps_heute - a.stopps_heute)
        .slice(0, 3)
        .map((f, idx) => ({ ...f, rang: idx + 1 }));

      return {
        zone,
        top_fahrer: top_fahrer.length > 0
          ? top_fahrer
          : (MOCK.zonen.find((mz) => mz.zone === zone)?.top_fahrer ?? []),
      };
    });

    return NextResponse.json({
      location_id: locationId,
      zonen,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[fahrer-zonen-rangliste]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
