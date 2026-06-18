import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDriverSatisfaction } from '@/lib/delivery/driver-satisfaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driverId');
  const locationId = req.nextUrl.searchParams.get('locationId');

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'Missing driverId or locationId' }, { status: 400 });
  }

  // Verify driver belongs to this location
  const svc = createServiceClient();
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  const score = await getDriverSatisfaction(locationId, driverId);
  return NextResponse.json(score);
}
