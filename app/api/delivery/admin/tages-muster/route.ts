import { NextRequest, NextResponse } from 'next/server';
import {
  computeTagesMuster,
  computeTagesMusterAllLocations,
  getTagesMuster,
  getTagesMusterPrognose,
  pruneOldTagesMuster,
} from '@/lib/delivery/tages-muster';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action') ?? 'prognose';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  try {
    if (action === 'muster') {
      const dowParam = searchParams.get('wochentag');
      const dow = dowParam !== null ? parseInt(dowParam, 10) : undefined;
      const data = await getTagesMuster(locationId, dow);
      return NextResponse.json({ ok: true, muster: data });
    }

    // default: prognose (heute + morgen)
    const prognose = await getTagesMusterPrognose(locationId);
    return NextResponse.json({ ok: true, prognose });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { action?: string; location_id?: string; days_back?: number; days_old?: number };
    const { action, location_id: locationId } = body;

    if (action === 'compute-all') {
      const daysBack = body.days_back ?? 90;
      const result = await computeTagesMusterAllLocations(daysBack);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const daysOld = body.days_old ?? 30;
      const pruned = await pruneOldTagesMuster(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    if (action === 'compute') {
      const daysBack = body.days_back ?? 90;
      const result = await computeTagesMuster(locationId, daysBack);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
