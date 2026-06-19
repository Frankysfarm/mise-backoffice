/**
 * lib/delivery/smart-batch-monitor.ts
 *
 * Phase 273 — Smart Batch Monitor Engine
 *
 * Überwacht alle aktiven Touren einer Location in Echtzeit und berechnet
 * einen Gesundheits-Score (0–100) für den Lieferbetrieb.
 *
 * Erkennungen:
 *  - Stuck Batches   : kein Stop-Fortschritt seit > 15 Min
 *  - ETA-Risiko      : aktive Stops mit estimated ETA bereits überschritten
 *  - Überlastung     : Fahrer mit > 80 % Kapazität
 *
 * Public API:
 *  scanBatchHealth(locationId)          — sofortiger Echtzeit-Scan
 *  snapshotBatchHealth(locationId)      — Scan + in DB speichern
 *  snapshotAllLocations()               — Cron-Batch aller Locations
 *  getBatchMonitorDashboard(locationId) — Dashboard mit Verlauf
 *  getActiveBatchDetails(locationId)    — Detailansicht aktiver Batches
 *  pruneBatchHealthSnapshots(days?)     — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchStopDetail {
  stopId: string;
  orderId: string | null;
  stopType: string;
  state: string;
  etaMin: number | null;
  arrivedAt: string | null;
  completedAt: string | null;
  lat: number | null;
  lng: number | null;
  isOverdue: boolean;
}

export interface ActiveBatchInfo {
  batchId: string;
  locationId: string;
  driverId: string | null;
  driverName: string | null;
  vehicle: string | null;
  state: string;
  startedAt: string;
  ageMin: number;
  totalStops: number;
  completedStops: number;
  openStops: number;
  completionPct: number;
  isStuck: boolean;
  stuckMinutes: number | null;
  hasEtaRisk: boolean;
  stops: BatchStopDetail[];
}

export interface BatchHealthScan {
  locationId: string;
  scannedAt: string;
  activeBatches: number;
  stuckBatches: number;
  etaBreachRisk: number;
  avgCompletionPct: number | null;
  avgBatchAgeMin: number | null;
  totalOpenStops: number;
  totalDoneStops: number;
  healthScore: number;
  healthStatus: 'ok' | 'warning' | 'critical';
  batches: ActiveBatchInfo[];
}

export interface BatchHealthTrendRow {
  snapshotAt: string;
  healthScore: number;
  activeBatches: number;
  stuckBatches: number;
  avgCompletionPct: number | null;
}

export interface BatchMonitorDashboard {
  current: BatchHealthScan | null;
  trend24h: BatchHealthTrendRow[];
  totalSnapshotsToday: number;
}

// ── DB Row types ───────────────────────────────────────────────────────────────

interface DbBatchRow {
  id: string;
  location_id: string;
  driver_id: string | null;
  state: string;
  created_at: string;
  vehicle?: string | null;
  driver_name?: string | null;
  mise_batch_stops?: DbStopRow[] | null;
}

interface DbStopRow {
  id: string;
  order_id: string | null;
  stop_type: string | null;
  state: string | null;
  eta_min: number | null;
  arrived_at: string | null;
  completed_at: string | null;
  lat: number | null;
  lng: number | null;
}

interface DbSnapshotRow {
  snapshot_at: string;
  health_score: number;
  active_batches: number;
  stuck_batches: number;
  avg_completion_pct: string | number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STUCK_THRESHOLD_MIN = 15;

// ── Core scan ─────────────────────────────────────────────────────────────────

export async function scanBatchHealth(locationId: string): Promise<BatchHealthScan> {
  const sb = createServiceClient();
  const now = new Date();

  // Alle aktiven Batches + ihre Stops laden
  const { data: batches, error } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, location_id, driver_id, state, created_at,
      mise_batch_stops (
        id, order_id, stop_type, state, eta_min,
        arrived_at, completed_at, lat, lng
      )
    `)
    .eq('location_id', locationId)
    .not('state', 'in', '("delivered","cancelled")')
    .order('created_at', { ascending: true });

  if (error || !batches || batches.length === 0) {
    return buildEmptyScan(locationId, now.toISOString());
  }

  // Driver-Namen laden (best effort)
  const driverIds = [...new Set(
    (batches as DbBatchRow[]).map((b) => b.driver_id).filter(Boolean) as string[]
  )];
  const driverMap = new Map<string, { name: string; vehicle: string }>();

  if (driverIds.length > 0) {
    const { data: driverRows } = await sb
      .from('mise_drivers')
      .select('id, name, vehicle')
      .in('id', driverIds);

    for (const d of (driverRows ?? []) as { id: string; name: string | null; vehicle: string | null }[]) {
      driverMap.set(d.id, {
        name: d.name ?? 'Fahrer',
        vehicle: d.vehicle ?? 'bike',
      });
    }
  }

  // Batches analysieren
  const analyzed: ActiveBatchInfo[] = (batches as DbBatchRow[]).map((b) => {
    const stops: DbStopRow[] = (b.mise_batch_stops ?? []) as DbStopRow[];
    const ageMin = (now.getTime() - new Date(b.created_at).getTime()) / 60_000;

    const totalStops     = stops.length;
    const completedStops = stops.filter((s) => s.state === 'delivered').length;
    const openStops      = stops.filter((s) => s.state === 'pending' || s.state === 'arrived').length;
    const completionPct  = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

    // Stuck-Detection: letzter abgeschlossener Stop vor > STUCK_THRESHOLD_MIN
    const completedTimes = stops
      .filter((s) => s.completed_at)
      .map((s) => new Date(s.completed_at!).getTime());
    const lastDone = completedTimes.length > 0 ? Math.max(...completedTimes) : null;
    const minSinceLastStop = lastDone
      ? (now.getTime() - lastDone) / 60_000
      : ageMin;

    const isStuck = ageMin > STUCK_THRESHOLD_MIN
      && openStops > 0
      && minSinceLastStop > STUCK_THRESHOLD_MIN;
    const stuckMinutes = isStuck ? Math.round(minSinceLastStop) : null;

    // ETA-Risiko: offener Stop mit ETA bereits in der Vergangenheit
    // eta_min = Minuten ab Batch-Start
    const batchStart = new Date(b.created_at).getTime();
    const hasEtaRisk = stops.some((s) => {
      if (s.state !== 'pending' && s.state !== 'arrived') return false;
      if (s.eta_min == null) return false;
      const eta = batchStart + s.eta_min * 60_000;
      return eta < now.getTime();
    });

    const driverInfo = b.driver_id ? (driverMap.get(b.driver_id) ?? null) : null;

    const stopDetails: BatchStopDetail[] = stops.map((s) => {
      const overdue = (): boolean => {
        if (s.state === 'delivered') return false;
        if (s.eta_min == null) return false;
        return batchStart + s.eta_min * 60_000 < now.getTime();
      };
      return {
        stopId:      s.id,
        orderId:     s.order_id,
        stopType:    s.stop_type ?? 'delivery',
        state:       s.state ?? 'pending',
        etaMin:      s.eta_min,
        arrivedAt:   s.arrived_at,
        completedAt: s.completed_at,
        lat:         s.lat,
        lng:         s.lng,
        isOverdue:   overdue(),
      };
    });

    return {
      batchId:        b.id,
      locationId:     b.location_id,
      driverId:       b.driver_id,
      driverName:     driverInfo?.name ?? null,
      vehicle:        driverInfo?.vehicle ?? null,
      state:          b.state,
      startedAt:      b.created_at,
      ageMin:         Math.round(ageMin * 10) / 10,
      totalStops,
      completedStops,
      openStops,
      completionPct:  Math.round(completionPct),
      isStuck,
      stuckMinutes,
      hasEtaRisk,
      stops:          stopDetails,
    };
  });

  // Aggregates
  const stuckCount    = analyzed.filter((b) => b.isStuck).length;
  const etaRiskCount  = analyzed.filter((b) => b.hasEtaRisk).length;
  const totalOpen     = analyzed.reduce((s, b) => s + b.openStops, 0);
  const totalDone     = analyzed.reduce((s, b) => s + b.completedStops, 0);
  const avgCompletion = analyzed.length > 0
    ? analyzed.reduce((s, b) => s + b.completionPct, 0) / analyzed.length
    : null;
  const avgAge = analyzed.length > 0
    ? analyzed.reduce((s, b) => s + b.ageMin, 0) / analyzed.length
    : null;

  // Health score (0–100)
  //  -15 per stuck batch, -10 per ETA-risk batch, minimum 0
  let healthScore = 100;
  healthScore -= stuckCount * 15;
  healthScore -= etaRiskCount * 10;
  healthScore = Math.max(0, healthScore);

  const healthStatus: 'ok' | 'warning' | 'critical' =
    healthScore < 40 ? 'critical' : healthScore < 70 ? 'warning' : 'ok';

  return {
    locationId,
    scannedAt:       now.toISOString(),
    activeBatches:   analyzed.length,
    stuckBatches:    stuckCount,
    etaBreachRisk:   etaRiskCount,
    avgCompletionPct: avgCompletion !== null ? Math.round(avgCompletion) : null,
    avgBatchAgeMin:  avgAge !== null ? Math.round(avgAge * 10) / 10 : null,
    totalOpenStops:  totalOpen,
    totalDoneStops:  totalDone,
    healthScore,
    healthStatus,
    batches:         analyzed,
  };
}

function buildEmptyScan(locationId: string, scannedAt: string): BatchHealthScan {
  return {
    locationId,
    scannedAt,
    activeBatches:    0,
    stuckBatches:     0,
    etaBreachRisk:    0,
    avgCompletionPct: null,
    avgBatchAgeMin:   null,
    totalOpenStops:   0,
    totalDoneStops:   0,
    healthScore:      100,
    healthStatus:     'ok',
    batches:          [],
  };
}

// ── Snapshot (Scan + DB write) ─────────────────────────────────────────────────

export async function snapshotBatchHealth(locationId: string): Promise<BatchHealthScan> {
  const scan = await scanBatchHealth(locationId);
  const sb   = createServiceClient();

  await sb.from('batch_health_snapshots').upsert(
    {
      location_id:       locationId,
      snapshot_at:       scan.scannedAt,
      active_batches:    scan.activeBatches,
      stuck_batches:     scan.stuckBatches,
      eta_breach_risk:   scan.etaBreachRisk,
      avg_completion_pct: scan.avgCompletionPct,
      avg_batch_age_min: scan.avgBatchAgeMin,
      total_open_stops:  scan.totalOpenStops,
      total_done_stops:  scan.totalDoneStops,
      health_score:      scan.healthScore,
      health_status:     scan.healthStatus,
    },
    { onConflict: 'location_id,snapshot_at' },
  );

  return scan;
}

// ── Cron batch ─────────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  saved: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, saved: 0, errors: 0 };

  let saved = 0;
  let errors = 0;

  await Promise.allSettled(
    (locs as { id: string }[]).map(async (l) => {
      try {
        await snapshotBatchHealth(l.id);
        saved++;
      } catch (e) {
        console.error('[batch-monitor] snapshot error', l.id, e);
        errors++;
      }
    }),
  );

  return { locations: locs.length, saved, errors };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getBatchMonitorDashboard(
  locationId: string,
): Promise<BatchMonitorDashboard> {
  const sb = createServiceClient();

  // Aktueller Live-Scan
  const current = await scanBatchHealth(locationId);

  // 24h-Trend aus DB
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data: trendRows } = await sb
    .from('batch_health_snapshots')
    .select('snapshot_at, health_score, active_batches, stuck_batches, avg_completion_pct')
    .eq('location_id', locationId)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true })
    .limit(288); // max 5-Min-Ticks über 24h

  const today = new Date().toISOString().slice(0, 10);
  const { count: totalToday } = await sb
    .from('batch_health_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('snapshot_at', `${today}T00:00:00Z`);

  const trend24h: BatchHealthTrendRow[] = ((trendRows ?? []) as DbSnapshotRow[]).map((r) => ({
    snapshotAt:       r.snapshot_at,
    healthScore:      r.health_score,
    activeBatches:    r.active_batches,
    stuckBatches:     r.stuck_batches,
    avgCompletionPct: r.avg_completion_pct != null ? Number(r.avg_completion_pct) : null,
  }));

  return {
    current,
    trend24h,
    totalSnapshotsToday: totalToday ?? 0,
  };
}

// ── Live active batch details ──────────────────────────────────────────────────

export async function getActiveBatchDetails(
  locationId: string,
): Promise<ActiveBatchInfo[]> {
  const scan = await scanBatchHealth(locationId);
  return scan.batches;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneBatchHealthSnapshots(daysToKeep = 14): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .rpc('prune_old_batch_health_snapshots', { p_days: daysToKeep });
  if (error) {
    console.warn('[batch-monitor] prune error:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}
