import { NextRequest, NextResponse } from 'next/server';
import {
  getDashboard,
  getScores,
  getSegmentStats,
  computeForLocation,
  computeAllLocations,
  pruneOldScores,
  type Segmentierung,
} from '@/lib/delivery/kundenbindung';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId    = req.nextUrl.searchParams.get('location_id');
  const action        = req.nextUrl.searchParams.get('action') ?? 'dashboard';
  const limit         = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10);
  const segmentierung = req.nextUrl.searchParams.get('segmentierung') as Segmentierung | null;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'dashboard') {
      const dashboard = await getDashboard(locationId);
      return NextResponse.json({ ok: true, dashboard });
    }

    if (action === 'scores') {
      const scores = await getScores(locationId, limit, segmentierung ?? undefined);
      return NextResponse.json({ ok: true, scores });
    }

    if (action === 'segment-stats') {
      const stats = await getSegmentStats(locationId);
      return NextResponse.json({ ok: true, stats });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = (body.action as string | undefined) ?? 'compute';

    if (action === 'compute') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      const result = await computeForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'compute-all') {
      const results = await computeAllLocations();
      return NextResponse.json({ ok: true, results });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 90;
      const pruned  = await pruneOldScores(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
