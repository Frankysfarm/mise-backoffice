/**
 * GET /api/delivery/admin/stop-timing-matrix
 *
 * Liefert die Echtzeit-Stopp-Timing-Matrix für alle aktiven Touren.
 * Genutzt von KitchenStopArrivalPrognose und DispatchStopAnkunftsMatrix.
 *
 * Query: ?location_id=<id>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getStopTimingMatrix } from '@/lib/delivery/tour-stop-timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get('location_id');
    const matrix = await getStopTimingMatrix(locationId ?? undefined);

    // Dates serialisieren
    const payload = {
      ...matrix,
      generatedAt: matrix.generatedAt.toISOString(),
      entries: matrix.entries.map(e => ({
        ...e,
        etaEarliest: e.etaEarliest?.toISOString() ?? null,
        etaLatest: e.etaLatest?.toISOString() ?? null,
        predictedArrivalAt: e.predictedArrivalAt?.toISOString() ?? null,
        completedAt: e.completedAt?.toISOString() ?? null,
      })),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[stop-timing-matrix]', err);
    return NextResponse.json(
      { activeTours: 0, totalPendingStops: 0, lateStops: 0, atRiskStops: 0, onTimeStops: 0, entries: [] },
      { status: 200 },
    );
  }
}
