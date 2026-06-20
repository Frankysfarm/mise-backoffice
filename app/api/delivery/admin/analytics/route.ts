/**
 * GET  /api/delivery/admin/analytics
 * POST /api/delivery/admin/analytics
 *
 * Phase 320 — Delivery Analytics Dashboard API
 *
 * GET  ?action=dashboard  → Live-KPIs + 30-Tage-Trend + Top-Fahrer + Wochenvergleich
 * POST action=snapshot    → Snapshot für Vortag manuell auslösen
 * POST action=prune       → Alte Snapshots löschen (Standard: 90 Tage)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getAnalyticsDashboard,
  snapshotAllLocations,
  pruneOldSnapshots,
} from '@/lib/delivery/delivery-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocation(req: NextRequest): Promise<string | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb     = await createClient();
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

  try {
    const dashboard = await getAnalyticsDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocation(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    days_old?: number;
  };

  if (body.action === 'snapshot') {
    const result = await snapshotAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === 'prune') {
    const result = await pruneOldSnapshots(body.days_old ?? 90);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
