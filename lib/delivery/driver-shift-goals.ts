/**
 * lib/delivery/driver-shift-goals.ts — Phase 314
 *
 * Fahrer-Ziel-Engine: Schicht-Ziele (Stops / € / Score) je Fahrer.
 *
 * Admins konfigurieren Location-weite Defaults.
 * Cron berechnet stündlich den Fortschritt je aktiven Fahrer.
 * Fahrer sehen ihre eigene Fortschrittsanzeige in der Fahrer-App.
 *
 * Funktionen:
 *   getDriverShiftGoalConfig(locationId)         — Konfiguration (mit Defaults)
 *   upsertDriverShiftGoalConfig(locationId, cfg) — Admin-Speicherung
 *   computeDriverProgress(driverId, locationId)  — Aktuellen Fortschritt berechnen
 *   snapshotDriverShiftGoals(locationId)         — Alle aktiven Fahrer snapshotten
 *   snapshotDriverShiftGoalsAllLocations()       — Cron-Wrapper
 *   getDriverShiftGoalDashboard(locationId)      — Admin-Dashboard
 *   getMyShiftGoalProgress(driverId, locationId) — Fahrer-eigene Ansicht
 *   pruneDriverShiftGoalSnapshots(days)          — Cleanup via DB-Funktion
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface DriverShiftGoalConfig {
  targetStops: number;
  targetEarningsEur: number;
  targetScore: number;
  shiftStartHour: number;   // UTC
  shiftHoursTotal: number;
}

export type PaceLabel = 'ahead' | 'on_track' | 'behind' | 'not_started';

export interface DriverShiftProgress {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  currentState: string | null;

  stopsCompleted: number;
  earningsEur: number;
  liveScore: number;

  targetStops: number;
  targetEarningsEur: number;
  targetScore: number;

  shiftPctElapsed: number;   // 0..1
  stopsPct: number;          // completed / target
  earningsPct: number;
  scorePct: number;

  stopsPace: PaceLabel;
  earningsPace: PaceLabel;
  scorePace: PaceLabel;

  overallPace: PaceLabel;
  snapshotAt: string;
}

export interface DriverShiftGoalDashboard {
  locationId: string;
  generatedAt: string;
  config: DriverShiftGoalConfig;
  shiftStart: string;
  shiftEnd: string;
  shiftPctElapsed: number;
  drivers: DriverShiftProgress[];
  summary: {
    activeDrivers: number;
    avgStopsPct: number;
    avgEarningsPct: number;
    avgScorePct: number;
    aheadCount: number;
    onTrackCount: number;
    behindCount: number;
  };
}

// ─── Interne Hilfsfunktionen ──────────────────────────────────────────────────

function computePace(actual: number, target: number, shiftPct: number): PaceLabel {
  if (shiftPct <= 0) return 'not_started';
  if (target <= 0) return 'on_track';
  const expected = target * shiftPct;
  const ratio = actual / expected;
  if (ratio >= 1.1) return 'ahead';
  if (ratio >= 0.85) return 'on_track';
  return 'behind';
}

function overallPace(a: PaceLabel, b: PaceLabel, c: PaceLabel): PaceLabel {
  const score = (p: PaceLabel) => p === 'ahead' ? 2 : p === 'on_track' ? 1 : p === 'behind' ? 0 : 1;
  const avg = (score(a) + score(b) + score(c)) / 3;
  if (avg >= 1.7) return 'ahead';
  if (avg >= 0.85) return 'on_track';
  return 'behind';
}

function shiftWindow(cfg: DriverShiftGoalConfig): { start: Date; end: Date; pctElapsed: number } {
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10);
  const start = new Date(`${todayUTC}T${String(cfg.shiftStartHour).padStart(2, '0')}:00:00Z`);
  if (start > now) start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(start.getTime() + cfg.shiftHoursTotal * 3_600_000);
  const pct = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (cfg.shiftHoursTotal * 3_600_000)));
  return { start, end, pctElapsed: pct };
}

// ─── Öffentliche Funktionen ───────────────────────────────────────────────────

export async function getDriverShiftGoalConfig(locationId: string): Promise<DriverShiftGoalConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_shift_goal_configs')
    .select('target_stops,target_earnings_eur,target_score,shift_start_hour,shift_hours_total')
    .eq('location_id', locationId)
    .maybeSingle();

  const row = data as {
    target_stops?: number;
    target_earnings_eur?: number;
    target_score?: number;
    shift_start_hour?: number;
    shift_hours_total?: number;
  } | null;

  return {
    targetStops:       row?.target_stops        ?? 12,
    targetEarningsEur: Number(row?.target_earnings_eur ?? 80),
    targetScore:       row?.target_score         ?? 75,
    shiftStartHour:    row?.shift_start_hour     ?? 10,
    shiftHoursTotal:   row?.shift_hours_total    ?? 8,
  };
}

export async function upsertDriverShiftGoalConfig(
  locationId: string,
  cfg: Partial<DriverShiftGoalConfig>,
): Promise<void> {
  const sb = createServiceClient();
  const row: Record<string, unknown> = { location_id: locationId };
  if (cfg.targetStops       !== undefined) row.target_stops        = cfg.targetStops;
  if (cfg.targetEarningsEur !== undefined) row.target_earnings_eur = cfg.targetEarningsEur;
  if (cfg.targetScore       !== undefined) row.target_score        = cfg.targetScore;
  if (cfg.shiftStartHour    !== undefined) row.shift_start_hour    = cfg.shiftStartHour;
  if (cfg.shiftHoursTotal   !== undefined) row.shift_hours_total   = cfg.shiftHoursTotal;

  await sb
    .from('driver_shift_goal_configs')
    .upsert(row, { onConflict: 'location_id' });
}

export async function computeDriverProgress(
  driverId: string,
  locationId: string,
  cfg: DriverShiftGoalConfig,
): Promise<Omit<DriverShiftProgress, 'driverName' | 'vehicle' | 'currentState'>> {
  const sb = createServiceClient();
  const { start, pctElapsed } = shiftWindow(cfg);
  const sinceIso = start.toISOString();

  const [tourRes, liveScoreRes] = await Promise.all([
    // Stops & Earnings aus abgeschlossenen Tour-Stops im Schichtfenster
    sb
      .from('delivery_tour_stops')
      .select('id,status,order_id')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .eq('status', 'geliefert')
      .gte('updated_at', sinceIso),

    // Letzter Live-Score aus driver_live_score_snapshots
    sb
      .from('driver_live_score_snapshots')
      .select('live_score')
      .eq('driver_id', driverId)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stops = (tourRes.data as { id: string; status: string; order_id: string }[] | null) ?? [];
  const orderIds = stops.map((s) => s.order_id).filter(Boolean);

  // Verdienst aus abgeschlossenen Bestellungen
  let earningsEur = 0;
  if (orderIds.length > 0) {
    const { data: orders } = await sb
      .from('customer_orders')
      .select('gesamtbetrag,liefergebuehr')
      .in('id', orderIds)
      .eq('location_id', locationId);
    earningsEur = (orders as { gesamtbetrag: number | null; liefergebuehr: number | null }[] | null ?? [])
      .reduce((s, o) => s + Number(o.liefergebuehr ?? o.gesamtbetrag ?? 0), 0);
  }

  const liveScore = (liveScoreRes.data as { live_score?: number } | null)?.live_score ?? 0;
  const stopsCompleted = stops.length;

  const stopsPace    = computePace(stopsCompleted, cfg.targetStops, pctElapsed);
  const earningsPace = computePace(earningsEur, cfg.targetEarningsEur, pctElapsed);
  const scorePace: PaceLabel = liveScore >= cfg.targetScore
    ? 'ahead'
    : liveScore >= cfg.targetScore * 0.85
      ? 'on_track'
      : 'behind';

  return {
    driverId,
    stopsCompleted,
    earningsEur: Math.round(earningsEur * 100) / 100,
    liveScore,
    targetStops:       cfg.targetStops,
    targetEarningsEur: cfg.targetEarningsEur,
    targetScore:       cfg.targetScore,
    shiftPctElapsed:   Math.round(pctElapsed * 1000) / 1000,
    stopsPct:    cfg.targetStops       > 0 ? stopsCompleted / cfg.targetStops       : 0,
    earningsPct: cfg.targetEarningsEur > 0 ? earningsEur    / cfg.targetEarningsEur : 0,
    scorePct:    cfg.targetScore       > 0 ? liveScore      / cfg.targetScore        : 0,
    stopsPace,
    earningsPace,
    scorePace,
    overallPace: overallPace(stopsPace, earningsPace, scorePace),
    snapshotAt: new Date().toISOString(),
  };
}

export async function snapshotDriverShiftGoals(
  locationId: string,
): Promise<{ saved: number; errors: number }> {
  const sb = createServiceClient();
  const cfg = await getDriverShiftGoalConfig(locationId);

  // Alle aktiven Fahrer dieser Location
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id,current_state')
    .eq('location_id', locationId)
    .eq('active', true)
    .not('current_state', 'eq', 'offline');

  if (!drivers || drivers.length === 0) return { saved: 0, errors: 0 };

  let saved = 0;
  let errors = 0;

  for (const d of drivers as { id: string; current_state: string | null }[]) {
    try {
      const prog = await computeDriverProgress(d.id, locationId, cfg);
      await sb.from('driver_shift_goal_snapshots').insert({
        driver_id:           d.id,
        location_id:         locationId,
        stops_completed:     prog.stopsCompleted,
        earnings_eur:        prog.earningsEur,
        live_score:          prog.liveScore,
        target_stops:        cfg.targetStops,
        target_earnings_eur: cfg.targetEarningsEur,
        target_score:        cfg.targetScore,
        shift_pct_elapsed:   prog.shiftPctElapsed,
        stops_pace:          prog.stopsPace,
        earnings_pace:       prog.earningsPace,
        score_pace:          prog.scorePace,
      });
      saved++;
    } catch {
      errors++;
    }
  }

  return { saved, errors };
}

export async function snapshotDriverShiftGoalsAllLocations(): Promise<{
  locations: number;
  saved: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('aktiv', true);
  if (!locs || locs.length === 0) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    (locs as { id: string }[]).map((l) => snapshotDriverShiftGoals(l.id)),
  );

  let saved = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      saved  += r.value.saved;
      errors += r.value.errors;
    } else {
      errors++;
    }
  }

  return { locations: locs.length, saved, errors };
}

export async function getDriverShiftGoalDashboard(
  locationId: string,
): Promise<DriverShiftGoalDashboard> {
  const sb = createServiceClient();
  const cfg = await getDriverShiftGoalConfig(locationId);
  const { start, end, pctElapsed } = shiftWindow(cfg);

  // Alle aktiven Fahrer mit ihren Namen
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id,name,vehicle,current_state')
    .eq('location_id', locationId)
    .eq('active', true)
    .not('current_state', 'eq', 'offline');

  const driverRows = (drivers as {
    id: string;
    name: string | null;
    vehicle: string | null;
    current_state: string | null;
  }[] | null) ?? [];

  const progressList = await Promise.all(
    driverRows.map(async (d) => {
      const prog = await computeDriverProgress(d.id, locationId, cfg);
      return {
        ...prog,
        driverName:   d.name,
        vehicle:      d.vehicle,
        currentState: d.current_state,
      } as DriverShiftProgress;
    }),
  );

  const activeCount = progressList.length;
  const avgStopsPct    = activeCount > 0 ? progressList.reduce((s, p) => s + p.stopsPct, 0)    / activeCount : 0;
  const avgEarningsPct = activeCount > 0 ? progressList.reduce((s, p) => s + p.earningsPct, 0) / activeCount : 0;
  const avgScorePct    = activeCount > 0 ? progressList.reduce((s, p) => s + p.scorePct, 0)    / activeCount : 0;

  const aheadCount   = progressList.filter((p) => p.overallPace === 'ahead').length;
  const onTrackCount = progressList.filter((p) => p.overallPace === 'on_track').length;
  const behindCount  = progressList.filter((p) => p.overallPace === 'behind').length;

  return {
    locationId,
    generatedAt:     new Date().toISOString(),
    config:          cfg,
    shiftStart:      start.toISOString(),
    shiftEnd:        end.toISOString(),
    shiftPctElapsed: pctElapsed,
    drivers:         progressList.sort((a, b) => b.stopsCompleted - a.stopsCompleted),
    summary: {
      activeDrivers: activeCount,
      avgStopsPct:    Math.round(avgStopsPct * 1000) / 1000,
      avgEarningsPct: Math.round(avgEarningsPct * 1000) / 1000,
      avgScorePct:    Math.round(avgScorePct * 1000) / 1000,
      aheadCount,
      onTrackCount,
      behindCount,
    },
  };
}

export async function getMyShiftGoalProgress(
  driverId: string,
  locationId: string,
): Promise<DriverShiftProgress | null> {
  const sb = createServiceClient();
  const cfg = await getDriverShiftGoalConfig(locationId);

  const { data: d } = await sb
    .from('mise_drivers')
    .select('name,vehicle,current_state')
    .eq('id', driverId)
    .maybeSingle();

  if (!d) return null;

  const row = d as { name: string | null; vehicle: string | null; current_state: string | null };
  const prog = await computeDriverProgress(driverId, locationId, cfg);

  return {
    ...prog,
    driverName:   row.name,
    vehicle:      row.vehicle,
    currentState: row.current_state,
  };
}

export async function pruneDriverShiftGoalSnapshots(
  daysOld = 7,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_driver_shift_goal_snapshots', { days_old: daysOld });
  return { pruned: (data as number | null) ?? 0 };
}
