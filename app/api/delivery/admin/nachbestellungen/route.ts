import { NextRequest, NextResponse } from 'next/server';
import {
  getNachbestellungen,
  scanAndCreate,
  scanAndCreateAllLocations,
  updateStatus,
  pruneOldNachbestellungen,
  type NachbestellungStatus,
} from '@/lib/delivery/nachbestellungs-engine';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const status     = req.nextUrl.searchParams.get('status') as NachbestellungStatus | null;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const nachbestellungen = await getNachbestellungen(locationId, status ?? undefined);
    return NextResponse.json({ ok: true, nachbestellungen });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = (body.action as string | undefined) ?? 'scan';

    if (action === 'scan') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      const result = await scanAndCreate(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'scan-all') {
      const result = await scanAndCreateAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'update-status') {
      const id         = body.id as string | undefined;
      const locationId = body.location_id as string | undefined;
      const status     = body.status as NachbestellungStatus | undefined;
      if (!id || !locationId || !status) {
        return NextResponse.json({ error: 'id, location_id, status required' }, { status: 400 });
      }
      const notizen = body.notizen as string | undefined;
      const ok = await updateStatus(id, status, locationId, notizen);
      return NextResponse.json({ ok });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 180;
      const pruned  = await pruneOldNachbestellungen(daysOld);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
