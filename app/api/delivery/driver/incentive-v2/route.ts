/**
 * GET /api/delivery/driver/incentive-v2
 * → Fahrer-Punkte-Zusammenfassung (eigene Punkte, Streak, Fortschritt)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDriverPointsSummary, getConfig } from '@/lib/delivery/driver-incentive-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveContext(req: NextRequest): Promise<{
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
  return { driverId: driver.id as string, locationId: driver.location_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [summary, config] = await Promise.all([
    getDriverPointsSummary(ctx.driverId, ctx.locationId),
    getConfig(ctx.locationId),
  ]);

  return NextResponse.json({ ok: true, summary, config });
}
