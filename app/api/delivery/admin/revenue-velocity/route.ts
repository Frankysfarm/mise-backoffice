/**
 * GET  /api/delivery/admin/revenue-velocity
 * POST /api/delivery/admin/revenue-velocity
 *
 * Revenue Velocity Engine (Phase 312):
 * - GET ?action=dashboard → KPIs + Heute-vs-Gestern Chart
 * - POST action=snapshot  → Manueller Snapshot
 * - POST action=prune     → Alte Snapshots löschen
 *
 * Auth: eingeloggter Mitarbeiter (location_id aus employees)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getRevenueVelocityDashboard,
  snapshotRevenueVelocity,
  snapshotRevenueVelocityAllLocations,
  pruneRevenueVelocitySnapshots,
} from '@/lib/delivery/revenue-velocity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocation(req: NextRequest): Promise<string | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb    = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (qsLoc) {
    const svc = createServiceClient();
    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (emp?.tenant_id) return qsLoc;
  }

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocation(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const dashboard = await getRevenueVelocityDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocation(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; all_locations?: boolean; days_old?: number };
  const { action, all_locations, days_old } = body;

  if (action === 'snapshot') {
    if (all_locations) {
      const result = await snapshotRevenueVelocityAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }
    const snap = await snapshotRevenueVelocity(locationId);
    return NextResponse.json({ ok: true, snap });
  }

  if (action === 'prune') {
    const result = await pruneRevenueVelocitySnapshots(days_old ?? 30);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
