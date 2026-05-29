/**
 * GET /api/delivery/admin/overview?location_id=...
 *
 * Aggregiertes Admin-Dashboard: Alle Live-Daten in einem Request.
 * Vermeidet Wasserfälle im Frontend.
 *
 * Response:
 * {
 *   active_tours:  Tour[]       — laufende Batches
 *   drivers:       DriverSummary[]
 *   today_stats:   Stats
 *   zone_counts:   Record<string,number>
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Parallel: aktive Touren + Fahrer + heutige Bestellungen
  const [toursRes, driversRes, ordersRes] = await Promise.all([
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
      .select('id, status, delivery_zone, dispatch_score, created_at')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', todayIso),
  ]);

  const orders = ordersRes.data ?? [];
  const zoneCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const z = (o.delivery_zone as string) ?? 'unknown';
    acc[z] = (acc[z] ?? 0) + 1;
    return acc;
  }, {});

  const driversOnline = (driversRes.data ?? []).filter(
    (d) => d.state === 'online' || d.state === 'auf_tour',
  ).length;

  return NextResponse.json({
    active_tours: toursRes.data ?? [],
    drivers: driversRes.data ?? [],
    today_stats: {
      total_orders:    orders.length,
      dispatched:      orders.filter((o) => o.dispatch_score != null).length,
      delivered:       orders.filter((o) => ['abgeschlossen', 'geliefert'].includes(o.status as string)).length,
      pending:         orders.filter((o) => ['neu', 'in_zubereitung'].includes(o.status as string)).length,
      drivers_online:  driversOnline,
    },
    zone_counts: zoneCounts,
  });
}
