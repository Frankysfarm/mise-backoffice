/**
 * lib/delivery/order-delay-prediction.ts — Phase 316
 *
 * Smart Order Delay Prediction Engine
 *
 * Predicts at order dispatch time whether a delivery is at risk of running late,
 * using 7 live signal factors. Results are stored per-order and settled after
 * delivery for continuous model feedback.
 *
 * Public API:
 *   predictOrderDelay(orderId, locationId)       — Score one pending order
 *   predictAllPendingOrders(locationId)          — Batch for one location
 *   predictAllLocations()                        — Cron batch
 *   settleOutcomes(locationId)                   — Fill actual delays post-delivery
 *   settleAllLocations()                         — Cron batch for settlement
 *   getDelayPredictionDashboard(locationId)      — Admin KPIs + active predictions
 *   pruneOldDelayPredictions(daysOld)            — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactors {
  kitchenLoad: number;       // 0–100: pending orders in kitchen right now
  peakHourScore: number;     // 0–100: how deep into peak hour we are
  zoneDistanceScore: number; // 0–100: C/D zones score higher
  weatherPenalty: number;    // 0–100: active weather alert
  orderComplexity: number;   // 0–100: based on estimated_prep_min
  driverShortage: number;    // 0–100: inverse of idle drivers in zone
  historicalLateRate: number;// 0–100: DOW+hour historical late rate
}

export interface DelayPrediction {
  id: string;
  orderId: string;
  locationId: string;
  predictedAt: string;
  delayRiskScore: number;
  riskLevel: RiskLevel;
  predictedDelayMin: number | null;
  riskFactors: RiskFactors;
  settledAt: string | null;
  actualDelayMin: number | null;
  // from view join
  bestellnummer?: string;
  orderStatus?: string;
  kundeAdresse?: string | null;
  orderCreatedAt?: string;
  etaEarliest?: string | null;
  deliveryZone?: string | null;
}

export interface AccuracyRow {
  riskLevel: RiskLevel;
  totalPredictions: number;
  settled: number;
  avgRiskScore: number;
  avgPredictedDelayMin: number | null;
  avgActualDelayMin: number | null;
  avgAbsErrorMin: number | null;
  actualLateRate: number | null;
}

export interface DelayPredictionDashboard {
  activePredictions: DelayPrediction[];
  accuracy: AccuracyRow[];
  summary: {
    totalActive: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgRiskScore: number;
    settledToday: number;
    avgActualDelayMin: number | null;
  };
  computedAt: string;
}

export interface PredictBatchResult {
  locationId: string;
  predicted: number;
  skipped: number;
  errors: number;
}

export interface SettleResult {
  locationId: string;
  settled: number;
  errors: number;
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  kitchenLoad:        0.25,
  peakHourScore:      0.15,
  zoneDistanceScore:  0.15,
  weatherPenalty:     0.10,
  orderComplexity:    0.15,
  driverShortage:     0.15,
  historicalLateRate: 0.05,
} as const;

// Peak hours (UTC): 11-13, 17-20
const PEAK_HOURS = new Set([11, 12, 13, 17, 18, 19, 20]);

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function predictedDelayFromScore(score: number): number | null {
  if (score < 35) return null;
  if (score < 55) return 5;
  if (score < 75) return 12;
  return 22;
}

// ─── Core prediction function ─────────────────────────────────────────────────

export async function predictOrderDelay(
  orderId: string,
  locationId: string,
): Promise<DelayPrediction | null> {
  const svc = createServiceClient();

  // Load order
  const { data: order } = await svc
    .from('customer_orders')
    .select('id, location_id, delivery_zone, estimated_prep_min, created_at, eta_earliest, status')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return null;
  const ord = order as {
    id: string; location_id: string; delivery_zone: string | null;
    estimated_prep_min: number | null; created_at: string;
    eta_earliest: string | null; status: string;
  };

  const now = new Date();
  const hourUtc = now.getUTCHours();
  const dowUtc = now.getUTCDay();

  // ── Factor 1: Kitchen load ─────────────────────────────────────────────────
  const { count: kitchenCount } = await svc
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['bestellt', 'in_zubereitung'])
    .eq('typ', 'lieferung');
  const kitchenLoad = Math.min(100, ((kitchenCount ?? 0) / 8) * 100);

  // ── Factor 2: Peak hour ────────────────────────────────────────────────────
  const peakHourScore = PEAK_HOURS.has(hourUtc) ? 80 : 20;

  // ── Factor 3: Zone distance ────────────────────────────────────────────────
  const zoneScoreMap: Record<string, number> = { A: 10, B: 30, C: 65, D: 90 };
  const zoneDistanceScore = zoneScoreMap[ord.delivery_zone ?? 'A'] ?? 20;

  // ── Factor 4: Weather penalty ──────────────────────────────────────────────
  let weatherPenalty = 0;
  const { data: weather } = await svc
    .from('weather_snapshots')
    .select('is_dangerous, condition_code')
    .eq('location_id', locationId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (weather) {
    const w = weather as { is_dangerous: boolean | null; condition_code: string | null };
    if (w.is_dangerous) weatherPenalty = 90;
    else if (['rain', 'snow', 'storm', 'fog'].some(c => (w.condition_code ?? '').includes(c))) {
      weatherPenalty = 45;
    }
  }

  // ── Factor 5: Order complexity ─────────────────────────────────────────────
  const prepMin = ord.estimated_prep_min ?? 15;
  const orderComplexity = Math.min(100, ((prepMin - 5) / 30) * 100);

  // ── Factor 6: Driver shortage ──────────────────────────────────────────────
  const { count: idleDrivers } = await svc
    .from('mise_drivers')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('active', true)
    .eq('state', 'online');
  const driverShortage = Math.max(0, 100 - ((idleDrivers ?? 0) * 25));

  // ── Factor 7: Historical late rate ────────────────────────────────────────
  let historicalLateRate = 30; // neutral default
  const since7d = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const { data: history } = await svc
    .from('customer_orders')
    .select('geliefert_am, eta_latest, created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .gte('created_at', since7d)
    .not('geliefert_am', 'is', null)
    .not('eta_latest', 'is', null)
    .limit(200);

  if (history && history.length > 0) {
    const matching = (history as Array<{ geliefert_am: string; eta_latest: string; created_at: string }>)
      .filter(h => new Date(h.created_at).getUTCDay() === dowUtc &&
                   new Date(h.created_at).getUTCHours() === hourUtc);
    if (matching.length >= 3) {
      const lateCount = matching.filter(h => new Date(h.geliefert_am) > new Date(h.eta_latest)).length;
      historicalLateRate = Math.round((lateCount / matching.length) * 100);
    }
  }

  // ── Composite score ────────────────────────────────────────────────────────
  const factors: RiskFactors = {
    kitchenLoad: Math.round(kitchenLoad),
    peakHourScore,
    zoneDistanceScore,
    weatherPenalty,
    orderComplexity: Math.round(Math.max(0, orderComplexity)),
    driverShortage: Math.round(driverShortage),
    historicalLateRate,
  };

  const score = Math.round(
    factors.kitchenLoad        * WEIGHTS.kitchenLoad +
    factors.peakHourScore      * WEIGHTS.peakHourScore +
    factors.zoneDistanceScore  * WEIGHTS.zoneDistanceScore +
    factors.weatherPenalty     * WEIGHTS.weatherPenalty +
    factors.orderComplexity    * WEIGHTS.orderComplexity +
    factors.driverShortage     * WEIGHTS.driverShortage +
    factors.historicalLateRate * WEIGHTS.historicalLateRate,
  );

  const riskLevel = riskLevelFromScore(score);
  const predictedDelayMin = predictedDelayFromScore(score);

  // ── Upsert ────────────────────────────────────────────────────────────────
  const row = {
    order_id:            orderId,
    location_id:         locationId,
    predicted_at:        now.toISOString(),
    delay_risk_score:    score,
    risk_level:          riskLevel,
    predicted_delay_min: predictedDelayMin,
    risk_factors:        factors as unknown as Record<string, unknown>,
  };

  const { data: upserted } = await svc
    .from('order_delay_predictions')
    .upsert(row, { onConflict: 'order_id', ignoreDuplicates: false })
    .select('id')
    .maybeSingle();

  return {
    id: (upserted as { id: string } | null)?.id ?? '',
    orderId,
    locationId,
    predictedAt: now.toISOString(),
    delayRiskScore: score,
    riskLevel,
    predictedDelayMin,
    riskFactors: factors,
    settledAt: null,
    actualDelayMin: null,
  };
}

// ─── Batch: all pending orders for one location ───────────────────────────────

export async function predictAllPendingOrders(locationId: string): Promise<PredictBatchResult> {
  const svc = createServiceClient();
  const result: PredictBatchResult = { locationId, predicted: 0, skipped: 0, errors: 0 };

  const { data: orders } = await svc
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['bestellt', 'in_zubereitung', 'bereit'])
    .limit(50);

  if (!orders) return result;

  // Get existing predictions to avoid redundant updates within 5 min
  const orderIds = (orders as Array<{ id: string }>).map(o => o.id);
  const { data: existing } = await svc
    .from('order_delay_predictions')
    .select('order_id, predicted_at')
    .in('order_id', orderIds);

  const recentlyPredicted = new Set(
    ((existing ?? []) as Array<{ order_id: string; predicted_at: string }>)
      .filter(p => Date.now() - new Date(p.predicted_at).getTime() < 5 * 60_000)
      .map(p => p.order_id),
  );

  for (const order of orders as Array<{ id: string }>) {
    if (recentlyPredicted.has(order.id)) { result.skipped++; continue; }
    try {
      await predictOrderDelay(order.id, locationId);
      result.predicted++;
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ─── Cron batch ───────────────────────────────────────────────────────────────

export async function predictAllLocations(): Promise<{
  locations: number;
  predicted: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  const rows = (locations ?? []) as Array<{ id: string }>;
  let predicted = 0; let errors = 0;

  await Promise.allSettled(
    rows.map(async loc => {
      const r = await predictAllPendingOrders(loc.id);
      predicted += r.predicted;
      errors    += r.errors;
    }),
  );

  return { locations: rows.length, predicted, errors };
}

// ─── Settle outcomes after delivery ──────────────────────────────────────────

export async function settleOutcomes(locationId: string): Promise<SettleResult> {
  const svc = createServiceClient();
  const result: SettleResult = { locationId, settled: 0, errors: 0 };

  // Load unsettled predictions for delivered orders
  const { data: pending } = await svc
    .from('order_delay_predictions')
    .select('id, order_id, predicted_at')
    .eq('location_id', locationId)
    .is('settled_at', null)
    .limit(100);

  if (!pending) return result;

  for (const p of pending as Array<{ id: string; order_id: string; predicted_at: string }>) {
    try {
      const { data: order } = await svc
        .from('customer_orders')
        .select('status, geliefert_am, eta_latest')
        .eq('id', p.order_id)
        .maybeSingle();

      const ord = order as {
        status: string; geliefert_am: string | null; eta_latest: string | null;
      } | null;

      if (!ord || !['geliefert', 'storniert', 'abgebrochen'].includes(ord.status)) continue;

      let actualDelayMin: number | null = null;
      if (ord.geliefert_am && ord.eta_latest) {
        actualDelayMin = Math.round(
          (new Date(ord.geliefert_am).getTime() - new Date(ord.eta_latest).getTime()) / 60_000,
        );
      }

      await svc
        .from('order_delay_predictions')
        .update({ settled_at: new Date().toISOString(), actual_delay_min: actualDelayMin })
        .eq('id', p.id);

      result.settled++;
    } catch {
      result.errors++;
    }
  }

  return result;
}

export async function settleAllLocations(): Promise<{
  locations: number;
  settled: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc.from('locations').select('id').eq('active', true);
  const rows = (locations ?? []) as Array<{ id: string }>;
  let settled = 0; let errors = 0;

  await Promise.allSettled(
    rows.map(async loc => {
      const r = await settleOutcomes(loc.id);
      settled += r.settled;
      errors  += r.errors;
    }),
  );

  return { locations: rows.length, settled, errors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDelayPredictionDashboard(
  locationId: string,
): Promise<DelayPredictionDashboard> {
  const svc = createServiceClient();

  // Active predictions
  const { data: active } = await svc
    .from('v_active_delay_predictions')
    .select('*')
    .eq('location_id', locationId)
    .order('delay_risk_score', { ascending: false })
    .limit(50);

  const activePredictions: DelayPrediction[] = ((active ?? []) as Array<Record<string, unknown>>).map(r => ({
    id:               String(r.id ?? ''),
    orderId:          String(r.order_id ?? ''),
    locationId:       String(r.location_id ?? ''),
    predictedAt:      String(r.predicted_at ?? ''),
    delayRiskScore:   Number(r.delay_risk_score ?? 0),
    riskLevel:        String(r.risk_level ?? 'low') as RiskLevel,
    predictedDelayMin: r.predicted_delay_min != null ? Number(r.predicted_delay_min) : null,
    riskFactors:      (r.risk_factors ?? {}) as RiskFactors,
    settledAt:        null,
    actualDelayMin:   null,
    bestellnummer:    r.bestellnummer != null ? String(r.bestellnummer) : undefined,
    orderStatus:      r.order_status != null ? String(r.order_status) : undefined,
    kundeAdresse:     r.kunde_adresse != null ? String(r.kunde_adresse) : null,
    orderCreatedAt:   r.order_created_at != null ? String(r.order_created_at) : undefined,
    etaEarliest:      r.eta_earliest != null ? String(r.eta_earliest) : null,
    deliveryZone:     r.delivery_zone != null ? String(r.delivery_zone) : null,
  }));

  // Accuracy
  const { data: accRaw } = await svc
    .from('v_delay_prediction_accuracy')
    .select('*')
    .eq('location_id', locationId);

  const accuracy: AccuracyRow[] = ((accRaw ?? []) as Array<Record<string, unknown>>).map(r => ({
    riskLevel:          String(r.risk_level ?? 'low') as RiskLevel,
    totalPredictions:   Number(r.total_predictions ?? 0),
    settled:            Number(r.settled ?? 0),
    avgRiskScore:       Number(r.avg_risk_score ?? 0),
    avgPredictedDelayMin: r.avg_predicted_delay_min != null ? Number(r.avg_predicted_delay_min) : null,
    avgActualDelayMin:  r.avg_actual_delay_min != null ? Number(r.avg_actual_delay_min) : null,
    avgAbsErrorMin:     r.avg_abs_error_min != null ? Number(r.avg_abs_error_min) : null,
    actualLateRate:     r.actual_late_rate != null ? Number(r.actual_late_rate) : null,
  }));

  // Settled today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: settledToday } = await svc
    .from('order_delay_predictions')
    .select('actual_delay_min')
    .eq('location_id', locationId)
    .gte('settled_at', todayStart.toISOString());

  const settledRows = (settledToday ?? []) as Array<{ actual_delay_min: number | null }>;
  const avgActual = settledRows.length > 0
    ? settledRows.reduce((s, r) => s + (r.actual_delay_min ?? 0), 0) / settledRows.length
    : null;

  const summary = {
    totalActive:       activePredictions.length,
    criticalCount:     activePredictions.filter(p => p.riskLevel === 'critical').length,
    highCount:         activePredictions.filter(p => p.riskLevel === 'high').length,
    mediumCount:       activePredictions.filter(p => p.riskLevel === 'medium').length,
    lowCount:          activePredictions.filter(p => p.riskLevel === 'low').length,
    avgRiskScore:      activePredictions.length > 0
      ? Math.round(activePredictions.reduce((s, p) => s + p.delayRiskScore, 0) / activePredictions.length)
      : 0,
    settledToday:      settledRows.length,
    avgActualDelayMin: avgActual !== null ? Math.round(avgActual) : null,
  };

  return { activePredictions, accuracy, summary, computedAt: new Date().toISOString() };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function pruneOldDelayPredictions(daysOld: number = 30): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_delay_predictions', { days_old: daysOld });
  return { pruned: typeof data === 'number' ? data : 0 };
}
