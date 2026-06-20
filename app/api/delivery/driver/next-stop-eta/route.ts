/**
 * GET /api/delivery/driver/next-stop-eta
 *
 * ETA für den nächsten Stopp des angegebenen Fahrers.
 * Genutzt vom StopSmartCountdown in der Fahrer-App.
 *
 * Query: ?driver_id=<employee_id>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDriverNextStopEta } from '@/lib/delivery/tour-stop-timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const driverId = req.nextUrl.searchParams.get('driver_id');
    if (!driverId) {
      return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
    }

    const result = await getDriverNextStopEta(driverId);
    if (!result) {
      return NextResponse.json({ error: 'driver not found' }, { status: 404 });
    }

    // Dates serialisieren
    const payload = {
      ...result,
      nextStop: result.nextStop
        ? {
            ...result.nextStop,
            etaEarliest: result.nextStop.etaEarliest?.toISOString() ?? null,
            etaLatest: result.nextStop.etaLatest?.toISOString() ?? null,
            predictedArrivalAt: result.nextStop.predictedArrivalAt?.toISOString() ?? null,
            completedAt: result.nextStop.completedAt?.toISOString() ?? null,
          }
        : null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[next-stop-eta]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
