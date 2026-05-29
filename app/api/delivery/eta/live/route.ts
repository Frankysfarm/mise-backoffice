/**
 * GET /api/delivery/eta/live?location_id=...
 * Gibt die aktuelle geschätzte Lieferzeit basierend auf Küchenauslastung zurück.
 * Öffentlich lesbar (service role, keine User-Auth erforderlich).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ eta_min: 35, load: 'normal' }, { headers: NO_CACHE });
  }

  try {
    const sb = createServiceClient();

    const [{ count: activeOrders }, { count: onlineDrivers }] = await Promise.all([
      sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
        .eq('typ', 'lieferung'),
      sb
        .from('mise_drivers')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']),
    ]);

    const active = activeOrders ?? 0;
    const drivers = Math.max(onlineDrivers ?? 1, 1);
    const ratio = active / drivers;

    let load: 'quiet' | 'normal' | 'busy';
    let etaMin: number;

    if (ratio <= 1) {
      load = 'quiet';
      etaMin = 25;
    } else if (ratio <= 3) {
      load = 'normal';
      etaMin = 35;
    } else {
      load = 'busy';
      etaMin = Math.min(60, 30 + Math.round(ratio * 4));
    }

    return NextResponse.json(
      { eta_min: etaMin, load, active_orders: active, drivers_online: drivers },
      { headers: NO_CACHE },
    );
  } catch {
    return NextResponse.json({ eta_min: 35, load: 'normal' }, { headers: NO_CACHE });
  }
}
