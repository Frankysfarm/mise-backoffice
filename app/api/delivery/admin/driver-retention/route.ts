import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getRetentionDashboard,
  snapshotAllDriversForLocation,
  takeRetentionAction,
  pruneOldRetentionScores,
  type RetentionActionType,
} from '@/lib/delivery/driver-retention';

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
  // superadmin override
  return req.nextUrl.searchParams.get('location_id');
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getRetentionDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === 'snapshot') {
    const result = await snapshotAllDriversForLocation(locationId);
    return NextResponse.json(result);
  }

  if (action === 'take_action') {
    const { scoreId, driverId, actionType, bonusEur } = body as {
      scoreId: string;
      driverId: string;
      actionType: RetentionActionType;
      bonusEur?: number;
    };
    if (!scoreId || !driverId || !actionType) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const result = await takeRetentionAction({
      scoreId,
      driverId,
      locationId,
      actionType,
      bonusEur,
      takenBy: user?.id,
    });
    return NextResponse.json(result);
  }

  if (action === 'prune') {
    const deleted = await pruneOldRetentionScores(90);
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
