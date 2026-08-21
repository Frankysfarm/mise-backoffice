/**
 * GET /api/delivery/eta/live?location_id=...
 * Gibt die aktuelle geschätzte Lieferzeit basierend auf Küchenauslastung zurück.
 * Öffentlich lesbar (service role, keine User-Auth erforderlich).
 * Enthält auch das Queue-Signal (Phase 44) für Storefront-Wartezeit-Banner.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentQueueSignal } from '@/lib/delivery/capacity';

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
    const { data: location } = await sb.from('locations')
      .select('id,tenant_id')
      .eq('id', locationId)
      .eq('aktiv', true)
      .maybeSingle();
    if (!location) return NextResponse.json({ eta_min: 35, load: 'normal' }, { headers: NO_CACHE });

    const [{ count: activeOrders }, eligibleDrivers, queueSignal] = await Promise.all([
      sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
        .eq('typ', 'lieferung'),
      sb.rpc('get_eligible_delivery_drivers', {
        p_tenant_id: location.tenant_id,
        p_location_id: location.id,
      }),
      getCurrentQueueSignal(locationId).catch(() => null),
    ]);

    const active = activeOrders ?? 0;
    const drivers = Math.max(Array.isArray(eligibleDrivers.data) ? eligibleDrivers.data.length : 0, 1);
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

    return NextResponse.json(
      {
        eta_min:           etaMinWithExtension,
        eta_min_base:      etaMin,
        load,
        active_orders:     active,
        drivers_online:    drivers,
        queue_signal:      queueSignal?.signalType ?? 'normal',
        eta_extension_min: etaExtension,
        signal_message:    queueSignal?.messageDe ?? null,
      },
      { headers: NO_CACHE },
    );
  } catch {
    return NextResponse.json({ eta_min: 35, load: 'normal' }, { headers: NO_CACHE });
  }
}
