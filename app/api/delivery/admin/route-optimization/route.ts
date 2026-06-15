/**
 * GET  /api/delivery/admin/route-optimization?action=dashboard|history|pending
 * POST /api/delivery/admin/route-optimization
 *   { action: 'optimize_all' }
 *   { action: 'optimize_batch', batch_id: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRouteOptimizationDashboard,
  optimizePendingBatches,
  optimizeTourV2,
} from '@/lib/delivery/route-optimizer-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const dashboard = await getRouteOptimizationDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const body = await req.json() as { action?: string; batch_id?: string };

  if (body.action === 'optimize_all') {
    const result = await optimizePendingBatches(locationId);
    return NextResponse.json(result);
  }

  if (body.action === 'optimize_batch') {
    if (!body.batch_id) {
      return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });
    }
    const result = await optimizeTourV2(body.batch_id, locationId);
    if (!result) {
      return NextResponse.json({ error: 'Tour hat weniger als 2 Stopps oder konnte nicht optimiert werden' }, { status: 422 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
