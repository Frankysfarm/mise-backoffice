import { NextRequest, NextResponse } from 'next/server';
import {
  getQualitaetForLocation,
  getQualitaetTagesAggregat,
  computeQualitaetForLocation,
  computeQualitaetAllLocations,
  pruneOldQualitaet,
} from '@/lib/delivery/liefer-qualitaet';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const days       = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10);
  const limit      = parseInt(req.nextUrl.searchParams.get('limit') ?? '200', 10);
  const action     = req.nextUrl.searchParams.get('action') ?? 'list';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'aggregat') {
      const aggregat = await getQualitaetTagesAggregat(locationId, days);
      return NextResponse.json({ ok: true, aggregat });
    }

    const qualitaet = await getQualitaetForLocation(locationId, days, limit);
    return NextResponse.json({ ok: true, qualitaet });
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
      const since      = body.since as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      const result = await computeQualitaetForLocation(locationId, since);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'compute-all') {
      const since   = body.since as string | undefined;
      const results = await computeQualitaetAllLocations(since);
      return NextResponse.json({ ok: true, results });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 90;
      const pruned  = await pruneOldQualitaet(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
