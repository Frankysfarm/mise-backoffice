/**
 * GET  /api/delivery/admin/driver-feedback              — Dashboard
 * GET  /api/delivery/admin/driver-feedback?action=driver — Einzelfahrer-Zusammenfassung
 * POST /api/delivery/admin/driver-feedback action=prune  — Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getLocationDashboard,
  getDriverFeedbackSummary,
  pruneOldFeedback,
} from '@/lib/delivery/driver-feedback';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp     = req.nextUrl.searchParams;
  const action = sp.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getLocationDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  if (action === 'driver') {
    const driverId = sp.get('driverId');
    if (!driverId) return NextResponse.json({ error: 'driverId erforderlich' }, { status: 400 });
    const days = sp.get('days') ? Number(sp.get('days')) : 30;
    const summary = await getDriverFeedbackSummary(driverId, locationId, days);
    return NextResponse.json({ ok: true, summary });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body   = await req.json() as { action?: string; daysToKeep?: number };
  const action = body.action ?? '';

  if (action === 'prune') {
    const days  = body.daysToKeep ?? 90;
    const result = await pruneOldFeedback(days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
