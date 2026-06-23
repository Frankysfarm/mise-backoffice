import { NextRequest, NextResponse } from 'next/server';
import {
  computeSnapshot,
  computeAllLocations,
  getSnapshots,
  getLatestSnapshot,
  pruneOldSnapshots,
} from '@/lib/delivery/einnahmen-trichter';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const action     = req.nextUrl.searchParams.get('action') ?? 'latest';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'history') {
      const days = Number(req.nextUrl.searchParams.get('days') ?? '14');
      const snapshots = await getSnapshots(locationId, days);
      return NextResponse.json({ ok: true, snapshots });
    }

    const snapshot = await getLatestSnapshot(locationId);
    return NextResponse.json({ ok: true, snapshot });
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
      const datum = body.datum as string | undefined;
      const result = await computeSnapshot(locationId, datum);
      return NextResponse.json(result);
    }

    if (action === 'compute-all') {
      const datum  = body.datum as string | undefined;
      const result = await computeAllLocations(datum);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 90;
      const pruned  = await pruneOldSnapshots(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
