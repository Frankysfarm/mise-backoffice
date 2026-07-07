/**
 * GET /api/delivery/tracking/[orderId]/driver-preview
 *
 * Öffentlicher Endpunkt — liefert Fahrer-Profil für Storefront-Vorschau.
 * Kein Auth. orderId = UUID der Bestellung.
 *
 * Gibt zurück: name, avgRating, toursThisMonth, etaMin, vehicle
 *
 * Phase 604
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ bestellnummer: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { bestellnummer: orderId } = await params;
  const sb = createServiceClient();

  // Bestellung laden (UUID oder Bestellnummer)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, mise_driver_id, mise_batch_id, eta_earliest, eta_latest, status')
    .eq(isUuid ? 'id' : 'bestellnummer', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  }

  const driverId = order.mise_driver_id;
  if (!driverId) {
    return NextResponse.json({ error: 'Kein Fahrer zugewiesen' }, { status: 404 });
  }

  // Fahrer-Stammdaten
  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, rating')
    .eq('id', driverId)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  // Touren diesen Monat (abgeschlossene Batches)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: toursThisMonth } = await sb
    .from('mise_delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .in('state', ['completed', 'delivered'])
    .gte('created_at', monthStart.toISOString());

  // ETA in Minuten berechnen
  let etaMin: number | null = null;
  if (order.eta_earliest) {
    const diffMs = new Date(order.eta_earliest).getTime() - Date.now();
    if (diffMs > 0) {
      etaMin = Math.round(diffMs / 60_000);
    }
  }

  // Avg-Rating: zuerst aus driver.rating, sonst aus jüngster Payout-Periode
  let avgRating: number | null = (driver.rating as number | null) ?? null;
  if (avgRating === null) {
    const { data: period } = await sb
      .from('driver_payout_periods')
      .select('avg_rating')
      .eq('driver_id', driverId)
      .not('avg_rating', 'is', null)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (period?.avg_rating != null) {
      avgRating = Number(period.avg_rating);
    }
  }

  return NextResponse.json({
    name: driver.name,
    avgRating,
    avg_rating: avgRating,
    toursThisMonth: toursThisMonth ?? null,
    tours_this_month: toursThisMonth ?? null,
    etaMin,
    eta_min: etaMin,
    vehicle: driver.vehicle ?? null,
  });
}
