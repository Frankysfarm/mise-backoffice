import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getSatisfactionDashboard,
  getDriverSatisfaction,
  snapshotAllLocations,
  pruneOldScores,
} from '@/lib/delivery/driver-satisfaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (emp?.location_id) return emp.location_id as string;
  return req.nextUrl.searchParams.get('location_id');
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getSatisfactionDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  if (action === 'driver') {
    const driverId = req.nextUrl.searchParams.get('driverId');
    if (!driverId) return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
    const score = await getDriverSatisfaction(locationId, driverId);
    return NextResponse.json(score);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === 'snapshot') {
    const result = await snapshotAllLocations();
    return NextResponse.json(result);
  }

  if (action === 'prune') {
    const deleted = await pruneOldScores(90);
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
