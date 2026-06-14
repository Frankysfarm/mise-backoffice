import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getLossMakingTrips,
  getDriverCostProfile,
  computeRecentBatches,
  upsertConfig,
  getOrCreateConfig,
  type CostConfigInput,
} from '@/lib/delivery/trip-cost-intelligence';

export const dynamic = 'force-dynamic';

async function resolveLocationId(): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (data as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const data = await getDashboard(locationId);
      return NextResponse.json(data);
    }

    if (action === 'config') {
      const cfg = await getOrCreateConfig(locationId);
      return NextResponse.json(cfg);
    }

    if (action === 'loss_trips') {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');
      const trips = await getLossMakingTrips(locationId, Math.min(limit, 50));
      return NextResponse.json({ trips });
    }

    if (action === 'driver_costs') {
      const drivers = await getDriverCostProfile(locationId);
      return NextResponse.json({ drivers });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (body.action as string) ?? '';

  try {
    if (action === 'compute') {
      const hours = Number(body.hours ?? 48);
      const result = await computeRecentBatches(locationId, Math.min(hours, 168));
      return NextResponse.json(result);
    }

    if (action === 'upsert_config') {
      const input: CostConfigInput = {
        costDriverHourlyEur: body.costDriverHourlyEur as number | undefined,
        costPerKmBicycleEur: body.costPerKmBicycleEur as number | undefined,
        costPerKmEbikeEur: body.costPerKmEbikeEur as number | undefined,
        costPerKmScooterEur: body.costPerKmScooterEur as number | undefined,
        costPerKmMopedEur: body.costPerKmMopedEur as number | undefined,
        costPerKmCarEur: body.costPerKmCarEur as number | undefined,
        costPackagingEur: body.costPackagingEur as number | undefined,
        costInsurancePerDel: body.costInsurancePerDel as number | undefined,
        platformFeePct: body.platformFeePct as number | undefined,
      };
      const cfg = await upsertConfig(locationId, input);
      return NextResponse.json(cfg);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
