/**
 * lib/delivery/surge-prediction.ts
 *
 * Phase 104: Predictive Surge Engine & Driver Mobilization
 *
 * Unterschied zu surge.ts (reaktiv):
 *   surge.ts       → erkennt laufende Spitzen (aktuelle Queue-Tiefe)
 *   surge-prediction.ts → sagt Spitzen 30–60 Min voraus + mobilisiert Fahrer
 *
 * Algorithmus:
 *   1. Bestellgeschwindigkeit letzte 30 Min vs. historischer Durchschnitt (Stunde + Wochentag)
 *   2. Velocity-Ratio ≥ 1.4 → LOW, ≥ 1.8 → MEDIUM, ≥ 2.5 → HIGH
 *   3. Konfidenz aus Datenpunkte-Qualität + Zeitfenster (Peak-Zeit = mehr Konfidenz)
 *   4. Bei MEDIUM/HIGH → Broadcast an offline/idle Fahrer der letzten 7 Tage
 *   5. Tracking: wer kommt online nach Benachrichtigung?
 *   6. Evaluierung nach Surge-Fenster: war Vorhersage korrekt?
 *
 * Funktionen:
 *   predictSurgeForLocation()     — Vorhersage + optionaler Mobilisierungs-Broadcast
 *   runSurgePredictionAllLocations() — Cron-Batch
 *   evaluatePastPredictions()     — Genauigkeit berechnen (nach Surge-Fenster)
 *   trackDriverCameOnline()       — Fahrer-App meldet sich online → Mobilisierungs-Event schließen
 *   getPredictionDashboard()      — Admin-Dashboard-Daten
 *   getRecentPredictions()        — letzte 48h für eine Location
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { sendBroadcast } from './messaging';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type SurgeIntensity = 'low' | 'medium' | 'high';

export interface SurgeSignals {
  orders_last_30min: number;
  historical_avg_30min: number;
  velocity_ratio: number;
  hour_of_day: number;
  day_of_week: number;
  active_drivers: number;
  idle_drivers: number;
  queue_depth: number;
  is_peak_hour: boolean;
}

export interface SurgePrediction {
  id: string;
  locationId: string;
  predictedAt: string;
  surgeWindowStart: string;
  surgeWindowEnd: string;
  predictedIntensity: SurgeIntensity;
  confidencePct: number;
  signals: SurgeSignals;
  broadcastsSent: number;
  actualPeakOrders: number | null;
  wasAccurate: boolean | null;
  evaluatedAt: string | null;
  notifiedDrivers?: number;
  respondedDrivers?: number;
}

export interface PredictResult {
  locationId: string;
  predictionId: string | null;
  intensity: SurgeIntensity | null;
  confidencePct: number;
  broadcastsSent: number;
  skipped: boolean;
  reason?: string;
}

export interface MobilizationStats {
  predictionsTotal: number;
  accurate: number;
  inaccurate: number;
  accuracyPct: number | null;
  notificationsSent: number;
  driversMobilized: number;
  mobilizationRatePct: number | null;
  avgResponseTimeMin: number | null;
}

export interface PredictionDashboard {
  stats: MobilizationStats;
  recentPredictions: SurgePrediction[];
  pendingEvaluation: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function isPeakHour(hour: number): boolean {
  return (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
}

function computeConfidence(
  signals: Pick<SurgeSignals, 'historical_avg_30min' | 'velocity_ratio' | 'is_peak_hour'>,
  dataPoints: number,
): number {
  let score = 50;

  // Mehr historische Datenpunkte = mehr Konfidenz
  if (dataPoints >= 20) score += 15;
  else if (dataPoints >= 10) score += 8;
  else if (dataPoints < 4) score -= 20;

  // Starkes Velocity-Signal = mehr Konfidenz
  if (signals.velocity_ratio >= 2.5) score += 15;
  else if (signals.velocity_ratio >= 2.0) score += 10;
  else if (signals.velocity_ratio >= 1.8) score += 5;

  // Peak-Stunden: historische Genauigkeit höher
  if (signals.is_peak_hour) score += 10;

  // Niedrige historische Basis → unsichere Verhältnis-Berechnung
  if (signals.historical_avg_30min < 2) score -= 15;

  return Math.min(95, Math.max(10, score));
}

function velocityToIntensity(ratio: number): SurgeIntensity | null {
  if (ratio >= 2.5) return 'high';
  if (ratio >= 1.8) return 'medium';
  if (ratio >= 1.4) return 'low';
  return null;
}

// Nachrichten je Intensität
function buildBroadcastMessage(intensity: SurgeIntensity, windowStart: Date): string {
  const timeLabel = windowStart.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
  const level = intensity === 'high' ? '🔴 Hohe' : intensity === 'medium' ? '🟡 Mittlere' : '🟢 Leichte';
  return `${level} Nachfrage-Spitze erwartet ab ~${timeLabel} Uhr. Jetzt online gehen für mehr Lieferungen! 🛵`;
}

// ─── Kern-Logik ───────────────────────────────────────────────────────────────

export async function predictSurgeForLocation(
  locationId: string,
  opts: { broadcast?: boolean } = {},
): Promise<PredictResult> {
  const { broadcast = true } = opts;
  const sb = createServiceClient();
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  // ── 1. Aktuelle Bestellgeschwindigkeit (letzte 30 Min) ──
  const { count: recentCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('typ', ['lieferung'])
    .gte('created_at', thirtyMinAgo);

  const ordersLast30 = recentCount ?? 0;

  // ── 2. Historischer Durchschnitt (gleiche Stunde ± 30 Min, letzten 4 Wochen, gleicher Wochentag) ──
  const hour = now.getUTCHours();
  const dow = now.getUTCDay();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

  const { data: histRows } = await sb
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .in('typ', ['lieferung'])
    .gte('created_at', fourWeeksAgo)
    .lt('created_at', thirtyMinAgo);

  // Filtere auf gleiche Stunde + gleicher Wochentag
  const matchingDays: Record<string, number> = {};
  for (const row of histRows ?? []) {
    const d = new Date(row.created_at as string);
    const dHour = d.getUTCHours();
    const dDow = d.getUTCDay();
    if (dDow === dow && dHour === hour) {
      const dayKey = d.toISOString().slice(0, 10);
      matchingDays[dayKey] = (matchingDays[dayKey] ?? 0) + 1;
    }
  }
  const dayKeys = Object.keys(matchingDays);
  const historicalAvg = dayKeys.length > 0
    ? Object.values(matchingDays).reduce((a, b) => a + b, 0) / dayKeys.length / 2 // per 30-min half
    : 0;

  const velocityRatio = historicalAvg > 0 ? ordersLast30 / historicalAvg : 0;

  const intensity = velocityToIntensity(velocityRatio);

  // Kein Surge-Signal → überspringen
  if (!intensity) {
    return { locationId, predictionId: null, intensity: null, confidencePct: 0, broadcastsSent: 0, skipped: true, reason: 'velocity below threshold' };
  }

  // ── 3. Aktive / Idle Fahrer ──
  const { data: driverRows } = await sb
    .from('mise_drivers')
    .select('id, status')
    .eq('location_id', locationId)
    .in('status', ['online', 'idle', 'active']);

  const activeDrivers = (driverRows ?? []).filter((d) => d.status === 'active').length;
  const idleDrivers = (driverRows ?? []).filter((d) => d.status === 'idle' || d.status === 'online').length;

  // ── 4. Queue-Tiefe ──
  const { count: queueDepth } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'bestaetigt', 'in_zubereitung']);

  const peak = isPeakHour(hour);

  const signals: SurgeSignals = {
    orders_last_30min: ordersLast30,
    historical_avg_30min: Math.round(historicalAvg * 10) / 10,
    velocity_ratio: Math.round(velocityRatio * 100) / 100,
    hour_of_day: hour,
    day_of_week: dow,
    active_drivers: activeDrivers,
    idle_drivers: idleDrivers,
    queue_depth: queueDepth ?? 0,
    is_peak_hour: peak,
  };

  const confidencePct = computeConfidence(
    { historical_avg_30min: historicalAvg, velocity_ratio: velocityRatio, is_peak_hour: peak },
    dayKeys.length,
  );

  // Keine Vorhersage bei sehr niedriger Konfidenz
  if (confidencePct < 20) {
    return { locationId, predictionId: null, intensity: null, confidencePct, broadcastsSent: 0, skipped: true, reason: 'confidence too low' };
  }

  // ── 5. Surge-Fenster: +30 bis +60 Min ──
  const surgeWindowStart = new Date(now.getTime() + 30 * 60 * 1000);
  const surgeWindowEnd   = new Date(now.getTime() + 60 * 60 * 1000);

  // Deduplizierung: kein neuer Datensatz wenn es schon eine Vorhersage für dieses Fenster gibt
  const { count: existingCount } = await sb
    .from('surge_predictions')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('surge_window_start', new Date(now.getTime() + 15 * 60 * 1000).toISOString())
    .lte('surge_window_start', new Date(now.getTime() + 45 * 60 * 1000).toISOString());

  if ((existingCount ?? 0) > 0) {
    return { locationId, predictionId: null, intensity, confidencePct, broadcastsSent: 0, skipped: true, reason: 'duplicate window' };
  }

  // ── 6. Vorhersage speichern ──
  const { data: predRow, error: predErr } = await sb
    .from('surge_predictions')
    .insert({
      location_id:         locationId,
      surge_window_start:  surgeWindowStart.toISOString(),
      surge_window_end:    surgeWindowEnd.toISOString(),
      predicted_intensity: intensity,
      confidence_pct:      confidencePct,
      signals,
    })
    .select('id')
    .single();

  if (predErr || !predRow) return { locationId, predictionId: null, intensity, confidencePct, broadcastsSent: 0, skipped: false };

  const predictionId = predRow.id as string;
  let broadcastsSent = 0;

  // ── 7. Fahrer mobilisieren (nur bei medium/high und wenn Bedarf besteht) ──
  if (broadcast && intensity !== 'low' && idleDrivers < 2) {
    // Finde Fahrer, die in den letzten 7 Tagen für diese Location gearbeitet haben
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentDriverShifts } = await sb
      .from('driver_shifts')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('planned_start', sevenDaysAgo)
      .is('actual_end', null)
      .limit(20);

    const uniqueDriverIds = [...new Set((recentDriverShifts ?? []).map((r) => r.driver_id as string))];

    // Offline-Fahrer (nicht in mise_drivers.status online/idle/active)
    const onlineIds = (driverRows ?? []).map((d) => d.id as string);
    const offlineIds = uniqueDriverIds.filter((id) => !onlineIds.includes(id));

    if (offlineIds.length > 0) {
      const broadcastMsg = buildBroadcastMessage(intensity, surgeWindowStart);

      try {
        await sendBroadcast({
          locationId,
          message: broadcastMsg,
          priority: intensity === 'high' ? 'urgent' : 'normal',
          sentByName: 'Smart Dispatch',
          expiresInHours: 1,
        });
        broadcastsSent = offlineIds.length;

        // Mobilisierungs-Events anlegen
        const mobilEvents = offlineIds.map((driverId) => ({
          prediction_id: predictionId,
          location_id:   locationId,
          driver_id:     driverId,
        }));

        await sb.from('surge_mobilization_events').insert(mobilEvents);

        // broadcasts_sent aktualisieren
        await sb
          .from('surge_predictions')
          .update({ broadcasts_sent: broadcastsSent })
          .eq('id', predictionId);
      } catch {
        // Broadcast-Fehler darf Vorhersage nicht verhindern
      }
    }
  }

  return { locationId, predictionId, intensity, confidencePct, broadcastsSent, skipped: false };
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export async function runSurgePredictionAllLocations(): Promise<{
  locations: number;
  predictions: number;
  broadcasts: number;
  skipped: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  let predictions = 0;
  let broadcasts = 0;
  let skipped = 0;

  await Promise.all(
    (locs ?? []).map(async (loc) => {
      const result = await predictSurgeForLocation(loc.id as string).catch(() => null);
      if (!result) return;
      if (result.skipped) { skipped++; return; }
      if (result.predictionId) predictions++;
      broadcasts += result.broadcastsSent;
    }),
  );

  return { locations: (locs ?? []).length, predictions, broadcasts, skipped };
}

// ─── Evaluierung ──────────────────────────────────────────────────────────────

export async function evaluatePastPredictions(): Promise<{ evaluated: number }> {
  const sb = createServiceClient();
  const now = new Date();

  // Vorhersagen deren Surge-Fenster abgelaufen und noch nicht evaluiert
  const { data: pending } = await sb
    .from('surge_predictions')
    .select('id, location_id, surge_window_start, surge_window_end, signals')
    .lt('surge_window_end', now.toISOString())
    .is('evaluated_at', null)
    .limit(50);

  let evaluated = 0;

  await Promise.all(
    (pending ?? []).map(async (pred) => {
      const signals = pred.signals as SurgeSignals;
      const expectedMinPerOrder = 3; // ~3 Min/Bestellung → 20 Best./h = normal
      const threshold = (signals.historical_avg_30min ?? 4) * 1.5;

      // Tatsächliche Bestellungen im Surge-Fenster zählen
      const { count: actual } = await sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', pred.location_id as string)
        .in('typ', ['lieferung'])
        .gte('created_at', pred.surge_window_start as string)
        .lte('created_at', pred.surge_window_end as string);

      const actualPeak = actual ?? 0;
      const wasAccurate = actualPeak >= threshold;

      await sb
        .from('surge_predictions')
        .update({
          actual_peak_orders: actualPeak,
          was_accurate:       wasAccurate,
          evaluated_at:       now.toISOString(),
        })
        .eq('id', pred.id as string);

      evaluated++;
    }),
  );

  return { evaluated };
}

// ─── Mobilisierungs-Tracking ──────────────────────────────────────────────────

export async function trackDriverCameOnline(
  driverId: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  await sb
    .from('surge_mobilization_events')
    .update({ came_online_at: now.toISOString() })
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .is('came_online_at', null)
    .gte('notified_at', cutoff);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getRecentPredictions(locationId: string): Promise<SurgePrediction[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_recent_surge_predictions')
    .select('*')
    .eq('location_id', locationId)
    .limit(20);

  return (data ?? []).map((row) => ({
    id:                  String(row.id),
    locationId:          String(row.location_id),
    predictedAt:         String(row.predicted_at),
    surgeWindowStart:    String(row.surge_window_start),
    surgeWindowEnd:      String(row.surge_window_end),
    predictedIntensity:  row.predicted_intensity as SurgeIntensity,
    confidencePct:       Number(row.confidence_pct),
    signals:             row.signals as SurgeSignals,
    broadcastsSent:      Number(row.broadcasts_sent),
    actualPeakOrders:    row.actual_peak_orders != null ? Number(row.actual_peak_orders) : null,
    wasAccurate:         row.was_accurate as boolean | null,
    evaluatedAt:         row.evaluated_at != null ? String(row.evaluated_at) : null,
    notifiedDrivers:     Number(row.notified_drivers ?? 0),
    respondedDrivers:    Number(row.responded_drivers ?? 0),
  }));
}

export async function getMobilizationStats(locationId: string): Promise<MobilizationStats> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_mobilization_effectiveness')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  return {
    predictionsTotal:      Number(data?.predictions_total ?? 0),
    accurate:              Number(data?.accurate ?? 0),
    inaccurate:            Number(data?.inaccurate ?? 0),
    accuracyPct:           data?.accuracy_pct != null ? Number(data.accuracy_pct) : null,
    notificationsSent:     Number(data?.notifications_sent ?? 0),
    driversMobilized:      Number(data?.drivers_mobilized ?? 0),
    mobilizationRatePct:   data?.mobilization_rate_pct != null ? Number(data.mobilization_rate_pct) : null,
    avgResponseTimeMin:    data?.avg_response_time_min != null ? Number(data.avg_response_time_min) : null,
  };
}

export async function getPredictionDashboard(locationId: string): Promise<PredictionDashboard> {
  const sb = createServiceClient();

  const [stats, recentPredictions, pendingCount] = await Promise.all([
    getMobilizationStats(locationId),
    getRecentPredictions(locationId),
    sb
      .from('surge_predictions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .lt('surge_window_end', new Date().toISOString())
      .is('evaluated_at', null)
      .then(({ count }) => count ?? 0),
  ]);

  return { stats, recentPredictions, pendingEvaluation: pendingCount };
}
