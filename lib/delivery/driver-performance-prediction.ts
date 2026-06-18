/**
 * lib/delivery/driver-performance-prediction.ts — Phase 232
 *
 * Smart Driver Performance Prediction Engine
 *
 * Kombiniert vier Datenquellen zu einer täglichen Fahrer-Prognose:
 *   1. driver_performance_snapshots  — 30-Tage Verlauf (Touren, Pünktlichkeit, Lieferzeit)
 *   2. driver_route_profiles         — PLZ-Proficiency (Route-Learning Phase 231)
 *   3. driver_reliability_scores     — Schicht-Zuverlässigkeit (No-Shows, Perfects)
 *   4. driver_wellbeing_scores       — Ermüdungs-Index (Burnout-Prävention)
 *
 * Prognose-Algorithmus (gewichteter Multi-Faktor):
 *   base_tours     = 30-Tage Ø Touren (60 %)
 *   trend_factor   = Steigung letzte 7 Tage (15 %)
 *   momentum       = Delta (letzte 3 Tage vs. vorherige 3 Tage) (10 %)
 *   reliability    = Zuverlässigkeits-Score / 100 (10 %)
 *   wellbeing      = Wellbeing-Index / 100 (5 %)
 *
 *   on_time_rate   = 30-Tage Ø × reliability_factor × wellbeing_factor
 *   avg_min        = 30-Tage Ø Lieferzeit / PLZ-Proficiency-Multiplikator
 *
 *   confidence     = f(Datenpunkte, Konsistenz, Profil-Vollständigkeit)
 *
 * Performance-Tier:
 *   top      confidence ≥ 60 && predicted_on_time ≥ 0.85
 *   good     predicted_on_time ≥ 0.75
 *   at_risk  predicted_on_time < 0.55 || reliability < 40
 *   average  alles andere
 *
 * Cron: buildPredictionsAllLocations() täglich 04:00 UTC
 *       settlePredictions(locationId)  täglich 02:30 UTC (nach Tagesabschluss)
 *       pruneOldPredictions(90)        täglich 02:00 UTC
 *
 * Public API:
 *   buildPredictionsForLocation(locationId)  → BuildResult
 *   buildPredictionsAllLocations()           → BatchResult
 *   settlePredictions(locationId, date?)     → SettleResult
 *   getPredictionDashboard(locationId)       → PredictionDashboard
 *   pruneOldPredictions(daysToKeep)          → { pruned }
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PerformanceTier = 'top' | 'good' | 'average' | 'at_risk';

export interface DriverPrediction {
  id: string;
  locationId: string;
  driverId: string;
  predictionDate: string;
  predictedTours: number;
  predictedStops: number;
  predictedOnTimeRate: number;
  predictedAvgMin: number | null;
  confidenceScore: number;
  performanceTier: PerformanceTier;
  featureWeights: FeatureWeights;
  actualTours: number | null;
  actualOnTimeRate: number | null;
  accuracyScore: number | null;
  settledAt: string | null;
  createdAt: string;
}

export interface FeatureWeights {
  base_tours_pct: number;
  trend_factor: number;
  momentum: number;
  reliability_score: number | null;
  wellbeing_score: number | null;
  route_proficiency_avg: number | null;
  snapshots_used: number;
}

export interface PredictionWithDriver extends DriverPrediction {
  driverName: string | null;
  vehicleType: string | null;
}

export interface BuildResult {
  locationId: string;
  predicted: number;
  skipped: number;
  errors: number;
}

export interface BatchResult {
  locations: number;
  totalPredicted: number;
  totalErrors: number;
}

export interface SettleResult {
  locationId: string;
  settled: number;
  errors: number;
}

export interface PredictionDashboard {
  locationId: string;
  date: string;
  summary: {
    total_drivers: number;
    top_tier: number;
    good_tier: number;
    average_tier: number;
    at_risk_tier: number;
    avg_confidence: number;
    predicted_total_tours: number;
  };
  predictions: PredictionWithDriver[];
  accuracy7d: AccuracyStats | null;
  tierDistribution: TierDataPoint[];
}

export interface AccuracyStats {
  settled_count: number;
  avg_accuracy_score: number;
  avg_error_pct: number;
  perfect_predictions: number;  // accuracy >= 90
}

export interface TierDataPoint {
  date: string;
  top: number;
  good: number;
  average: number;
  at_risk: number;
}

// ─── Internal helper types ────────────────────────────────────────────────────

interface SnapshotRow {
  snapshot_date: string;
  tours_completed: number;
  stops_completed: number;
  avg_delivery_min: number | null;
  on_time_rate: number | null;
}

interface DriverInput {
  driverId: string;
  snapshots: SnapshotRow[];
  reliabilityScore: number | null;
  wellbeingScore: number | null;
  avgRouteProficiency: number | null;
}

// ─── Core Prediction Logic ────────────────────────────────────────────────────

function computePrediction(input: DriverInput): {
  predictedTours: number;
  predictedStops: number;
  predictedOnTimeRate: number;
  predictedAvgMin: number | null;
  confidenceScore: number;
  performanceTier: PerformanceTier;
  featureWeights: FeatureWeights;
} {
  const { snapshots, reliabilityScore, wellbeingScore, avgRouteProficiency } = input;

  if (snapshots.length === 0) {
    return {
      predictedTours: 0,
      predictedStops: 0,
      predictedOnTimeRate: 0,
      predictedAvgMin: null,
      confidenceScore: 0,
      performanceTier: 'at_risk',
      featureWeights: {
        base_tours_pct: 0,
        trend_factor: 0,
        momentum: 0,
        reliability_score: reliabilityScore,
        wellbeing_score: wellbeingScore,
        route_proficiency_avg: avgRouteProficiency,
        snapshots_used: 0,
      },
    };
  }

  // Sort ascending by date for trend calculation
  const sorted = [...snapshots].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  );

  // 30-Tage Basis-Werte
  const baseTours = sorted.reduce((s, r) => s + r.tours_completed, 0) / sorted.length;
  const baseStops = sorted.reduce((s, r) => s + r.stops_completed, 0) / sorted.length;

  const validOnTime = sorted.filter((r) => r.on_time_rate !== null);
  const baseOnTimeRate = validOnTime.length > 0
    ? validOnTime.reduce((s, r) => s + (r.on_time_rate ?? 0), 0) / validOnTime.length
    : 0.7;

  const validMinRows = sorted.filter((r) => r.avg_delivery_min !== null);
  const baseAvgMin = validMinRows.length > 0
    ? validMinRows.reduce((s, r) => s + (r.avg_delivery_min ?? 0), 0) / validMinRows.length
    : null;

  // Trend: lineare Regression über letzte 7 Tage (Tour-Count)
  const last7 = sorted.slice(-7);
  let trendFactor = 0;
  if (last7.length >= 3) {
    const n = last7.length;
    const xMean = (n - 1) / 2;
    const yMean = last7.reduce((s, r) => s + r.tours_completed, 0) / n;
    let num = 0;
    let den = 0;
    last7.forEach((r, i) => {
      num += (i - xMean) * (r.tours_completed - yMean);
      den += (i - xMean) ** 2;
    });
    const slope = den !== 0 ? num / den : 0;
    // Normalisiere: ±1 Tour/Tag Trend → ±0.15 Faktor
    trendFactor = Math.max(-0.3, Math.min(0.3, (slope / Math.max(baseTours, 1)) * 0.15));
  }

  // Momentum: letzte 3 Tage vs. vorherige 3 Tage
  let momentum = 0;
  if (sorted.length >= 6) {
    const recent3 = sorted.slice(-3).reduce((s, r) => s + r.tours_completed, 0) / 3;
    const prior3  = sorted.slice(-6, -3).reduce((s, r) => s + r.tours_completed, 0) / 3;
    if (prior3 > 0) {
      momentum = Math.max(-0.2, Math.min(0.2, ((recent3 - prior3) / prior3) * 0.1));
    }
  }

  // Reliability & Wellbeing Faktoren (Multiplikatoren 0.7–1.05)
  const relFactor = reliabilityScore !== null
    ? 0.7 + (reliabilityScore / 100) * 0.35
    : 0.9;  // default wenn kein Score
  const wellFactor = wellbeingScore !== null
    ? 0.75 + (wellbeingScore / 100) * 0.3
    : 0.95;

  // PLZ-Proficiency verbessert Lieferzeit-Prognose
  const proficiencyMultiplier = avgRouteProficiency !== null
    ? 1 - ((avgRouteProficiency - 50) / 100) * 0.15  // 100 proficiency → 7.5% schneller
    : 1.0;

  // Finale Prognose
  const predictedTours = Math.max(0, baseTours * (1 + trendFactor + momentum) * relFactor * wellFactor);
  const predictedStops = Math.max(0, baseStops * (1 + trendFactor + momentum) * relFactor * wellFactor);
  const predictedOnTimeRate = Math.min(1, Math.max(0,
    baseOnTimeRate * relFactor * wellFactor,
  ));
  const predictedAvgMin = baseAvgMin !== null
    ? Math.max(5, baseAvgMin * proficiencyMultiplier)
    : null;

  // Konfidenz: steigt mit Datenpunkten und Konsistenz
  const dataPoints = Math.min(sorted.length, 30);
  const dataConfidence = (dataPoints / 30) * 60;  // max 60 Pkte

  const tourVariance = sorted.length > 1
    ? sorted.reduce((s, r) => s + (r.tours_completed - baseTours) ** 2, 0) / sorted.length
    : 0;
  const cv = baseTours > 0 ? Math.sqrt(tourVariance) / baseTours : 1;
  const consistencyConfidence = Math.max(0, 25 * (1 - Math.min(cv, 1)));  // max 25 Pkte

  const profileConfidence = (reliabilityScore !== null ? 7 : 0) + (wellbeingScore !== null ? 5 : 0) + (avgRouteProficiency !== null ? 3 : 0);  // max 15 Pkte

  const confidenceScore = Math.round(Math.min(100, dataConfidence + consistencyConfidence + profileConfidence));

  // Tier-Klassifikation
  let performanceTier: PerformanceTier;
  if (predictedOnTimeRate >= 0.85 && confidenceScore >= 60 && (reliabilityScore === null || reliabilityScore >= 70)) {
    performanceTier = 'top';
  } else if (predictedOnTimeRate >= 0.75 && (reliabilityScore === null || reliabilityScore >= 50)) {
    performanceTier = 'good';
  } else if (predictedOnTimeRate < 0.55 || (reliabilityScore !== null && reliabilityScore < 40)) {
    performanceTier = 'at_risk';
  } else {
    performanceTier = 'average';
  }

  return {
    predictedTours: Math.round(predictedTours * 10) / 10,
    predictedStops: Math.round(predictedStops * 10) / 10,
    predictedOnTimeRate: Math.round(predictedOnTimeRate * 10000) / 10000,
    predictedAvgMin: predictedAvgMin !== null ? Math.round(predictedAvgMin * 10) / 10 : null,
    confidenceScore,
    performanceTier,
    featureWeights: {
      base_tours_pct: Math.round(baseTours * 10) / 10,
      trend_factor:   Math.round(trendFactor * 1000) / 1000,
      momentum:       Math.round(momentum * 1000) / 1000,
      reliability_score: reliabilityScore,
      wellbeing_score:   wellbeingScore,
      route_proficiency_avg: avgRouteProficiency !== null ? Math.round(avgRouteProficiency * 10) / 10 : null,
      snapshots_used: sorted.length,
    },
  };
}

// ─── Build Predictions ────────────────────────────────────────────────────────

export async function buildPredictionsForLocation(locationId: string): Promise<BuildResult> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  // 1. Aktive Fahrer dieser Location
  const { data: drivers } = await sb
    .from('drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_active', true);

  if (!drivers || drivers.length === 0) return { locationId, predicted: 0, skipped: 0, errors: 0 };

  const driverIds = drivers.map((d) => d.id as string);

  // 2. Performance-Snapshots (30 Tage)
  const { data: snapshotRows } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id, snapshot_date, tours_completed, stops_completed, avg_delivery_min, on_time_rate')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('snapshot_date', since30)
    .order('snapshot_date', { ascending: false });

  // 3. Route-Proficiency (PLZ-Lernkurven, Phase 231)
  const { data: proficiencyRows } = await sb
    .from('driver_route_profiles')
    .select('driver_id, proficiency_score')
    .eq('location_id', locationId)
    .in('driver_id', driverIds);

  // 4. Reliability-Scores (Phase 93)
  const { data: reliabilityRows } = await sb
    .from('driver_reliability_scores')
    .select('driver_id, score')
    .eq('location_id', locationId)
    .in('driver_id', driverIds);

  // 5. Wellbeing-Scores (Phase 213)
  const { data: wellbeingRows } = await sb
    .from('driver_wellbeing_scores')
    .select('driver_id, composite_score')
    .eq('location_id', locationId)
    .in('driver_id', driverIds);

  // Index by driver_id für schnellen Lookup
  const snapshotsByDriver = new Map<string, SnapshotRow[]>();
  for (const r of snapshotRows ?? []) {
    const driverId = r.driver_id as string;
    if (!snapshotsByDriver.has(driverId)) snapshotsByDriver.set(driverId, []);
    snapshotsByDriver.get(driverId)!.push({
      snapshot_date:    r.snapshot_date as string,
      tours_completed:  (r.tours_completed as number) ?? 0,
      stops_completed:  (r.stops_completed as number) ?? 0,
      avg_delivery_min: r.avg_delivery_min as number | null,
      on_time_rate:     r.on_time_rate as number | null,
    });
  }

  const profAvgByDriver = new Map<string, number>();
  const profCountByDriver = new Map<string, number>();
  for (const r of proficiencyRows ?? []) {
    const id = r.driver_id as string;
    const score = r.proficiency_score as number;
    profAvgByDriver.set(id, (profAvgByDriver.get(id) ?? 0) + score);
    profCountByDriver.set(id, (profCountByDriver.get(id) ?? 0) + 1);
  }

  const reliabilityByDriver = new Map<string, number>();
  for (const r of reliabilityRows ?? []) {
    reliabilityByDriver.set(r.driver_id as string, r.score as number);
  }

  const wellbeingByDriver = new Map<string, number>();
  for (const r of wellbeingRows ?? []) {
    wellbeingByDriver.set(r.driver_id as string, r.composite_score as number);
  }

  // 6. Prognosen berechnen + UPSERT
  const upsertRows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const driverId of driverIds) {
    const snapshots = snapshotsByDriver.get(driverId) ?? [];
    if (snapshots.length === 0) { skipped++; continue; }

    const profCount = profCountByDriver.get(driverId) ?? 0;
    const profSum   = profAvgByDriver.get(driverId) ?? 0;
    const avgProficiency = profCount > 0 ? profSum / profCount : null;

    const input: DriverInput = {
      driverId,
      snapshots,
      reliabilityScore:     reliabilityByDriver.get(driverId) ?? null,
      wellbeingScore:       wellbeingByDriver.get(driverId) ?? null,
      avgRouteProficiency:  avgProficiency,
    };

    const pred = computePrediction(input);

    upsertRows.push({
      location_id:            locationId,
      driver_id:              driverId,
      prediction_date:        today,
      predicted_tours:        pred.predictedTours,
      predicted_stops:        pred.predictedStops,
      predicted_on_time_rate: pred.predictedOnTimeRate,
      predicted_avg_min:      pred.predictedAvgMin,
      confidence_score:       pred.confidenceScore,
      performance_tier:       pred.performanceTier,
      feature_weights:        pred.featureWeights,
      updated_at:             new Date().toISOString(),
    });
  }

  if (upsertRows.length === 0) return { locationId, predicted: 0, skipped, errors: 0 };

  // Chunk-UPSERT (100er-Batches)
  let errors = 0;
  const chunkSize = 100;
  for (let i = 0; i < upsertRows.length; i += chunkSize) {
    const chunk = upsertRows.slice(i, i + chunkSize);
    const { error } = await sb
      .from('driver_performance_predictions')
      .upsert(chunk, { onConflict: 'location_id,driver_id,prediction_date', ignoreDuplicates: false });
    if (error) errors++;
  }

  return { locationId, predicted: upsertRows.length, skipped, errors };
}

export async function buildPredictionsAllLocations(): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs) return { locations: 0, totalPredicted: 0, totalErrors: 0 };

  let totalPredicted = 0;
  let totalErrors    = 0;

  for (const loc of locs) {
    const result = await buildPredictionsForLocation(loc.id as string).catch(() => null);
    if (result) {
      totalPredicted += result.predicted;
      totalErrors    += result.errors;
    } else {
      totalErrors++;
    }
  }

  return { locations: locs.length, totalPredicted, totalErrors };
}

// ─── Settle (retroaktiv Ist-Werte eintragen + Genauigkeit berechnen) ─────────

export async function settlePredictions(
  locationId: string,
  date: string = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
): Promise<SettleResult> {
  const sb = createServiceClient();

  // Unsettled Prognosen für gestern
  const { data: preds } = await sb
    .from('driver_performance_predictions')
    .select('id, driver_id, predicted_tours, predicted_on_time_rate')
    .eq('location_id', locationId)
    .eq('prediction_date', date)
    .is('settled_at', null);

  if (!preds || preds.length === 0) return { locationId, settled: 0, errors: 0 };

  const driverIds = preds.map((p) => p.driver_id as string);

  // Tatsächliche Snapshots vom selben Tag
  const { data: actuals } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id, tours_completed, on_time_rate')
    .eq('location_id', locationId)
    .eq('snapshot_date', date)
    .in('driver_id', driverIds);

  const actualByDriver = new Map<string, { tours: number; onTimeRate: number | null }>();
  for (const a of actuals ?? []) {
    actualByDriver.set(a.driver_id as string, {
      tours:       (a.tours_completed as number) ?? 0,
      onTimeRate:  a.on_time_rate as number | null,
    });
  }

  let settled = 0;
  let errors  = 0;

  for (const pred of preds) {
    const actual = actualByDriver.get(pred.driver_id as string);
    if (!actual) continue;

    const predictedTours    = pred.predicted_tours as number;
    const predictedOnTime   = pred.predicted_on_time_rate as number;
    const actualTours       = actual.tours;
    const actualOnTimeRate  = actual.onTimeRate;

    // Accuracy: 1 - Ø relative Abweichung beider Metriken
    let accuracyScore: number;
    const tourError = predictedTours > 0
      ? Math.abs(actualTours - predictedTours) / Math.max(actualTours, 1)
      : 1;

    if (actualOnTimeRate !== null) {
      const onTimeError = Math.abs(actualOnTimeRate - predictedOnTime);
      accuracyScore = Math.max(0, 100 * (1 - (tourError + onTimeError) / 2));
    } else {
      accuracyScore = Math.max(0, 100 * (1 - tourError));
    }

    const { error } = await sb
      .from('driver_performance_predictions')
      .update({
        actual_tours:       actualTours,
        actual_on_time_rate: actualOnTimeRate,
        accuracy_score:     Math.round(accuracyScore * 100) / 100,
        settled_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq('id', pred.id as string);

    if (error) { errors++; } else { settled++; }
  }

  return { locationId, settled, errors };
}

export async function settleAllLocations(): Promise<{ locations: number; settled: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);
  if (!locs) return { locations: 0, settled: 0, errors: 0 };

  let settled = 0;
  let errors  = 0;
  for (const loc of locs) {
    const r = await settlePredictions(loc.id as string).catch(() => null);
    if (r) { settled += r.settled; errors += r.errors; } else { errors++; }
  }
  return { locations: locs.length, settled, errors };
}

// ─── Prune ────────────────────────────────────────────────────────────────────

export async function pruneOldPredictions(daysToKeep: number = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_performance_predictions', { days_to_keep: daysToKeep });
  if (error) return { pruned: 0 };
  return { pruned: (data as number | null) ?? 0 };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getPredictionDashboard(locationId: string): Promise<PredictionDashboard> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Prognosen für heute inkl. Fahrerdaten
  const { data: preds } = await sb
    .from('driver_performance_predictions')
    .select(`
      *,
      drivers (
        id,
        display_name,
        vehicle_type
      )
    `)
    .eq('location_id', locationId)
    .eq('prediction_date', today)
    .order('predicted_on_time_rate', { ascending: false });

  const predictions: PredictionWithDriver[] = (preds ?? []).map((r) => {
    const drv = r.drivers as { id: string; display_name: string | null; vehicle_type: string | null } | null;
    return {
      id:                    r.id as string,
      locationId:            r.location_id as string,
      driverId:              r.driver_id as string,
      predictionDate:        r.prediction_date as string,
      predictedTours:        r.predicted_tours as number,
      predictedStops:        r.predicted_stops as number,
      predictedOnTimeRate:   r.predicted_on_time_rate as number,
      predictedAvgMin:       r.predicted_avg_min as number | null,
      confidenceScore:       r.confidence_score as number,
      performanceTier:       r.performance_tier as PerformanceTier,
      featureWeights:        r.feature_weights as FeatureWeights,
      actualTours:           r.actual_tours as number | null,
      actualOnTimeRate:      r.actual_on_time_rate as number | null,
      accuracyScore:         r.accuracy_score as number | null,
      settledAt:             r.settled_at as string | null,
      createdAt:             r.created_at as string,
      driverName:            drv?.display_name ?? null,
      vehicleType:           drv?.vehicle_type ?? null,
    };
  });

  // Summary
  const tierCounts = { top: 0, good: 0, average: 0, at_risk: 0 };
  let totalTours    = 0;
  let totalConf     = 0;
  for (const p of predictions) {
    tierCounts[p.performanceTier]++;
    totalTours += p.predictedTours;
    totalConf  += p.confidenceScore;
  }
  const n = predictions.length;

  // 7-Tage Genauigkeitsanalyse (settled Prognosen)
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: settled7 } = await sb
    .from('driver_performance_predictions')
    .select('accuracy_score, predicted_tours, actual_tours')
    .eq('location_id', locationId)
    .gte('prediction_date', since7)
    .not('settled_at', 'is', null)
    .not('accuracy_score', 'is', null);

  let accuracy7d: AccuracyStats | null = null;
  if (settled7 && settled7.length > 0) {
    const avgAcc = settled7.reduce((s, r) => s + (r.accuracy_score as number), 0) / settled7.length;
    const avgErr = settled7.reduce((s, r) => {
      const pt = r.predicted_tours as number;
      const at = r.actual_tours as number ?? 0;
      return s + (pt > 0 ? Math.abs(pt - at) / Math.max(at, 1) : 1);
    }, 0) / settled7.length;
    const perfect = settled7.filter((r) => (r.accuracy_score as number) >= 90).length;
    accuracy7d = {
      settled_count:    settled7.length,
      avg_accuracy_score: Math.round(avgAcc * 10) / 10,
      avg_error_pct:    Math.round(avgErr * 1000) / 10,
      perfect_predictions: perfect,
    };
  }

  // 7-Tage Tier-Verteilung
  const { data: tierRows } = await sb
    .from('driver_performance_predictions')
    .select('prediction_date, performance_tier')
    .eq('location_id', locationId)
    .gte('prediction_date', since7)
    .order('prediction_date', { ascending: true });

  const tierByDate = new Map<string, Record<PerformanceTier, number>>();
  for (const r of tierRows ?? []) {
    const d = r.prediction_date as string;
    if (!tierByDate.has(d)) tierByDate.set(d, { top: 0, good: 0, average: 0, at_risk: 0 });
    const tier = r.performance_tier as PerformanceTier;
    tierByDate.get(d)![tier]++;
  }
  const tierDistribution: TierDataPoint[] = Array.from(tierByDate.entries()).map(([date, counts]) => ({
    date, ...counts,
  }));

  return {
    locationId,
    date: today,
    summary: {
      total_drivers:         n,
      top_tier:              tierCounts.top,
      good_tier:             tierCounts.good,
      average_tier:          tierCounts.average,
      at_risk_tier:          tierCounts.at_risk,
      avg_confidence:        n > 0 ? Math.round(totalConf / n) : 0,
      predicted_total_tours: Math.round(totalTours * 10) / 10,
    },
    predictions,
    accuracy7d,
    tierDistribution,
  };
}
