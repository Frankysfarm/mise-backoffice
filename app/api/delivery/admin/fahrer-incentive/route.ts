import { NextRequest, NextResponse } from 'next/server';
import {
  getIncentivesForLocation,
  createIncentiveZiel,
  deleteIncentiveZiel,
  evaluateIncentivesForLocation,
  evaluateIncentivesAllLocations,
  pruneOldIncentives,
  type CreateZielParams,
  type ZielTyp,
} from '@/lib/delivery/fahrer-incentive';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const activeOnly = req.nextUrl.searchParams.get('active_only') === 'true';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const incentives = await getIncentivesForLocation(locationId, activeOnly);
    return NextResponse.json({ ok: true, incentives });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = (body.action as string | undefined) ?? 'create';

    if (action === 'create') {
      const locationId    = body.location_id as string | undefined;
      const driverId      = body.driver_id as string | undefined;
      const zielTyp       = body.ziel_typ as ZielTyp | undefined;
      const zielwert      = body.zielwert as number | undefined;
      const bonusEur      = body.bonus_eur as number | undefined;
      const zeitraumStart = body.zeitraum_start as string | undefined;
      const zeitraumEnd   = body.zeitraum_end as string | undefined;

      if (!locationId || !driverId || !zielTyp || zielwert === undefined || bonusEur === undefined || !zeitraumStart || !zeitraumEnd) {
        return NextResponse.json({ error: 'location_id, driver_id, ziel_typ, zielwert, bonus_eur, zeitraum_start, zeitraum_end required' }, { status: 400 });
      }

      const params: CreateZielParams = { locationId, driverId, zielTyp, zielwert, bonusEur, zeitraumStart, zeitraumEnd };
      const created = await createIncentiveZiel(params);
      return NextResponse.json({ ok: true, incentive: created }, { status: 201 });
    }

    if (action === 'delete') {
      const id         = body.id as string | undefined;
      const locationId = body.location_id as string | undefined;
      if (!id || !locationId) {
        return NextResponse.json({ error: 'id and location_id required' }, { status: 400 });
      }
      await deleteIncentiveZiel(id, locationId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'evaluate') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await evaluateIncentivesForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'evaluate-all') {
      const result = await evaluateIncentivesAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const daysOld = (body.days_old as number | undefined) ?? 90;
      const result = await pruneOldIncentives(daysOld);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
