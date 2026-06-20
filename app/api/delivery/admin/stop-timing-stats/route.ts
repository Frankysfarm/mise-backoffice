/**
 * GET /api/delivery/admin/stop-timing-stats
 *
 * Aggregierte Stopp-Timing-Statistiken für die aktuelle Schicht.
 * Genutzt von StoppTimingStatistik (Lieferdienst-Dashboard).
 *
 * Query: ?location_id=<id>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getStopTimingStats } from '@/lib/delivery/tour-stop-timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get('location_id');
    const stats = await getStopTimingStats(locationId ?? undefined);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[stop-timing-stats]', err);
    return NextResponse.json(
      {
        avgDeliveryTimeMin: 0, onTimePct: 0, latePct: 0,
        totalStopsCompleted: 0, avgDelayMinutes: 0,
        bestDriverId: null, bestDriverName: null, bestDriverOnTimePct: 0,
        perHour: [],
      },
      { status: 200 },
    );
  }
}
