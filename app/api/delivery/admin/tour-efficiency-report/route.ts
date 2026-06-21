/**
 * GET  /api/delivery/admin/tour-efficiency-report
 * POST /api/delivery/admin/tour-efficiency-report
 *
 * Tour-Effizienz-Reporting — Phase 362.
 *
 * GET  ?action=dashboard&days=14   → EfficiencyDashboard (Trend + Benchmarks)
 * POST { action: 'aggregate', day? } → Tages-Aggregation auslösen
 * POST { action: 'prune', days_old? } → Alte Daten löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTourEfficiencyDashboard,
  aggregateTourEfficiencyForDay,
  pruneTourEfficiency,
} from '@/lib/delivery/tour-efficiency-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!emp?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', emp.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const days = Math.min(90, parseInt(searchParams.get('days') ?? '14', 10));
  const dashboard = await getTourEfficiencyDashboard(locationId, days);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    action: string;
    location_id?: string;
    day?: string;
    days_old?: number;
  };

  let locationId = body.location_id;
  if (!locationId) locationId = await resolveLocationId(user.id) ?? undefined;

  switch (body.action) {
    case 'aggregate': {
      if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
      const result = await aggregateTourEfficiencyForDay(locationId, body.day);
      return NextResponse.json(result);
    }
    case 'prune': {
      const result = await pruneTourEfficiency(body.days_old ?? 365);
      return NextResponse.json(result);
    }
    default:
      return NextResponse.json({ error: `Unbekannte action: ${body.action}` }, { status: 400 });
  }
}
