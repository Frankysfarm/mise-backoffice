import { NextRequest, NextResponse } from 'next/server';
import {
  computeForLocation,
  computeAllLocations,
  getDashboard,
  getPrognosen,
  pruneOldPrognosen,
} from '@/lib/delivery/wiederkauf-prediktion';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const action     = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'list') {
      const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
      const prognosen = await getPrognosen(locationId, limit);
      return NextResponse.json({ ok: true, prognosen });
    }

    const dashboard = await getDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
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
      const result = await computeAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 30;
      const pruned  = await pruneOldPrognosen(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
