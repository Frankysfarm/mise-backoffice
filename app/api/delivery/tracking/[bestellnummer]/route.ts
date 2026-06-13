/**
 * GET /api/delivery/tracking/[bestellnummer]
 *
 * Öffentlicher Live-Tracking-Endpunkt für die Storefront.
 * Kein Auth — bestellnummer ist der Lookup-Key (nicht-erratbar).
 *
 * Gibt zurück:
 *  - Bestellstatus + ETA-Label
 *  - Fahrer-Position (lat/lng, heading, age_sec)
 *  - Geofencing: Distanz, Almost-There, Bearing, ETA-Minuten-Rest
 *  - Stops vor diesem in der Tour
 *
 * Query-Parameter:
 *  session_id  — optional, bestehende Analytics-Session-ID für Ping-Update
 *  ua          — optional, User-Agent für Analytics (max 200 Zeichen)
 *
 * Phase 107
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOrderTrackingData, recordTrackingSession } from '@/lib/delivery/live-tracking';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ bestellnummer: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { bestellnummer } = await params;

  if (!bestellnummer || bestellnummer.length < 4) {
    return NextResponse.json({ error: 'Ungültige Bestellnummer' }, { status: 400 });
  }

  const payload = await getOrderTrackingData(bestellnummer);
  if (!payload) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  // Analytics: Session-Ping (fire-and-forget, kein Await im kritischen Pfad)
  const url       = req.nextUrl;
  const sessionId = url.searchParams.get('session_id');
  const ua        = url.searchParams.get('ua')?.slice(0, 200) ?? null;
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipHash    = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;

  recordTrackingSession({
    orderId:      payload.orderId,
    locationId:   null,   // wird in recordTrackingSession aus der DB geladen wenn nötig
    bestellnummer: payload.bestellnummer,
    sessionId:    sessionId ?? undefined,
    almostThere:  payload.geo.almostThere,
    arrived:      payload.status === 'geliefert',
    userAgent:    ua,
    ipHash,
  }).catch(() => {});

  return NextResponse.json({
    order_id:        payload.orderId,
    bestellnummer:   payload.bestellnummer,
    status:          payload.status,
    eta_label:       payload.etaLabel,
    eta_earliest:    payload.etaEarliest,
    eta_latest:      payload.etaLatest,
    batch_state:     payload.batchState,
    stops_before:    payload.stopsBefore,
    driver:          payload.driver
      ? {
          lat:              payload.driver.lat,
          lng:              payload.driver.lng,
          heading:          payload.driver.heading,
          speed_kmh:        payload.driver.speedKmh,
          seconds_stale:    payload.driver.positionAgeSec,
        }
      : null,
    driver_name:     payload.driverName,
    fahrer_fahrzeug: payload.driverVehicleLabel,
    kunde_name:      payload.kundeName,
    gesamtbetrag:    payload.gesamtbetrag,
    geo: {
      distance_m:        payload.geo.distanceM,
      almost_there:      payload.geo.almostThere,
      eta_min_remaining: payload.geo.etaMinRemaining,
      bearing_deg:       payload.geo.bearingDeg,
    },
  });
}
