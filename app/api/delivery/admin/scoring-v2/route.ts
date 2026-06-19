import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getScoringV2Dashboard,
  getScoringV2Config,
  upsertScoringV2Config,
  getZoneVehicleStats,
  rebuildZoneVehicleStats,
} from '@/lib/delivery/scoring-v2';

export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const locParam = req.nextUrl.searchParams.get('location_id');
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;

  interface Emp { location_id: string; role: string }
  const e = emp as unknown as Emp;
  const isSuperadmin = e.role === 'superadmin';
  return (isSuperadmin && locParam) ? locParam : e.location_id;
}

export async function GET(req: NextRequest) {
  try {
    const locationId = await getLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

    if (action === 'config') {
      const config = await getScoringV2Config(locationId);
      return NextResponse.json({ config });
    }

    if (action === 'stats') {
      const stats = await getZoneVehicleStats(locationId);
      return NextResponse.json({ stats });
    }

    // Default: dashboard
    const dashboard = await getScoringV2Dashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[scoring-v2 GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const locationId = await getLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'update_config') {
      const patch = body.config as Record<string, unknown>;
      const result = await upsertScoringV2Config(locationId, {
        wDistance:           patch.wDistance as number,
        wLoad:               patch.wLoad as number,
        wVehicle:            patch.wVehicle as number,
        wExperience:         patch.wExperience as number,
        wZone:               patch.wZone as number,
        wPrepTime:           patch.wPrepTime as number,
        wTimeOfDay:          patch.wTimeOfDay as number,
        wPriority:           patch.wPriority as number,
        wBundleFit:          patch.wBundleFit as number,
        wHistory:            patch.wHistory as number,
        wWeather:            patch.wWeather as number,
        wVelocity:           patch.wVelocity as number,
        useWeather:          patch.useWeather as boolean,
        useVelocity:         patch.useVelocity as boolean,
        useZoneVehicleStats: patch.useZoneVehicleStats as boolean,
        isActive:            patch.isActive as boolean,
      });
      return NextResponse.json(result);
    }

    if (action === 'toggle') {
      const isActive = body.isActive as boolean;
      const result = await upsertScoringV2Config(locationId, { isActive });
      return NextResponse.json(result);
    }

    if (action === 'rebuild') {
      const rows = await rebuildZoneVehicleStats(locationId);
      return NextResponse.json({ ok: true, rows });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[scoring-v2 POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
