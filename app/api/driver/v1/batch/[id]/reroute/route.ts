import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '@/app/api/driver/v1/_lib/driver-auth';
import { rerouteBundle } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optimiert die Stopp-Reihenfolge der Tour via Google Maps (TSP). Vom Fahrer nach "Route berechnen" aufgerufen.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const member = await getDriverFromBearer(req);
  if (!member) return unauthorized();
  const { id } = await ctx.params;

  const { data: batch, error } = await sb()
    .from('mise_delivery_batches')
    .select('id')
    .eq('id', id)
    .eq('driver_id', member.driver.id)
    .in('state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Tour konnte nicht geprüft werden' }, { status: 500 });
  if (!batch) return NextResponse.json({ error: 'Tour gehört nicht zu diesem Fahrer' }, { status: 403 });

  try {
    await rerouteBundle(id);
  } catch (routeError) {
    console.error('[driver/reroute] route calculation failed', routeError);
    return NextResponse.json({ error: 'Route konnte nicht berechnet werden' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
