/**
 * GET /api/delivery/admin/overview?location_id=...
 *
 * Aggregiertes Admin-Dashboard: Alle Live-Daten in einem Request.
 * Vermeidet Wasserfälle im Frontend.
 *
 * Response:
 * {
 *   active_tours:           Tour[]
 *   drivers:                DriverSummary[]
 *   today_stats:            Stats
 *   zone_counts:            Record<string,number>
 *   totalOrders:            number          — für SchichtDeltaVergleich
 *   totalRevenue:           number
 *   slaRate:                number          — 0–100
 *   avgDeliveryMin:         number
 *   yesterdayOrders:        number | null   — gleiche Stundenspanne Vortag
 *   yesterdayRevenue:       number | null
 *   yesterdaySlaRate:       number | null
 *   yesterdayAvgDeliveryMin: number | null
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  status: string | null;
  delivery_zone: string | null;
  dispatch_score: number | null;
  created_at: string;
  gesamtbetrag: number | null;
  geliefert_am: string | null;
  eta_latest: string | null;
  dispatched_at: string | null;
};

function computeKpis(orders: OrderRow[]) {
  const delivered = orders.filter((o) =>
    ['abgeschlossen', 'geliefert'].includes(o.status ?? ''),
  );

  const totalRevenue = orders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

  const slaOrders = delivered.filter(
    (o) => o.geliefert_am != null && o.eta_latest != null,
  );
  const slaOnTime = slaOrders.filter(
    (o) => new Date(o.geliefert_am!).getTime() <= new Date(o.eta_latest!).getTime(),
  );
  const slaRate = slaOrders.length > 0 ? (slaOnTime.length / slaOrders.length) * 100 : 0;

  const deliveryMins = delivered
    .filter((o) => o.geliefert_am != null && o.dispatched_at != null)
    .map((o) =>
      (new Date(o.geliefert_am!).getTime() - new Date(o.dispatched_at!).getTime()) / 60_000,
    )
    .filter((m) => m > 0 && m < 180);
  const avgDeliveryMin =
    deliveryMins.length > 0
      ? deliveryMins.reduce((s, v) => s + v, 0) / deliveryMins.length
      : 0;

  return { totalRevenue, slaRate, avgDeliveryMin };
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Yesterday same-hour window: midnight yesterday → same clock time yesterday
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const yesterdayUntil = new Date(now.getTime() - 86_400_000);

  const ORDER_SELECT =
    'id, status, delivery_zone, dispatch_score, created_at, gesamtbetrag, geliefert_am, eta_latest, dispatched_at';

  const [toursRes, driversRes, ordersRes, yesterdayRes] = await Promise.all([
    sb
      .from('mise_delivery_batches')
      .select('id, state, zone, dispatch_score, stop_count, total_distance_km, total_eta_min, created_at, driver:mise_drivers(id,name,vehicle,state)')
      .eq('location_id', locationId)
      .not('state', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(30),

    sb
      .from('mise_drivers')
      .select('id, name, vehicle, state, active, current_capacity, max_capacity, last_position_at')
      .eq('active', true)
      .order('state'),

    sb
      .from('customer_orders')
      .select(ORDER_SELECT)
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', todayStart.toISOString()),

    sb
      .from('customer_orders')
      .select(ORDER_SELECT)
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', yesterdayUntil.toISOString()),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const yesterdayOrders = (yesterdayRes.data ?? []) as OrderRow[];

  const zoneCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const z = o.delivery_zone ?? 'unknown';
    acc[z] = (acc[z] ?? 0) + 1;
    return acc;
  }, {});

  const driversOnline = (driversRes.data ?? []).filter(
    (d) => d.state !== 'offline',
  ).length;

  const todayKpis = computeKpis(orders);
  const yestKpis = computeKpis(yesterdayOrders);

  return NextResponse.json({
    active_tours: toursRes.data ?? [],
    drivers: driversRes.data ?? [],
    today_stats: {
      total_orders:   orders.length,
      dispatched:     orders.filter((o) => o.dispatch_score != null).length,
      delivered:      orders.filter((o) => ['abgeschlossen', 'geliefert'].includes(o.status ?? '')).length,
      pending:        orders.filter((o) => ['neu', 'in_zubereitung'].includes(o.status ?? '')).length,
      drivers_online: driversOnline,
    },
    zone_counts: zoneCounts,
    // Flat fields for SchichtDeltaVergleich (today)
    totalOrders:            orders.length,
    totalRevenue:           Math.round(todayKpis.totalRevenue * 100) / 100,
    slaRate:                Math.round(todayKpis.slaRate * 10) / 10,
    avgDeliveryMin:         Math.round(todayKpis.avgDeliveryMin * 10) / 10,
    // Yesterday same-hour (null wenn keine Daten)
    yesterdayOrders:        yesterdayOrders.length > 0 ? yesterdayOrders.length : null,
    yesterdayRevenue:       yesterdayOrders.length > 0 ? Math.round(yestKpis.totalRevenue * 100) / 100 : null,
    yesterdaySlaRate:       yesterdayOrders.length > 0 ? Math.round(yestKpis.slaRate * 10) / 10 : null,
    yesterdayAvgDeliveryMin: yesterdayOrders.length > 0 ? Math.round(yestKpis.avgDeliveryMin * 10) / 10 : null,
  });
}
