import { NextRequest, NextResponse } from 'next/server';
import {
  getZeugnisseForLocation,
  generateZeugnis,
  generateZeugnisseForLocation,
  generateZeugnisseAllLocations,
  pruneOldZeugnisse,
} from '@/lib/delivery/fahrer-zeugnis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const limit      = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const zeugnisse = await getZeugnisseForLocation(locationId, limit);
    return NextResponse.json({ ok: true, zeugnisse });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = (body.action as string | undefined) ?? 'generate';

    if (action === 'generate') {
      const locationId = body.location_id as string | undefined;
      const driverId   = body.driver_id   as string | undefined;
      const monat      = body.monat       as string | undefined;

      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      if (driverId) {
        const result = await generateZeugnis(driverId, locationId, monat);
        return NextResponse.json({ ok: true, ...result });
      }
      const result = await generateZeugnisseForLocation(locationId, monat);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'generate-all') {
      const monat = body.monat as string | undefined;
      const results = await generateZeugnisseAllLocations(monat);
      return NextResponse.json({ ok: true, results });
    }

    if (action === 'prune') {
      const monthsOld = (body.months_old as number | undefined) ?? 24;
      const pruned = await pruneOldZeugnisse(monthsOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
