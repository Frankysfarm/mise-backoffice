/**
 * GET /api/delivery/orders/[orderId]/tracking
 *
 * Live-Tracking-Daten für eine Bestellung (interne API, via UUID).
 * Öffentlicher Endpunkt (kein Auth).
 *
 * Gibt zurück:
 * - Bestellstatus + ETA
 * - Fahrer-Position (lat/lng, seconds_stale)
 * - Tour-Fortschritt (wieviele Stops noch vor diesem)
 * - Geofencing: distance_m, almost_there, eta_min_remaining, bearing_deg (Phase 107)
 * - Display-Label "19:20–19:40"
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeGeofencing } from '@/lib/delivery/live-tracking';

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

  // Fahrer-Position + Name (jüngste Location)
  const driverId = batch?.driver_id ?? order.mise_driver_id;
  let driverPosition: {
    lat: number;
    lng: number;
    heading: number | null;
    seconds_stale: number;
  } | null = null;
  let driverName: string | null = null;
  let geo = { distanceM: null as number | null, almostThere: false, etaMinRemaining: null as number | null, bearingDeg: null as number | null };

  if (driverId) {
    const [{ data: loc }, { data: driverRow }] = await Promise.all([
      sb
        .from('mise_driver_locations')
        .select('lat, lng, heading, speed_kmh, recorded_at')
        .eq('driver_id', driverId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('mise_drivers')
        .select('employee_id, vehicle')
        .eq('id', driverId)
        .maybeSingle(),
    ]);

    if (loc) {
      const secondsStale = Math.floor(
        (Date.now() - new Date(loc.recorded_at as string).getTime()) / 1000,
      );
      driverPosition = {
        lat:           loc.lat as number,
        lng:           loc.lng as number,
        heading:       (loc.heading as number | null) ?? null,
        seconds_stale: secondsStale,
        speed_kmh:     (loc.speed_kmh as number | null) ?? null,
      } as typeof driverPosition & { speed_kmh: number | null };
    }

    if (driverRow?.employee_id) {
      const { data: emp } = await sb
        .from('employees')
        .select('vorname')
        .eq('id', driverRow.employee_id)
        .maybeSingle();
      if (emp?.vorname) driverName = emp.vorname as string;
    }

    // Geofencing: Distanz + Almost-There + Bearing (Phase 107)
    const kundePos = order.kunde_lat != null && order.kunde_lng != null
      ? { lat: order.kunde_lat as number, lng: order.kunde_lng as number }
      : null;
    if (driverPosition && kundePos) {
      const vehicleType = (driverRow?.vehicle as string | null) === 'car' ? 'car' : 'bike';
      const dp = driverPosition as typeof driverPosition & { speed_kmh: number | null };
      geo = computeGeofencing(
        { lat: dp.lat, lng: dp.lng, speedKmh: dp.speed_kmh ?? null },
        kundePos,
        vehicleType,
      );
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
    driver_name:   driverName,
    geo: {
      distance_m:        geo.distanceM,
      almost_there:      geo.almostThere,
      eta_min_remaining: geo.etaMinRemaining,
      bearing_deg:       geo.bearingDeg,
    },
  });
}
