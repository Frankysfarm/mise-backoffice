import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDriverIncentiveSummary } from '@/lib/delivery/driver-incentives';

export const dynamic = 'force-dynamic';

async function resolveDriverAndLocation(req: NextRequest): Promise<{
  driverId: string;
  locationId: string;
} | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return null;
  return { driverId: driver.id, locationId: driver.location_id };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveDriverAndLocation(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await getDriverIncentiveSummary(ctx.driverId, ctx.locationId);
  return NextResponse.json({ ok: true, summary });
}
