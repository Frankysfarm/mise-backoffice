/**
 * GET /api/delivery/eta/live?location_id=...
 * Gibt die aktuelle geschätzte Lieferzeit basierend auf Küchenauslastung zurück.
 * Öffentlich lesbar (service role, keine User-Auth erforderlich).
 * Enthält auch das Queue-Signal (Phase 44) für Storefront-Wartezeit-Banner.
 * Phase 392: confidence + eta_min_low/high basierend auf historischer Genauigkeit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentQueueSignal } from '@/lib/delivery/capacity';
import { computeEtaConfidence } from '@/lib/delivery/eta-confidence';

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

    const [{ count: activeOrders }, { count: onlineDrivers }, queueSignal] = await Promise.all([
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
      getCurrentQueueSignal(locationId).catch(() => null),
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

    // Queue-Signal: ETA-Verlängerung aufaddieren
    const etaExtension = queueSignal?.etaExtensionMin ?? 0;
    const etaMinWithExtension = etaMin + etaExtension;

    // Phase 392: ETA Confidence aus historischen Kalibrations-Daten
    const hourNow = new Date().getUTCHours();
    const confidenceResult = await computeEtaConfidence({
      locationId,
      zone:     null,   // location-wide fallback (kein konkreter Auftrag)
      vehicle:  null,
      hourOfDay: hourNow,
    }).catch(() => null);

    const confidenceLevel = confidenceResult?.confidence ?? 'mittel';
    // on_time_rate → numerischer Konfidenz-Wert 0.0–1.0
    const confidenceNumeric =
      confidenceResult?.on_time_rate != null
        ? Math.round(confidenceResult.on_time_rate * 100) / 100
        : 0.70;

    // Unsicherheits-Band je Konfidenz-Level
    const rangeFactor: Record<string, number> = { hoch: 0.10, mittel: 0.20, niedrig: 0.35 };
    const rf = rangeFactor[confidenceLevel] ?? 0.20;
    const etaMinLow  = Math.max(10, Math.round(etaMinWithExtension * (1 - rf)));
    const etaMinHigh = Math.round(etaMinWithExtension * (1 + rf));

    return NextResponse.json(
      {
        eta_min:           etaMinWithExtension,
        eta_min_base:      etaMin,
        eta_min_low:       etaMinLow,
        eta_min_high:      etaMinHigh,
        load,
        active_orders:     active,
        drivers_online:    drivers,
        queue_signal:      queueSignal?.signalType ?? 'normal',
        eta_extension_min: etaExtension,
        signal_message:    queueSignal?.messageDe ?? null,
        confidence:        confidenceNumeric,
        confidence_level:  confidenceLevel,
      },
      { headers: NO_CACHE },
    );
  } catch {
    return NextResponse.json({ eta_min: 35, load: 'normal', confidence: 0.70, confidence_level: 'mittel' }, { headers: NO_CACHE });
  }
}
