import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1126 — Kombi-Tour-Vorschau API (Fahrer-App)
// Zeigt Stopps, die in einer nächsten Bündelungs-Tour zusammengefasst werden könnten

type KombiStopp = {
  order_id: string;
  adresse: string;
  zone: string;
  eta_min: number;
  items_count: number;
};

type ApiResponse = {
  stopps: KombiStopp[];
  gesamt_stopps: number;
  geschaetzte_tour_min: number;
  bündelungs_vorteil_min: number;
  location_id: string | null;
  generiert_am: string;
};

function mockData(driverId: string): ApiResponse {
  return {
    stopps: [
      { order_id: 'o1', adresse: 'Hauptstr. 12, 10115 Berlin', zone: 'A', eta_min: 8, items_count: 2 },
      { order_id: 'o2', adresse: 'Parkweg 5, 10117 Berlin',   zone: 'A', eta_min: 12, items_count: 1 },
      { order_id: 'o3', adresse: 'Bergstr. 22, 10119 Berlin', zone: 'A', eta_min: 18, items_count: 3 },
    ],
    gesamt_stopps: 3,
    geschaetzte_tour_min: 28,
    bündelungs_vorteil_min: 12,
    location_id: null,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!driverId) return NextResponse.json(mockData(''));

  try {
    const supabase = await createClient();

    const { data: driver, error: dErr } = await supabase
      .from('mise_drivers')
      .select('id, delivery_zone, location_id')
      .eq('id', driverId)
      .single();

    if (dErr || !driver) return NextResponse.json(mockData(driverId));

    const lid = locationId ?? (driver.location_id as string);
    const zone = driver.delivery_zone as string ?? 'A';

    // Pending orders in same zone not yet assigned
    const { data: orders, error: oErr } = await supabase
      .from('customer_orders')
      .select('id, delivery_address, delivery_zone, items, status, created_at')
      .eq('location_id', lid)
      .eq('delivery_zone', zone)
      .in('status', ['ready', 'fertig', 'dispatched'])
      .is('assigned_driver_id', null)
      .limit(5);

    if (oErr || !orders || orders.length === 0) return NextResponse.json(mockData(driverId));

    const stopps: KombiStopp[] = orders.map((o, i) => ({
      order_id: o.id as string,
      adresse: (o.delivery_address as string | null) ?? `Zone ${zone} Stopp ${i + 1}`,
      zone: (o.delivery_zone as string | null) ?? zone,
      eta_min: 8 + i * 6,
      items_count: Array.isArray(o.items) ? (o.items as unknown[]).length : 1,
    }));

    const geschaetzte_tour_min = 10 + stopps.length * 7;
    const einzel_tour_min = stopps.length * 18;

    return NextResponse.json({
      stopps,
      gesamt_stopps: stopps.length,
      geschaetzte_tour_min,
      bündelungs_vorteil_min: einzel_tour_min - geschaetzte_tour_min,
      location_id: lid,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
