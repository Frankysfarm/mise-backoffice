/**
 * GET  /api/delivery/admin/driver-ramp-up                     — Dashboard
 * GET  /api/delivery/admin/driver-ramp-up?action=profile&driver_id=… — Einzelprofil
 * GET  /api/delivery/admin/driver-ramp-up?action=compute      — Berechnung triggern
 * POST /api/delivery/admin/driver-ramp-up action=flag         — Coaching-Flag setzen
 * POST /api/delivery/admin/driver-ramp-up action=clear_flag   — Flag zurücksetzen
 * POST /api/delivery/admin/driver-ramp-up action=graduate     — Fahrer abschließen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getRampUpDashboard,
  getRampUpProfile,
  computeRampUpForLocation,
  flagForCoaching,
  clearCoachingFlag,
  graduateDriver,
} from '@/lib/delivery/driver-ramp-up';

export const dynamic = 'force-dynamic';

async function resolveContext(
  req: NextRequest,
): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return { locationId: qp, userId: user.id };

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    try {
      const dashboard = await getRampUpDashboard(ctx.locationId);
      return NextResponse.json({ ok: true, dashboard });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (action === 'profile') {
    const driverId = req.nextUrl.searchParams.get('driver_id');
    if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
    const profile = await getRampUpProfile(driverId, ctx.locationId);
    return NextResponse.json({ ok: true, profile });
  }

  if (action === 'compute') {
    const result = await computeRampUpForLocation(ctx.locationId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as string | undefined;
  const driverId = body.driver_id as string | undefined;

  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  if (action === 'flag') {
    const reason = (body.reason as string | undefined) ?? 'Manuell geflaggt';
    await flagForCoaching(driverId, ctx.locationId, reason, ctx.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'clear_flag') {
    await clearCoachingFlag(driverId, ctx.locationId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'graduate') {
    await graduateDriver(driverId, ctx.locationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
