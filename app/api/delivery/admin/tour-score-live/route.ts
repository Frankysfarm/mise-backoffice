/**
 * GET /api/delivery/admin/tour-score-live
 *
 * Live-Tour-Score-Übersicht für den Dispatch-Dashboard.
 * Genutzt von DispatchTourScoreLivePanel.
 *
 * Liefert:
 *  - tours: aktive + kürzlich abgeschlossene Touren mit Scores
 *  - summary: aggregierte Schicht-KPIs
 *
 * Score-Formel (0–100):
 *  40% Abschlussfortschritt  (stopsCompleted / stopsTotal)
 *  35% Pünktlichkeit          (ETA noch nicht überschritten)
 *  25% Effizienz-Bonus        (dispatch_score aus der Batch-Tabelle, normiert)
 *
 * Auth: eingeloggter Employee (Admin/Manager).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BatchRow {
  id: string;
  state: string;
  zone: string | null;
  dispatch_score: number | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  estimated_delivery_at: string | null;
  created_at: string;
  mise_drivers: { id: string; name: string | null } | null;
  mise_batch_stops: Array<{ id: string; state: string; stop_type: string }>;
}

interface TourScoreEntry {
  batchId: string;
  driverName: string;
  score: number;
  stopsTotal: number;
  stopsCompleted: number;
  avgDeliveryMin: number | null;
  onTimePct: number;
  distanceKm: number | null;
  status: string;
  zone: string | null;
  startedAt: string | null;
}

interface ShiftScoreSummary {
  avgScore: number;
  topScore: number;
  bottomScore: number;
  tourCount: number;
  completedTours: number;
  totalDeliveries: number;
  onTimePct: number;
  trend: 'up' | 'down' | 'neutral';
}

function computeScore(
  stopsCompleted: number,
  stopsTotal: number,
  estimatedDeliveryAt: string | null,
  dispatchScore: number | null,
): number {
  const progressPct = stopsTotal > 0 ? stopsCompleted / stopsTotal : 0;
  const progressScore = progressPct * 40;

  let punctualityScore = 35;
  if (estimatedDeliveryAt) {
    const etaDiffMin = (new Date(estimatedDeliveryAt).getTime() - Date.now()) / 60_000;
    if (etaDiffMin < -10) punctualityScore = 0;
    else if (etaDiffMin < -5) punctualityScore = 10;
    else if (etaDiffMin < 0) punctualityScore = 20;
    else punctualityScore = 35;
  }

  const efficiencyScore = dispatchScore != null
    ? (dispatchScore / 100) * 25
    : 17.5;

  return Math.min(100, Math.max(0, Math.round(progressScore + punctualityScore + efficiencyScore)));
}

function stateToStatus(state: string): string {
  switch (state) {
    case 'on_route':           return 'unterwegs';
    case 'at_restaurant':      return 'abholung';
    case 'assigned':           return 'zugewiesen';
    case 'pending_acceptance': return 'ausstehend';
    case 'completed':
    case 'delivered':          return 'abgeschlossen';
    default:                   return state;
  }
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId: string | null =
    (emp?.location_id as string | null) ??
    new URL(req.url).searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'Kein Standort' }, { status: 400 });
  }

  const svc = createServiceClient();

  const activeStates = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'completed'];

  const { data: batches, error } = await svc
    .from('mise_delivery_batches')
    .select(`
      id,
      state,
      zone,
      dispatch_score,
      total_distance_km,
      total_eta_min,
      estimated_delivery_at,
      created_at,
      mise_drivers!driver_id(id, name),
      mise_batch_stops(id, state, stop_type)
    `)
    .eq('location_id', locationId)
    .in('state', activeStates)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tours: TourScoreEntry[] = (batches as unknown as BatchRow[] ?? []).map(batch => {
    const allStops = Array.isArray(batch.mise_batch_stops) ? batch.mise_batch_stops : [];
    const dropoffStops = allStops.filter(s => s.stop_type === 'dropoff');
    const stopsTotal = dropoffStops.length;
    const stopsCompleted = dropoffStops.filter(s => s.state === 'delivered').length;

    const driverName = (batch.mise_drivers as { name: string | null } | null)?.name ?? 'Fahrer';

    const score = computeScore(
      stopsCompleted,
      stopsTotal,
      batch.estimated_delivery_at,
      batch.dispatch_score,
    );

    // Avg delivery time = elapsed since creation / completed stops (rough proxy)
    const elapsedMin = (Date.now() - new Date(batch.created_at).getTime()) / 60_000;
    const avgDeliveryMin = stopsCompleted > 0
      ? Math.round(elapsedMin / stopsCompleted)
      : batch.total_eta_min != null && stopsTotal > 0
        ? Math.round(batch.total_eta_min / stopsTotal)
        : null;

    // On-time pct: estimate from ETA window and elapsed time
    let onTimePct = 85;
    if (batch.estimated_delivery_at) {
      const etaDiffMin = (new Date(batch.estimated_delivery_at).getTime() - Date.now()) / 60_000;
      if (etaDiffMin < -10) onTimePct = 30;
      else if (etaDiffMin < -5) onTimePct = 55;
      else if (etaDiffMin < 0) onTimePct = 70;
      else onTimePct = 90;
    }

    return {
      batchId: batch.id,
      driverName,
      score,
      stopsTotal,
      stopsCompleted,
      avgDeliveryMin,
      onTimePct,
      distanceKm: batch.total_distance_km,
      status: stateToStatus(batch.state),
      zone: batch.zone,
      startedAt: batch.created_at,
    };
  });

  const activeTours = tours.filter(t => t.status !== 'abgeschlossen');
  const completedTours = tours.filter(t => t.status === 'abgeschlossen');

  const allScores = tours.map(t => t.score);
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 0;
  const topScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const bottomScore = allScores.length > 0 ? Math.min(...allScores) : 0;
  const totalDeliveries = tours.reduce((s, t) => s + t.stopsCompleted, 0);
  const avgOnTimePct = tours.length > 0
    ? Math.round(tours.reduce((s, t) => s + t.onTimePct, 0) / tours.length)
    : 0;

  const summary: ShiftScoreSummary = {
    avgScore,
    topScore,
    bottomScore,
    tourCount: tours.length,
    completedTours: completedTours.length,
    totalDeliveries,
    onTimePct: avgOnTimePct,
    trend: avgScore >= 75 ? 'up' : avgScore >= 60 ? 'neutral' : 'down',
  };

  return NextResponse.json({ tours, summary });
}
