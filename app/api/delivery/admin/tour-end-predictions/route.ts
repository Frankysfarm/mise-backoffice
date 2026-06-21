/**
 * GET/POST /api/delivery/admin/tour-end-predictions
 *
 * Phase 376 — Tour-End-Prognosen Admin API
 *
 * GET  ?action=dashboard          — Dashboard: aktive Prognosen + 7-Tage-Accuracy
 * POST action=predict_now         — Manueller Scan: alle aktiven Touren neu berechnen
 * POST action=settle              — Abgeschlossene Touren auswerten
 * POST action=prune (days_old?)   — Alte Daten bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getTourEndPredictionDashboard,
  predictAllActiveTours,
  settleCompletedTours,
  pruneTourEndPredictions,
} from '@/lib/delivery/tour-end-prediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest, body?: Record<string, unknown>): Promise<string | null> {
  const svc = createServiceClient();
  const { data: { user } } = await svc.auth.getUser();
  if (!user) return null;

  if (body?.location_id) return String(body.location_id);

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getTourEndPredictionDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body ok */ }

  const locationId = await resolveLocationId(req, body);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = (body.action as string | undefined) ?? '';

  if (action === 'predict_now') {
    const result = await predictAllActiveTours(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'settle') {
    const result = await settleCompletedTours(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const daysOld = typeof body.days_old === 'number' ? body.days_old : 30;
    const result = await pruneTourEndPredictions(daysOld);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
