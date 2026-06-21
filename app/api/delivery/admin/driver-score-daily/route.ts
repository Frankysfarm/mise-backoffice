/**
 * GET /api/delivery/admin/driver-score-daily
 *
 * ?action=trend&driver_id=<uuid>&days=30  — Täglicher Score-Verlauf für einen Fahrer
 * ?action=summary&date=YYYY-MM-DD         — Alle Fahrer-Scores eines Tages
 * ?action=alerts                          — Offene Performance-Drop-Alerts
 * (keine action)                          — Heutige Summary + offene Alerts
 *
 * POST { action: 'snapshot', date?: string }    — Manuellen Tages-Snapshot auslösen
 * POST { action: 'detect-drops' }               — Alert-Erkennung manuell triggern
 * POST { action: 'acknowledge', alert_id: string } — Alert quittieren
 * POST { action: 'prune', days_old?: number }   — Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  snapshotDailyScoreForLocation,
  detectScoreDropAlerts,
  acknowledgeAlert,
  getDriverDailyScoreTrend,
  getLocationDailyScoreSummary,
  getPendingDropAlerts,
  pruneOldDailySnapshots,
  pruneOldDropAlerts,
} from '@/lib/delivery/driver-score-daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<{ locationId: string; userId: string } | null> {
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
  return { locationId: paramLocation ?? (emp.location_id as string), userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? '';

  // ── Trend für einen Fahrer ─────────────────────────────────────────────────
  if (action === 'trend') {
    const driverId = req.nextUrl.searchParams.get('driver_id');
    if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? '30')));
    const trend = await getDriverDailyScoreTrend(driverId, auth.locationId, days);
    return NextResponse.json({ ok: true, trend, days, driverId });
  }

  // ── Tages-Summary: alle Fahrer ─────────────────────────────────────────────
  if (action === 'summary') {
    const date = req.nextUrl.searchParams.get('date') ?? undefined;
    const summary = await getLocationDailyScoreSummary(auth.locationId, date);
    return NextResponse.json({ ok: true, summary, date: date ?? new Date().toISOString().slice(0, 10) });
  }

  // ── Offene Alerts ──────────────────────────────────────────────────────────
  if (action === 'alerts') {
    const alerts = await getPendingDropAlerts(auth.locationId);
    return NextResponse.json({ ok: true, alerts, count: alerts.length });
  }

  // ── Default: heutige Summary + Alerts ─────────────────────────────────────
  const [summary, alerts] = await Promise.all([
    getLocationDailyScoreSummary(auth.locationId),
    getPendingDropAlerts(auth.locationId),
  ]);

  const svc = createServiceClient();
  const { data: prevRows } = await svc
    .from('driver_score_daily_snapshots')
    .select('driver_id, composite_score')
    .eq('location_id', auth.locationId)
    .eq('snapshot_date', (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })());

  const prevMap = new Map<string, number>(
    ((prevRows ?? []) as { driver_id: string; composite_score: number }[])
      .map((r) => [r.driver_id, Number(r.composite_score)] as [string, number]),
  );

  const summaryWithDelta = summary.map((s) => ({
    ...s,
    scorePrev:  prevMap.get(s.driverId) ?? null,
    scoreDelta: prevMap.has(s.driverId)
      ? Math.round((s.compositeScore - prevMap.get(s.driverId)!) * 100) / 100
      : null,
  }));

  return NextResponse.json({
    ok: true,
    date: new Date().toISOString().slice(0, 10),
    summary: summaryWithDelta,
    alerts,
    pendingAlertCount: alerts.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'snapshot') {
    const date = typeof body.date === 'string' ? body.date : undefined;
    const result = await snapshotDailyScoreForLocation(auth.locationId, date);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'detect-drops') {
    const result = await detectScoreDropAlerts(auth.locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'acknowledge') {
    const alertId = typeof body.alert_id === 'string' ? body.alert_id : null;
    if (!alertId) return NextResponse.json({ error: 'alert_id required' }, { status: 400 });
    await acknowledgeAlert(alertId, auth.locationId, auth.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'prune') {
    const daysOld = typeof body.days_old === 'number' ? body.days_old : 90;
    const [snapsPruned, alertsPruned] = await Promise.all([
      pruneOldDailySnapshots(daysOld),
      pruneOldDropAlerts(60),
    ]);
    return NextResponse.json({ ok: true, snapshots_pruned: snapsPruned.pruned, alerts_pruned: alertsPruned.pruned });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
