/**
 * GET /api/delivery/orders/[orderId]/eta-confidence
 *
 * Phase 252: ETA-Vertrauens-API
 *
 * Gibt das Vertrauensniveau der ETA-Vorhersage für eine Bestellung zurück.
 * Öffentlich lesbar (kein Auth — orderId als Geheimnis ausreichend).
 *
 * Response:
 *  { confidence: 'hoch'|'mittel'|'niedrig', on_time_rate, sample_count, ... }
 *
 * Confidence-Logik:
 *  - Historische on_time_rate aus eta_calibration_factors (location + zone + vehicle + Tageszeit)
 *  - Fallback-Kette: exakt → zone → standort → neutral ('mittel')
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeEtaConfidence } from '@/lib/delivery/eta-confidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_CACHE = { 'Cache-Control': 'no-store, max-age=0' };
const TERMINAL_STATUSES = new Set(['geliefert', 'abgeschlossen', 'storniert']);

interface Params {
  params: Promise<{ orderId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;

  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'Ungültige Order-ID' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Bestellung laden
  const { data: order, error: orderErr } = await sb
    .from('customer_orders')
    .select('id, status, location_id, delivery_zone, mise_driver_id, mise_batch_id')
    .eq('id', orderId)
    .eq('typ', 'lieferung')
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  // Abgeschlossene Orders: kein Vertrauens-Score nötig
  if (TERMINAL_STATUSES.has(order.status as string)) {
    return NextResponse.json(
      { confidence: null, reason: 'terminal_status' },
      { headers: NO_CACHE },
    );
  }

  // Fahrzeugtyp des Fahrers laden
  let vehicle: string | null = null;
  const driverId = order.mise_driver_id as string | null;

  if (driverId) {
    const { data: driver } = await sb
      .from('mise_drivers')
      .select('vehicle')
      .eq('id', driverId)
      .maybeSingle();
    vehicle = (driver?.vehicle as string | null) ?? null;
  } else if (order.mise_batch_id) {
    // Fahrer über Batch ermitteln
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('id', order.mise_batch_id)
      .maybeSingle();
    if (batch?.driver_id) {
      const { data: driver } = await sb
        .from('mise_drivers')
        .select('vehicle')
        .eq('id', batch.driver_id as string)
        .maybeSingle();
      vehicle = (driver?.vehicle as string | null) ?? null;
    }
  }

  const hourOfDay = new Date().getUTCHours();

  const result = await computeEtaConfidence({
    locationId: order.location_id as string,
    zone:       (order.delivery_zone as string | null) ?? null,
    vehicle,
    hourOfDay,
  });

  return NextResponse.json(
    {
      order_id:           orderId,
      confidence:         result.confidence,
      on_time_rate:       result.on_time_rate,
      sample_count:       result.sample_count,
      calibration_factor: result.calibration_factor,
      zone:               result.zone,
      vehicle:            result.vehicle,
      hour_bucket:        result.hour_bucket,
      lookup_breadth:     result.lookup_breadth,
    },
    { headers: NO_CACHE },
  );
}
