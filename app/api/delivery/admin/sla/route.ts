/**
 * GET /api/delivery/admin/sla?location_id=...&days=7
 *
 * SLA-Bericht: On-Time-Rate, Abweichung und Lieferzeit pro Fahrer/Zone.
 * Nutzt delivery_performance Tabelle (Migration 016).
 *
 * Response:
 * {
 *   summary: { totalStops, onTimeCount, lateCount, onTimePct, avgDeviationMin, avgDeliveryMin }
 *   byDriver: { [driverId]: SlaStats }
 *   byZone:   { [zone]: SlaStats }
 *   days: number
 *   since: string (ISO)
 *   _fallback?: true   — wenn delivery_performance noch leer / Migration fehlt
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSlaSummary } from '@/lib/delivery/rating';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 7), 1), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const { byDriver, byZone, ...summary } = await getSlaSummary(locationId, days);

    if (summary.totalStops === 0) {
      return NextResponse.json({
        summary,
        byDriver: {},
        byZone:   {},
        days,
        since,
        _fallback: true,
        _hint: 'delivery_performance noch leer — Daten werden nach den ersten abgeschlossenen Lieferungen erscheinen.',
      });
    }

    return NextResponse.json({ summary, byDriver, byZone, days, since });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
