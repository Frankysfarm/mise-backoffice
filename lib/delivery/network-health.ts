/**
 * lib/delivery/network-health.ts
 *
 * Phase 206 — Smart Delivery Network Health Engine
 *
 * Berechnet einen 7-Faktoren-Komposit-Score (0–100) für den gesamten
 * Lieferbetrieb — analoges Konzept zum Driver-Composite-Score (Phase 205),
 * aber für das gesamte Netzwerk einer Location.
 *
 * Faktoren:
 *  f_on_time       (0–25) — On-Time-Rate der letzten 24 h (delivery_performance)
 *  f_satisfaction  (0–20) — Ø Kundenbewertung letzte 7 Tage (customer_delivery_ratings)
 *  f_utilization   (0–15) — Fahrer-Auslastung (aktive Tours / online Fahrer)
 *  f_dispatch      (0–15) — Ø Dispatch-Wartezeit bis Batch-Zuweisung
 *  f_cancellation  (0–10) — inverse Stornierungsrate 24 h
 *  f_capacity      (0–10) — Balance: online Fahrer vs. offene Bestellungen
 *  f_profitability (0–5)  — Marge aus letztem Profitabilitäts-Snapshot
 *
 * Grade: excellent(≥85) · good(≥70) · fair(≥50) · poor(≥30) · critical(<30)
 *
 * Exports:
 *  computeNetworkHealth()       — Score berechnen (kein Speichern)
 *  snapshotNetworkHealth()      — berechnen + in DB speichern
 *  snapshotAllLocations()       — Cron-Batch
 *  getNetworkHealthDashboard()  — Admin-Dashboard-Daten
 *  getNetworkHealthTrend()      — stündlicher 7-Tage-Verlauf
 *  pruneOldNetworkSnapshots()   — Cleanup via SQL-Funktion
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type NetworkGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface NetworkHealthResult {
  locationId: string;
  capturedAt: string;
  healthScore: number;
  grade: NetworkGrade;
  fOnTime: number;
  fSatisfaction: number;
  fUtilization: number;
  fDispatch: number;
  fCancellation: number;
  fCapacity: number;
  fProfitability: number;
  // Rohdaten
  onTimeRatePct: number | null;
  avgRating: number | null;
  driverUtilizationPct: number | null;
  avgDispatchWaitMin: number | null;
  cancellationRatePct: number | null;
  activeDrivers: number;
  pendingOrders: number;
}

export interface NetworkHealthSnapshot extends NetworkHealthResult {
  id: string;
}

export interface NetworkHealthTrendPoint {
  hour: string;
  avgScore: number;
  avgOnTime: number;
  avgSatisfaction: number;
  avgUtilization: number;
  avgDispatch: number;
  avgCancellation: number;
  avgCapacity: number;
  avgProfitability: number;
  snapshotCount: number;
}

export interface NetworkHealthDashboard {
  current: NetworkHealthSnapshot | null;
  trend7d: NetworkHealthTrendPoint[];
  recentSnapshots: NetworkHealthSnapshot[];
  insights: NetworkInsight[];
}

export interface NetworkInsight {
  factor: string;
  label: string;
  score: number;
  maxScore: number;
  pct: number;
  severity: 'ok' | 'warn' | 'critical';
  hint: string;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function gradeFromScore(score: number): NetworkGrade {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

function scoreOnTime(ratePct: number | null): number {
  const r = ratePct ?? 80;
  return Math.round(Math.min(25, Math.max(0, (r / 100) * 25)) * 100) / 100;
}

function scoreSatisfaction(avgRating: number | null): number {
  const r = avgRating ?? 4.0;
  return Math.round(Math.min(20, Math.max(0, ((r - 1) / 4) * 20)) * 100) / 100;
}

function scoreUtilization(utilizationPct: number | null): number {
  const u = utilizationPct ?? 60;
  // Optimal 65–80 % → 15 Pkt; <30 % → 0 (Unterauslastung); >95 % → 8 (Überlastung)
  if (u >= 95) return Math.round((8 + ((100 - u) / 5) * 7) * 100) / 100;
  if (u >= 65) return Math.round(Math.min(15, 8 + ((u - 65) / 30) * 7) * 100) / 100;
  return Math.round(Math.max(0, (u / 65) * 8) * 100) / 100;
}

function scoreDispatch(avgWaitMin: number | null): number {
  const w = avgWaitMin ?? 8;
  // ≤ 3 Min → 15 Pkt; 10 Min → 8 Pkt; ≥ 25 Min → 0 Pkt
  if (w <= 3) return 15;
  if (w >= 25) return 0;
  return Math.round(Math.max(0, 15 - (w - 3) / 22 * 15) * 100) / 100;
}

function scoreCancellation(ratePct: number | null): number {
  const r = ratePct ?? 3;
  // 0 % → 10 Pkt; 5 % → 6 Pkt; ≥ 15 % → 0 Pkt
  if (r <= 0) return 10;
  if (r >= 15) return 0;
  return Math.round(Math.max(0, 10 - (r / 15) * 10) * 100) / 100;
}

function scoreCapacity(activeDrivers: number, pendingOrders: number): number {
  const ratio = pendingOrders === 0 ? 2 : activeDrivers / pendingOrders;
  // ratio ≥ 2 → 10 Pkt; 1 → 5 Pkt; ≤ 0 → 0 Pkt
  return Math.round(Math.min(10, Math.max(0, ratio * 5)) * 100) / 100;
}

function scoreProfitability(marginPct: number | null): number {
  const m = marginPct ?? 20;
  // ≥ 35 % → 5 Pkt; 20 % → 2.5 Pkt; ≤ 0 % → 0 Pkt
  return Math.round(Math.min(5, Math.max(0, (m / 35) * 5)) * 100) / 100;
}

// ─── Kern-Berechnung ─────────────────────────────────────────────────────────

export async function computeNetworkHealth(locationId: string): Promise<NetworkHealthResult> {
  const sb = createServiceClient();
  const now = new Date();
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7ago  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();

  // Alle 7 Datenquellen parallel laden
  const [
    perfData,
    ratingsData,
    activeBatchesData,
    onlineDriversData,
    dispatchWaitData,
    cancellationData,
    profitData,
  ] = await Promise.all([

    // 1. On-Time-Rate (letzte 24 h)
    sb.from('delivery_performance')
      .select('on_time')
      .eq('location_id', locationId)
      .gte('completed_at', h24ago)
      .limit(500),

    // 2. Kundenbewertungen (letzte 7 Tage)
    sb.from('customer_delivery_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', d7ago)
      .limit(200),

    // 3. Aktive Touren (als Proxy für ausgelastete Fahrer)
    sb.from('mise_delivery_batches')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('state', ['assigned', 'at_restaurant', 'on_route']),

    // 4. Alle aktiven Fahrer (systemweit — mise_drivers hat keine location_id)
    sb.from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']),

    // 5. Dispatch-Wartezeit: kürzlich zugewiesene Bestellungen
    //    bestellt_am (order) → batch created_at als Proxy für Wartezeit
    sb.from('customer_orders')
      .select('bestellt_am, mise_batch_id')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .not('mise_batch_id', 'is', null)
      .gte('bestellt_am', h24ago)
      .limit(200),

    // 6. Stornierungsrate (letzte 24 h)
    sb.from('customer_orders')
      .select('status')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('bestellt_am', h24ago)
      .limit(500),

    // 7. Profitabilitäts-Snapshot (letzter verfügbarer)
    sb.from('delivery_profitability_snapshots')
      .select('margin_pct')
      .eq('location_id', locationId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── 1. On-Time-Rate ──────────────────────────────────────────────────────────
  const perfRows = (perfData.data ?? []) as { on_time: boolean | null }[];
  const totalPerf = perfRows.length;
  const onTimeCount = perfRows.filter((r) => r.on_time === true).length;
  const onTimeRatePct = totalPerf > 0 ? Math.round((onTimeCount / totalPerf) * 100 * 10) / 10 : null;

  // ── 2. Kundenbewertung ───────────────────────────────────────────────────────
  const ratingRows = (ratingsData.data ?? []) as { rating: number }[];
  const avgRating = ratingRows.length > 0
    ? Math.round((ratingRows.reduce((s, r) => s + Number(r.rating), 0) / ratingRows.length) * 100) / 100
    : null;

  // ── 3 + 4. Fahrer-Auslastung ─────────────────────────────────────────────────
  const activeBatches = activeBatchesData.count ?? 0;
  const onlineDrivers = onlineDriversData.count ?? 0;
  const driverUtilizationPct = onlineDrivers > 0
    ? Math.round((activeBatches / onlineDrivers) * 100 * 10) / 10
    : null;

  // ── 5. Dispatch-Wartezeit ────────────────────────────────────────────────────
  // Wir haben `bestellt_am` pro Order, aber nicht den genauen Batch-Startzeitpunkt.
  // Als Proxy: kürzlich zugewiesene Batches abrufen und ihre created_at mit bestellt_am vergleichen.
  const waitOrders = (dispatchWaitData.data ?? []) as { bestellt_am: string; mise_batch_id: string }[];
  let avgDispatchWaitMin: number | null = null;

  if (waitOrders.length > 0) {
    const batchIds = [...new Set(waitOrders.map((o) => o.mise_batch_id))].slice(0, 100);
    if (batchIds.length > 0) {
      const { data: batchRows } = await sb
        .from('mise_delivery_batches')
        .select('id, created_at')
        .in('id', batchIds);

      type BatchRow = { id: string; created_at: string };
      const typedBatchRows = (batchRows ?? []) as BatchRow[];
      const batchCreatedAt = new Map<string, string>(
        typedBatchRows.map((b) => [b.id, b.created_at]),
      );

      const waits: number[] = [];
      for (const o of waitOrders) {
        const batchAt = batchCreatedAt.get(o.mise_batch_id);
        if (batchAt && o.bestellt_am) {
          const wait = (new Date(batchAt).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          if (wait >= 0 && wait < 120) waits.push(wait);
        }
      }
      if (waits.length > 0) {
        avgDispatchWaitMin = Math.round((waits.reduce((s, w) => s + w, 0) / waits.length) * 10) / 10;
      }
    }
  }

  // ── 6. Stornierungsrate ──────────────────────────────────────────────────────
  const allOrders = (cancellationData.data ?? []) as { status: string }[];
  const cancelledCount = allOrders.filter((o) => o.status === 'storniert').length;
  const cancellationRatePct = allOrders.length > 0
    ? Math.round((cancelledCount / allOrders.length) * 100 * 10) / 10
    : null;

  // Offene Bestellungen ohne Batch (für Capacity-Score)
  const { count: pendingCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .not('status', 'in', '(storniert,abgeschlossen,geliefert)');
  const pendingOrders = pendingCount ?? 0;

  // ── 7. Profitabilitäts-Marge ─────────────────────────────────────────────────
  const marginPct = profitData.data
    ? (profitData.data as { margin_pct: number | null }).margin_pct
    : null;

  // ── Faktorscores berechnen ───────────────────────────────────────────────────
  const fOnTime       = scoreOnTime(onTimeRatePct);
  const fSatisfaction = scoreSatisfaction(avgRating);
  const fUtilization  = scoreUtilization(driverUtilizationPct);
  const fDispatch     = scoreDispatch(avgDispatchWaitMin);
  const fCancellation = scoreCancellation(cancellationRatePct);
  const fCapacity     = scoreCapacity(onlineDrivers, pendingOrders);
  const fProfitability = scoreProfitability(marginPct !== null ? Number(marginPct) : null);

  const healthScore = Math.round(
    (fOnTime + fSatisfaction + fUtilization + fDispatch + fCancellation + fCapacity + fProfitability) * 100,
  ) / 100;

  const grade = gradeFromScore(healthScore);

  return {
    locationId,
    capturedAt: now.toISOString(),
    healthScore,
    grade,
    fOnTime,
    fSatisfaction,
    fUtilization,
    fDispatch,
    fCancellation,
    fCapacity,
    fProfitability,
    onTimeRatePct,
    avgRating,
    driverUtilizationPct,
    avgDispatchWaitMin,
    cancellationRatePct,
    activeDrivers: onlineDrivers,
    pendingOrders,
  };
}

// ─── Snapshot speichern ───────────────────────────────────────────────────────

export async function snapshotNetworkHealth(
  locationId: string,
): Promise<NetworkHealthSnapshot | null> {
  const sb = createServiceClient();
  const result = await computeNetworkHealth(locationId);

  const { data, error } = await sb
    .from('delivery_network_snapshots')
    .insert({
      location_id:             result.locationId,
      captured_at:             result.capturedAt,
      f_on_time:               result.fOnTime,
      f_satisfaction:          result.fSatisfaction,
      f_utilization:           result.fUtilization,
      f_dispatch:              result.fDispatch,
      f_cancellation:          result.fCancellation,
      f_capacity:              result.fCapacity,
      f_profitability:         result.fProfitability,
      health_score:            result.healthScore,
      grade:                   result.grade,
      on_time_rate_pct:        result.onTimeRatePct,
      avg_rating:              result.avgRating,
      driver_utilization_pct:  result.driverUtilizationPct,
      avg_dispatch_wait_min:   result.avgDispatchWaitMin,
      cancellation_rate_pct:   result.cancellationRatePct,
      active_drivers:          result.activeDrivers,
      pending_orders:          result.pendingOrders,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[network-health] snapshot insert error:', error.message);
    return null;
  }

  return { ...(result as NetworkHealthResult), id: (data as { id: string }).id };
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locations || locations.length === 0) {
    return { locations: 0, snapshots: 0, errors: 0 };
  }

  let snapshots = 0;
  let errors = 0;

  await Promise.all(
    locations.map(async (loc: { id: string }) => {
      const snap = await snapshotNetworkHealth(loc.id).catch(() => null);
      if (snap) snapshots++;
      else errors++;
    }),
  );

  return { locations: locations.length, snapshots, errors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function buildInsights(snap: NetworkHealthSnapshot): NetworkInsight[] {
  const factors: Array<{
    key: string;
    label: string;
    score: number;
    max: number;
    hint: string;
  }> = [
    {
      key: 'on_time',
      label: 'Pünktlichkeit',
      score: snap.fOnTime,
      max: 25,
      hint: snap.onTimeRatePct !== null
        ? `${snap.onTimeRatePct}% pünktliche Lieferungen (letzte 24 h)`
        : 'Keine Daten für letzte 24 h',
    },
    {
      key: 'satisfaction',
      label: 'Kundenzufriedenheit',
      score: snap.fSatisfaction,
      max: 20,
      hint: snap.avgRating !== null
        ? `Ø ${snap.avgRating.toFixed(1)} Sterne (letzte 7 Tage)`
        : 'Noch keine Bewertungen',
    },
    {
      key: 'utilization',
      label: 'Fahrer-Auslastung',
      score: snap.fUtilization,
      max: 15,
      hint: snap.driverUtilizationPct !== null
        ? `${snap.driverUtilizationPct}% der Fahrer aktiv`
        : `${snap.activeDrivers} Fahrer online`,
    },
    {
      key: 'dispatch',
      label: 'Dispatch-Geschwindigkeit',
      score: snap.fDispatch,
      max: 15,
      hint: snap.avgDispatchWaitMin !== null
        ? `Ø ${snap.avgDispatchWaitMin} Min bis Zuweisung`
        : 'Keine Dispatch-Daten',
    },
    {
      key: 'cancellation',
      label: 'Stornierungsrate',
      score: snap.fCancellation,
      max: 10,
      hint: snap.cancellationRatePct !== null
        ? `${snap.cancellationRatePct}% Stornierungsrate`
        : 'Keine Daten',
    },
    {
      key: 'capacity',
      label: 'Kapazitäts-Balance',
      score: snap.fCapacity,
      max: 10,
      hint: `${snap.activeDrivers} Fahrer · ${snap.pendingOrders} offene Bestellungen`,
    },
    {
      key: 'profitability',
      label: 'Profitabilität',
      score: snap.fProfitability,
      max: 5,
      hint: 'Letzter Profitabilitäts-Snapshot',
    },
  ];

  return factors.map((f) => {
    const pct = f.max > 0 ? (f.score / f.max) * 100 : 0;
    const severity: NetworkInsight['severity'] =
      pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'critical';
    return {
      factor:   f.key,
      label:    f.label,
      score:    f.score,
      maxScore: f.max,
      pct:      Math.round(pct),
      severity,
      hint:     f.hint,
    };
  });
}

export async function getNetworkHealthDashboard(
  locationId: string,
): Promise<NetworkHealthDashboard> {
  const sb = createServiceClient();

  const [currentRaw, trendRaw, recentRaw] = await Promise.all([
    // Aktuellster Snapshot
    sb.from('delivery_network_snapshots')
      .select('*')
      .eq('location_id', locationId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 7-Tage-Stunden-Trend aus VIEW
    sb.from('v_network_health_7d')
      .select('*')
      .eq('location_id', locationId)
      .order('hour', { ascending: true })
      .limit(168), // max 7 × 24

    // Letzte 20 Snapshots für Verlaufs-Tabelle
    sb.from('delivery_network_snapshots')
      .select('*')
      .eq('location_id', locationId)
      .order('captured_at', { ascending: false })
      .limit(20),
  ]);

  function mapSnapshot(raw: Record<string, unknown>): NetworkHealthSnapshot {
    return {
      id:                    String(raw.id),
      locationId:            String(raw.location_id),
      capturedAt:            String(raw.captured_at),
      healthScore:           Number(raw.health_score),
      grade:                 raw.grade as NetworkGrade,
      fOnTime:               Number(raw.f_on_time),
      fSatisfaction:         Number(raw.f_satisfaction),
      fUtilization:          Number(raw.f_utilization),
      fDispatch:             Number(raw.f_dispatch),
      fCancellation:         Number(raw.f_cancellation),
      fCapacity:             Number(raw.f_capacity),
      fProfitability:        Number(raw.f_profitability),
      onTimeRatePct:         raw.on_time_rate_pct !== null ? Number(raw.on_time_rate_pct) : null,
      avgRating:             raw.avg_rating !== null ? Number(raw.avg_rating) : null,
      driverUtilizationPct:  raw.driver_utilization_pct !== null ? Number(raw.driver_utilization_pct) : null,
      avgDispatchWaitMin:    raw.avg_dispatch_wait_min !== null ? Number(raw.avg_dispatch_wait_min) : null,
      cancellationRatePct:   raw.cancellation_rate_pct !== null ? Number(raw.cancellation_rate_pct) : null,
      activeDrivers:         Number(raw.active_drivers ?? 0),
      pendingOrders:         Number(raw.pending_orders ?? 0),
    };
  }

  const current = currentRaw.data
    ? mapSnapshot(currentRaw.data as Record<string, unknown>)
    : null;

  const trend7d: NetworkHealthTrendPoint[] = ((trendRaw.data ?? []) as Record<string, unknown>[]).map((r) => ({
    hour:               String(r.hour),
    avgScore:           Number(r.avg_score),
    avgOnTime:          Number(r.avg_on_time),
    avgSatisfaction:    Number(r.avg_satisfaction),
    avgUtilization:     Number(r.avg_utilization),
    avgDispatch:        Number(r.avg_dispatch),
    avgCancellation:    Number(r.avg_cancellation),
    avgCapacity:        Number(r.avg_capacity),
    avgProfitability:   Number(r.avg_profitability),
    snapshotCount:      Number(r.snapshot_count),
  }));

  const recentSnapshots: NetworkHealthSnapshot[] = ((recentRaw.data ?? []) as Record<string, unknown>[])
    .map(mapSnapshot);

  const insights = current ? buildInsights(current) : [];

  return { current, trend7d, recentSnapshots, insights };
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function pruneOldNetworkSnapshots(days = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_network_snapshots', { older_than_days: days });
  return typeof data === 'number' ? data : 0;
}
