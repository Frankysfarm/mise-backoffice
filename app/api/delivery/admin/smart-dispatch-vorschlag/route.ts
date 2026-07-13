import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');

  try {
    const supabase = await createClient();

    let qDrivers = supabase
      .from('mise_drivers')
      .select('id, first_name, last_name, is_online, current_zone, vehicle_type')
      .eq('is_online', true);
    if (locationId) qDrivers = qDrivers.eq('location_id', locationId);

    let qOrders = supabase
      .from('customer_orders')
      .select('id, bestellnummer, status, delivery_zone, created_at, eta_minutes')
      .in('status', ['confirmed', 'ready', 'bereit', 'bestätigt'])
      .is('driver_id', null);
    if (locationId) qOrders = qOrders.eq('location_id', locationId);

    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    let qPerf = supabase
      .from('customer_orders')
      .select('driver_id, status, created_at, delivered_at, eta_minutes, driver_rating')
      .gte('created_at', startOfDay)
      .eq('status', 'delivered');
    if (locationId) qPerf = qPerf.eq('location_id', locationId);

    const [driversRes, ordersRes, perfRes] = await Promise.all([qDrivers, qOrders, qPerf]);
    const drivers = driversRes.data ?? [];
    const pendingOrders = ordersRes.data ?? [];
    const perfOrders = perfRes.data ?? [];

    if (pendingOrders.length === 0 || drivers.length === 0) {
      return NextResponse.json({ vorschlaege: [], timestamp: new Date().toISOString() });
    }

    const order = pendingOrders[0];

    const vorschlaege = drivers.map(d => {
      const myPerf = perfOrders.filter(o => o.driver_id === d.id);
      const withRating = myPerf.filter(o => o.driver_rating);
      const avgRating = withRating.length > 0
        ? withRating.reduce((s, o) => s + Number(o.driver_rating), 0) / withRating.length
        : 4.0;

      const withEta = myPerf.filter(o => o.eta_minutes && o.delivered_at);
      const puenktlichkeit = withEta.length > 0
        ? withEta.filter(o => {
          const actualMin = (new Date(o.delivered_at!).getTime() - new Date(o.created_at!).getTime()) / 60000;
          return actualMin <= (o.eta_minutes ?? 30);
        }).length / withEta.length
        : 0.8;

      const sameZone = d.current_zone === order.delivery_zone;
      const zoneScore = sameZone ? 20 : 5;
      const lieferungenToday = myPerf.length;
      const kapazitaetsScore = lieferungenToday < 5 ? 20 : lieferungenToday < 10 ? 10 : 0;

      const score = Math.round(
        (avgRating / 5) * 30 + puenktlichkeit * 30 + zoneScore + kapazitaetsScore
      );

      const gruende: string[] = [];
      if (sameZone) gruende.push('Gleiche Zone');
      if (puenktlichkeit >= 0.85) gruende.push('Sehr pünktlich heute');
      if (avgRating >= 4.7) gruende.push('Top-Bewertung');
      if (lieferungenToday < 5) gruende.push('Freie Kapazität');
      if (gruende.length === 0) gruende.push('Verfügbarer Fahrer');

      return {
        fahrer_id: d.id,
        fahrer_name: `${d.first_name ?? ''} ${(d.last_name ?? '').charAt(0)}.`.trim(),
        score,
        gruende,
        order_id: order.id,
        order_kurz: `#${order.bestellnummer ?? order.id.slice(0, 6)} — ${order.delivery_zone ?? 'Unbekannt'}`,
        zone: order.delivery_zone ?? 'Unbekannt',
        distanz_km: undefined,
        verbleibt_min: order.eta_minutes ?? undefined,
      };
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ vorschlaege, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ vorschlaege: [], timestamp: new Date().toISOString() });
  }
}
