/**
 * GET /api/delivery/queue-signal?location_id=...
 *
 * Öffentlicher Endpunkt — kein Auth erforderlich.
 * Gibt das aktuelle Queue-Signal für eine Location zurück.
 * Der Storefront liest diesen Endpunkt, um die Wartezeit-Info anzuzeigen.
 *
 * Response:
 * {
 *   signal_type:       'normal' | 'extended' | 'paused',
 *   eta_extension_min: number,    // extra Minuten zur Basis-ETA
 *   message_de:        string | null,
 *   expires_at:        string | null
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentQueueSignal } from '@/lib/delivery/capacity';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json(
      { signal_type: 'normal', eta_extension_min: 0, message_de: null, expires_at: null },
      { headers: NO_CACHE },
    );
  }

  try {
    const signal = await getCurrentQueueSignal(locationId);
    return NextResponse.json(
      {
        signal_type:       signal.signalType,
        eta_extension_min: signal.etaExtensionMin,
        message_de:        signal.messageDe,
        expires_at:        signal.expiresAt,
      },
      { headers: NO_CACHE },
    );
  } catch {
    return NextResponse.json(
      { signal_type: 'normal', eta_extension_min: 0, message_de: null, expires_at: null },
      { headers: NO_CACHE },
    );
  }
}
