/**
 * GET /api/delivery/admin/driver-performance
 *   ?driver_id=...&location_id=...&days=14
 *
 * Admin-only: 14-Tage-Trend für einen einzelnen Fahrer (für Sparklines im Dispatch-Leaderboard).
 * Nutzt getDriverHistory() aus lib/delivery/driver-performance.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDriverHistory } from '@/lib/delivery/driver-performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId   = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id');
  const days       = Math.min(Number(searchParams.get('days') ?? 14), 90);

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driver_id und location_id erforderlich' }, { status: 400 });
  }

  const history = await getDriverHistory(driverId, locationId, days);
  return NextResponse.json({ driverId, locationId, days, history });
}
