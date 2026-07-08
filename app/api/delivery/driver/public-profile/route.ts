/**
 * GET /api/delivery/driver/public-profile?order_id=...
 *
 * Anonymisiertes Fahrer-Profil für Kunden-Storefront während aktiver Lieferung.
 * Gibt nur öffentlich sichtbare Felder zurück: Vorname, Bewertung, Fahrzeugtyp, ETA.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');

  if (!orderId) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });

  const svc = createServiceClient();

  // Bestellung laden — driver_id + ETA auflösen
  const { data: order } = await svc
    .from('customer_orders')
    .select('driver_id, eta_minutes, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || !order.driver_id) {
    return NextResponse.json({ error: 'Kein Fahrer zugewiesen' }, { status: 404 });
  }

  // Nur während aktiver Lieferung sichtbar
  if (!['unterwegs', 'in_delivery', 'dispatched', 'abgeholt'].includes(order.status ?? '')) {
    return NextResponse.json({ error: 'Keine aktive Lieferung' }, { status: 404 });
  }

  // Fahrer-Profil laden
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('vorname, vehicle_type, total_deliveries')
    .eq('id', order.driver_id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

  // Fahrer-Bewertung: Durchschnitt der letzten 90 Lieferungen
  const { data: ratings } = await svc
    .from('customer_orders')
    .select('driver_rating')
    .eq('driver_id', order.driver_id)
    .not('driver_rating', 'is', null)
    .order('created_at', { ascending: false })
    .limit(90);

  const ratingValues = (ratings ?? [])
    .map((r: Record<string, unknown>) => Number(r.driver_rating))
    .filter((v: number) => v > 0);
  const bewertungAvg = ratingValues.length > 0
    ? Math.round((ratingValues.reduce((s: number, v: number) => s + v, 0) / ratingValues.length) * 10) / 10
    : 4.5;

  return NextResponse.json({
    vorname: driver.vorname ?? 'Fahrer',
    bewertung_avg: bewertungAvg,
    deliveries: driver.total_deliveries ?? ratingValues.length,
    fahrzeug: driver.vehicle_type ?? null,
    eta_min: order.eta_minutes ?? null,
  });
}
