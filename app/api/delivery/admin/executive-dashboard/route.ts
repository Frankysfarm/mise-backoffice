/**
 * GET  /api/delivery/admin/executive-dashboard
 *
 * ?action=live    (default) — Live-KPIs aus allen Quellen (kein Cache)
 * ?action=history&days=30   — Tages-Snapshots aus executive_kpi_snapshots
 * ?location_id=<uuid>       — Standort-Override für Admins mit Mehrfachstandort
 *
 * POST /api/delivery/admin/executive-dashboard
 * { action: 'snapshot', date?: 'YYYY-MM-DD' }  — Manueller Tages-Snapshot
 * { action: 'catchup',  days_back?: number }    — Schicht-ROI Gap-Fill
 * { action: 'prune',    days_to_keep?: number } — Cleanup alte Snapshots
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getExecutiveDashboard,
  getExecutiveKpiHistory,
  snapshotExecutiveKpi,
  pruneExecutiveKpiSnapshots,
} from '@/lib/delivery/executive-dashboard';
import { catchupSchichtRoiDaily } from '@/lib/delivery/schicht-roi-daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<{ locationId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id || !['admin', 'manager', 'dispatcher'].includes(emp.rolle)) return null;

  const paramLocation = req.nextUrl.searchParams.get('location_id');
  return { locationId: paramLocation ?? emp.location_id };
}

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'live';

  if (action === 'history') {
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? '30')));
    const history = await getExecutiveKpiHistory(auth.locationId, days);
    return NextResponse.json({ ok: true, history, days });
  }

  // live (default)
  const kpis = await getExecutiveDashboard(auth.locationId);
  return NextResponse.json({ ok: true, ...kpis });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'snapshot') {
    const date = typeof body.date === 'string' ? body.date : undefined;
    const result = await snapshotExecutiveKpi(auth.locationId, date);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'catchup') {
    const daysBack = Math.min(30, Math.max(1, Number(body.days_back ?? 3)));
    const result = await catchupSchichtRoiDaily(auth.locationId, daysBack, 'manual');
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const daysToKeep = Math.min(730, Math.max(30, Number(body.days_to_keep ?? 365)));
    const result = await pruneExecutiveKpiSnapshots(daysToKeep);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
