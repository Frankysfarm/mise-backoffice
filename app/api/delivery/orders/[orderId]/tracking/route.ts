/**
 * GET /api/delivery/orders/[orderId]/tracking
 *
 * Live-Tracking-Daten für eine Bestellung.
 * Öffentlicher Endpunkt (kein Auth) — nutzt order_token aus Query.
 *
 * Gibt zurück:
 * - Bestellstatus + ETA
 * - Fahrer-Position (lat/lng, seconds_stale)
 * - Tour-Fortschritt (wieviele Stops noch vor diesem)
 * - Display-Label "19:20–19:40"
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ orderId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const sb = createServiceClient();

  // Bestellung laden
  const { data: order, error: orderErr } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, status, typ, eta_earliest, eta_latest, mise_batch_id, mise_driver_id, location_id, kunde_lat, kunde_lng')
    .eq('id', orderId)
    .eq('typ', 'lieferung')
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  // ETA-Labels
  let etaLabel: string | null = null;
  if (order.eta_earliest && order.eta_latest) {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      });
    etaLabel = `${fmt(order.eta_earliest)}–${fmt(order.eta_latest)}`;
  }

  // Wenn kein Batch zugewiesen → frühes Tracking ohne Fahrer
  if (!order.mise_batch_id) {
    return NextResponse.json({
      order_id:    order.id,
      bestellnummer: order.bestellnummer,
      status:      order.status,
      eta_label:   etaLabel,
      eta_earliest: order.eta_earliest,
      eta_latest:   order.eta_latest,
      driver:      null,
      stops_before: null,
      batch_state:  null,
    });
  }

  // Batch + Stops laden
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, state, driver_id')
    .eq('id', order.mise_batch_id)
    .maybeSingle();

  // Stops zählen: wieviele Dropoffs kommen VOR diesem Stop?
  const { data: stops } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, type, sequence, completed_at')
    .eq('batch_id', order.mise_batch_id)
    .order('sequence', { ascending: true });

  const thisStop = (stops ?? []).find(
    (s) => s.order_id === orderId && s.type === 'dropoff',
  );
  const stopsBefore = thisStop
    ? (stops ?? []).filter(
        (s) =>
          s.type === 'dropoff' &&
          (s.sequence as number) < (thisStop.sequence as number) &&
          !s.completed_at,
      ).length
    : null;

  // Fahrer-Position (jüngste Location)
  const driverId = batch?.driver_id ?? order.mise_driver_id;
  let driverPosition: {
    lat: number;
    lng: number;
    heading: number | null;
    seconds_stale: number;
  } | null = null;

  if (driverId) {
    const { data: loc } = await sb
      .from('mise_driver_locations')
      .select('lat, lng, heading, recorded_at')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loc) {
      const secondsStale = Math.floor(
        (Date.now() - new Date(loc.recorded_at as string).getTime()) / 1000,
      );
      driverPosition = {
        lat: loc.lat as number,
        lng: loc.lng as number,
        heading: (loc.heading as number | null) ?? null,
        seconds_stale: secondsStale,
      };
    }
  }

  return NextResponse.json({
    order_id:      order.id,
    bestellnummer: order.bestellnummer,
    status:        order.status,
    eta_label:     etaLabel,
    eta_earliest:  order.eta_earliest,
    eta_latest:    order.eta_latest,
    batch_state:   batch?.state ?? null,
    stops_before:  stopsBefore,
    driver:        driverPosition,
  });
}
