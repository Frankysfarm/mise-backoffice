import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/driver-app/data?driver_id=...
 *
 * Fahrer-spezifische Bestellungen + Driver-Info.
 * Authentication via driver_id Query-Param + active=true check.
 * Wird vom /driver-Frontend aufgerufen.
 */
export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id Param fehlt' }, { status: 400 });
  }

  const svc = createServiceClient();

  // Driver-Info validieren
  const { data: driver } = await svc.from('mise_drivers')
    .select('id, name, phone, state, active, vehicle')
    .eq('id', driverId)
    .eq('active', true)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden / inaktiv' }, { status: 404 });
  }

  // Bestellungen für diesen Fahrer (zugewiesen oder verfügbar)
  const { data: orders } = await svc.from('customer_orders')
    .select('id, bestellnummer, typ, status, kunde_name, kunde_telefon, kunde_adresse, kunde_plz, kunde_stadt, kunde_lat, kunde_lng, kunde_notiz, gesamtbetrag, bestellt_am, location_id, mise_driver_id')
    .eq('typ', 'lieferung')
    .eq('mise_driver_id', driverId)
    .in('status', ['fertig', 'unterwegs'])
    .order('bestellt_am', { ascending: true });

  return NextResponse.json({
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      isOnline: driver.state !== 'offline',
      vehicleType: driver.vehicle ?? 'car',
    },
    orders: (orders ?? []).map(mapDriverOrder),
  });
}

function mapDriverOrder(o: any) {
  return {
    id: o.id,
    orderNumber: o.bestellnummer,
    restaurantName: 'Mise', // TODO: aus tenant ziehen
    restaurantAddress: '',
    customerName: o.kunde_name,
    customerAddress: `${o.kunde_adresse ?? ''}, ${o.kunde_plz ?? ''} ${o.kunde_stadt ?? ''}`.trim(),
    customerPhone: o.kunde_telefon ?? '',
    customerLat: o.kunde_lat ?? 50.7753,
    customerLng: o.kunde_lng ?? 6.0839,
    items: [],
    distance: '?',
    estimatedTime: '15 min',
    payout: Math.round(Number(o.gesamtbetrag) * 0.15 * 100) / 100,
    tip: 0,
    totalAmount: Number(o.gesamtbetrag),
    paymentMethod: 'card',
    status: o.status === 'unterwegs' ? 'delivering' : 'picked',
    createdAt: o.bestellt_am,
  };
}
