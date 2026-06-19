/**
 * lib/delivery/assignment-optimizer.ts
 *
 * Phase 276 — Live Order Assignment Optimizer
 *
 * Erweitert die Standard-Dispatch-Engine um Return-Prediction-Integration:
 *  - Berücksichtigt Fahrer, die in Kürze zurückkehren (Phase 274)
 *  - Erstellt Vorschläge (immediate / pre_assign / standby)
 *  - Score: Distanz 40 % + Auslastung 25 % + Rückkehr-Timing 20 % + Fahrzeug 15 %
 *  - Admin kann Vorschläge annehmen oder verwerfen
 *
 * Public API:
 *  buildAssignmentSuggestions(locationId)          — Vorschläge generieren + speichern
 *  buildSuggestionsAllLocations()                  — Cron-Batch
 *  acceptSuggestion(id, locationId)                — Vorschlag akzeptieren
 *  dismissSuggestion(id, locationId)               — Vorschlag verwerfen
 *  getSuggestionDashboard(locationId)              — Dashboard-Daten
 *  getActiveSuggestions(locationId)                — Aktive Vorschläge
 *  expireOldSuggestions(hoursOld?)                 — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fahrer gilt als "kehrt bald zurück" wenn ≤ diesen Minuten */
const PRE_ASSIGN_THRESHOLD_MIN = 20;
/** Maximale Vorschläge pro Bestellung */
const MAX_SUGGESTIONS_PER_ORDER = 3;
/** Mindest-Score für Vorschläge (0–100) */
const MIN_SCORE_THRESHOLD = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

export type SuggestionType = 'immediate' | 'pre_assign' | 'standby';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'expired' | 'auto_dispatched';

export interface AssignmentSuggestion {
  id: string;
  locationId: string;
  orderId: string;
  driverId: string;
  suggestionType: SuggestionType;
  score: number;
  status: SuggestionStatus;
  predictedReturnUtc: string | null;
  minutesUntilReturn: number | null;
  returnConfidence: number | null;
  reason: string;
  distanceKm: number | null;
  vehicle: 'bike' | 'car' | null;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  // Joined
  bestellnummer?: string | null;
  kundeAdresse?: string | null;
  gesamtbetrag?: number | null;
  priority?: string | null;
  driverName?: string | null;
  driverState?: string | null;
}

export interface OptimizerDashboard {
  locationId: string;
  summary: {
    pendingCount: number;
    immediateCount: number;
    preAssignCount: number;
    acceptedCount: number;
    autoDispatchedCount: number;
    dismissedCount: number;
    avgAcceptedScore: number | null;
    lastGeneratedAt: string | null;
  };
  suggestions: AssignmentSuggestion[];
  stats: {
    unassignedOrders: number;
    availableDrivers: number;
    returningDrivers: number;
  };
}

export interface BuildResult {
  locationId: string;
  suggestionsCreated: number;
  ordersAnalyzed: number;
  driversConsidered: number;
  durationMs: number;
}

// ── DB Row Types ──────────────────────────────────────────────────────────────

interface UnassignedOrderRow {
  id: string;
  bestellnummer: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  gesamtbetrag: number | null;
  priority: string | null;
  bestellart: string | null;
}

interface DriverRow {
  id: string;
  name: string | null;
  vehicle: 'bike' | 'car' | null;
  state: string | null;
  current_capacity: number | null;
  max_capacity: number | null;
  last_lat: number | null;
  last_lng: number | null;
  location_id: string;
}

interface ReturnPredictionRow {
  driver_id: string;
  estimated_return_utc: string | null;
  minutes_until_return: number | null;
  confidence: number | null;
  method: string | null;
}

interface LocationRow {
  id: string;
  lat: number | null;
  lng: number | null;
}

// ── Score Calculation ─────────────────────────────────────────────────────────

interface ScoreInput {
  driver: DriverRow;
  order: UnassignedOrderRow;
  location: LocationRow;
  returnPrediction: ReturnPredictionRow | null;
}

function computeScore(input: ScoreInput): { score: number; type: SuggestionType; reason: string } {
  const { driver, order, location, returnPrediction } = input;

  // ── Distanz-Score (40 Pkt): Fahrer-Position → Kunden-Adresse ────────────────
  let distanceScore = 20; // Default wenn keine Position bekannt
  let distanceKm: number | null = null;

  const driverLat = driver.last_lat ?? location.lat;
  const driverLng = driver.last_lng ?? location.lng;

  if (
    driverLat != null && driverLng != null &&
    order.kunde_lat != null && order.kunde_lng != null
  ) {
    distanceKm = haversineKm(
      { lat: driverLat, lng: driverLng },
      { lat: order.kunde_lat, lng: order.kunde_lng },
    );
    // 0 km → 40 Pkt, 3 km → 20 Pkt, 8 km → 0 Pkt
    distanceScore = Math.max(0, Math.min(40, Math.round(40 - (distanceKm / 8) * 40)));
  }

  // ── Auslastungs-Score (25 Pkt): Weniger Last → höher ───────────────────────
  const maxCap = driver.max_capacity ?? 3;
  const currCap = driver.current_capacity ?? 0;
  const loadRatio = maxCap > 0 ? currCap / maxCap : 0;
  const loadScore = Math.round((1 - loadRatio) * 25);

  // ── Rückkehr-Timing-Score (20 Pkt) ─────────────────────────────────────────
  let timingScore = 0;
  const minutesUntilReturn = returnPrediction?.minutes_until_return ?? null;
  const isAvailableNow =
    driver.state === 'idle' || driver.state === 'returning';

  if (isAvailableNow && !returnPrediction) {
    timingScore = 20; // Sofort verfügbar
  } else if (minutesUntilReturn != null) {
    if (minutesUntilReturn <= 5) timingScore = 20;
    else if (minutesUntilReturn <= 10) timingScore = 15;
    else if (minutesUntilReturn <= PRE_ASSIGN_THRESHOLD_MIN) timingScore = 10;
    else timingScore = 5;
  }

  // ── Fahrzeug-Score (15 Pkt): Auto besser für weite Strecken ────────────────
  let vehicleScore = 8; // bike default
  if (driver.vehicle === 'car') {
    vehicleScore = distanceKm != null && distanceKm > 3 ? 15 : 10;
  } else {
    vehicleScore = distanceKm != null && distanceKm <= 3 ? 12 : 8;
  }

  const totalScore = Math.min(100, distanceScore + loadScore + timingScore + vehicleScore);

  // ── Suggestion Type ─────────────────────────────────────────────────────────
  let type: SuggestionType;
  if (isAvailableNow && currCap < maxCap) {
    type = 'immediate';
  } else if (minutesUntilReturn != null && minutesUntilReturn <= PRE_ASSIGN_THRESHOLD_MIN) {
    type = 'pre_assign';
  } else {
    type = 'standby';
  }

  // ── Reason Text ────────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (distanceKm != null) parts.push(`${distanceKm.toFixed(1)} km`);
  if (type === 'immediate') parts.push('sofort verfügbar');
  if (type === 'pre_assign' && minutesUntilReturn != null)
    parts.push(`kehrt in ${minutesUntilReturn} Min zurück`);
  if (type === 'standby') parts.push('Reserve');
  if (loadRatio < 0.4) parts.push('gering ausgelastet');
  const reason = parts.join(' · ') || 'Empfehlung';

  return { score: totalScore, type, reason };
}

// ── Build Suggestions for One Location ───────────────────────────────────────

export async function buildAssignmentSuggestions(locationId: string): Promise<BuildResult> {
  const start = Date.now();
  const svc = createServiceClient();

  // 1. Location-Koordinaten
  const { data: locRow } = await svc
    .from('locations')
    .select('id, lat, lng')
    .eq('id', locationId)
    .single();

  const location: LocationRow = {
    id: locationId,
    lat: (locRow as LocationRow | null)?.lat ?? null,
    lng: (locRow as LocationRow | null)?.lng ?? null,
  };

  // 2. Unzugewiesene Lieferbestellungen (ohne aktiven Fahrer)
  const { data: orders } = await svc
    .from('customer_orders')
    .select('id, bestellnummer, kunde_lat, kunde_lng, kunde_adresse, gesamtbetrag, priority, bestellart')
    .eq('location_id', locationId)
    .in('status', ['bereit_zur_lieferung', 'in_zubereitung'])
    .is('mise_driver_id', null)
    .order('bestellt_am', { ascending: true })
    .limit(20);

  const orderList = (orders ?? []) as UnassignedOrderRow[];

  if (orderList.length === 0) {
    return { locationId, suggestionsCreated: 0, ordersAnalyzed: 0, driversConsidered: 0, durationMs: Date.now() - start };
  }

  // 3. Aktive Fahrer laden
  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id, name, vehicle, state, current_capacity, max_capacity, last_lat, last_lng, location_id')
    .eq('location_id', locationId)
    .eq('active', true)
    .in('state', ['idle', 'returning', 'assigned', 'at_restaurant', 'en_route']);

  const driverList = (drivers ?? []) as DriverRow[];

  if (driverList.length === 0) {
    return { locationId, suggestionsCreated: 0, ordersAnalyzed: orderList.length, driversConsidered: 0, durationMs: Date.now() - start };
  }

  // 4. Letzte Return Predictions laden
  const driverIds = driverList.map((d) => d.id);
  const { data: predictions } = await svc
    .from('driver_return_predictions')
    .select('driver_id, estimated_return_utc, minutes_until_return, confidence, method')
    .in('driver_id', driverIds)
    .eq('location_id', locationId)
    .gte('predicted_at', new Date(Date.now() - 10 * 60_000).toISOString()) // max 10 Min alt
    .order('predicted_at', { ascending: false });

  // Neueste Vorhersage je Fahrer
  const predMap = new Map<string, ReturnPredictionRow>();
  for (const p of (predictions ?? []) as ReturnPredictionRow[]) {
    if (!predMap.has(p.driver_id)) predMap.set(p.driver_id, p);
  }

  // 5. Vorschläge berechnen
  const rows: Record<string, unknown>[] = [];

  for (const order of orderList) {
    const scoredDrivers: Array<{
      driver: DriverRow;
      score: number;
      type: SuggestionType;
      reason: string;
      returnPrediction: ReturnPredictionRow | null;
    }> = [];

    for (const driver of driverList) {
      const returnPrediction = predMap.get(driver.id) ?? null;
      const { score, type, reason } = computeScore({ driver, order, location, returnPrediction });

      if (score >= MIN_SCORE_THRESHOLD) {
        scoredDrivers.push({ driver, score, type, reason, returnPrediction });
      }
    }

    // Top N Fahrer je Bestellung
    scoredDrivers.sort((a, b) => b.score - a.score);
    const topDrivers = scoredDrivers.slice(0, MAX_SUGGESTIONS_PER_ORDER);

    for (const sd of topDrivers) {
      const rp = sd.returnPrediction;
      const driverLat = sd.driver.last_lat ?? location.lat;
      const driverLng = sd.driver.last_lng ?? location.lng;
      let distKm: number | null = null;
      if (driverLat != null && driverLng != null && order.kunde_lat != null && order.kunde_lng != null) {
        distKm = haversineKm({ lat: driverLat, lng: driverLng }, { lat: order.kunde_lat, lng: order.kunde_lng });
      }

      rows.push({
        location_id:          locationId,
        order_id:             order.id,
        driver_id:            sd.driver.id,
        suggestion_type:      sd.type,
        score:                sd.score,
        status:               'pending',
        predicted_return_utc: rp?.estimated_return_utc ?? null,
        minutes_until_return: rp?.minutes_until_return ?? null,
        return_confidence:    rp?.confidence ?? null,
        reason:               sd.reason,
        distance_km:          distKm != null ? Math.round(distKm * 100) / 100 : null,
        vehicle:              sd.driver.vehicle,
        expires_at:           new Date(Date.now() + 15 * 60_000).toISOString(),
      });
    }
  }

  if (rows.length === 0) {
    return { locationId, suggestionsCreated: 0, ordersAnalyzed: orderList.length, driversConsidered: driverList.length, durationMs: Date.now() - start };
  }

  // 6. Alte pending-Vorschläge für diese Location expiren
  await svc
    .from('assignment_suggestions')
    .update({ status: 'expired', resolved_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('status', 'pending');

  // 7. Neue Vorschläge upserten
  const { error } = await svc
    .from('assignment_suggestions')
    .upsert(rows, { onConflict: 'order_id,driver_id', ignoreDuplicates: false });

  if (error) throw new Error(`assignment_suggestions upsert failed: ${error.message}`);

  return {
    locationId,
    suggestionsCreated: rows.length,
    ordersAnalyzed: orderList.length,
    driversConsidered: driverList.length,
    durationMs: Date.now() - start,
  };
}

// ── Cron Batch ────────────────────────────────────────────────────────────────

export async function buildSuggestionsAllLocations(): Promise<BuildResult[]> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  const results = await Promise.allSettled(
    ((locs ?? []) as { id: string }[]).map((l) => buildAssignmentSuggestions(l.id)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<BuildResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ── Accept / Dismiss ──────────────────────────────────────────────────────────

export async function acceptSuggestion(id: string, locationId: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('assignment_suggestions')
    .update({ status: 'accepted', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('location_id', locationId)
    .eq('status', 'pending');
}

export async function dismissSuggestion(id: string, locationId: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('assignment_suggestions')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('location_id', locationId)
    .eq('status', 'pending');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getSuggestionDashboard(locationId: string): Promise<OptimizerDashboard> {
  const svc = createServiceClient();

  const [
    { data: summaryRows },
    { data: suggestionRows },
    { count: unassignedCount },
    { count: availableDriverCount },
    { count: returningDriverCount },
  ] = await Promise.all([
    svc.from('v_assignment_optimizer_summary').select('*').eq('location_id', locationId).maybeSingle(),
    svc.from('v_assignment_suggestions_active').select('*').eq('location_id', locationId).limit(50),
    svc.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['bereit_zur_lieferung', 'in_zubereitung'])
      .is('mise_driver_id', null),
    svc.from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('active', true)
      .in('state', ['idle', 'returning']),
    svc.from('driver_return_predictions')
      .select('driver_id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .lte('minutes_until_return', PRE_ASSIGN_THRESHOLD_MIN)
      .gte('predicted_at', new Date(Date.now() - 10 * 60_000).toISOString()),
  ]);

  const sum = summaryRows as {
    pending_count: number;
    immediate_count: number;
    pre_assign_count: number;
    accepted_count: number;
    auto_dispatched_count: number;
    dismissed_count: number;
    avg_accepted_score: number | null;
    last_generated_at: string | null;
  } | null;

  const suggestions: AssignmentSuggestion[] = ((suggestionRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id:                  r.id as string,
    locationId:          r.location_id as string,
    orderId:             r.order_id as string,
    driverId:            r.driver_id as string,
    suggestionType:      r.suggestion_type as SuggestionType,
    score:               Number(r.score),
    status:              r.status as SuggestionStatus,
    predictedReturnUtc:  r.predicted_return_utc as string | null,
    minutesUntilReturn:  r.minutes_until_return as number | null,
    returnConfidence:    r.return_confidence != null ? Number(r.return_confidence) : null,
    reason:              r.reason as string,
    distanceKm:          r.distance_km != null ? Number(r.distance_km) : null,
    vehicle:             r.vehicle as 'bike' | 'car' | null,
    createdAt:           r.created_at as string,
    expiresAt:           r.expires_at as string,
    resolvedAt:          r.resolved_at as string | null,
    bestellnummer:       r.bestellnummer as string | null,
    kundeAdresse:        r.kunde_adresse as string | null,
    gesamtbetrag:        r.gesamtbetrag != null ? Number(r.gesamtbetrag) : null,
    priority:            r.priority as string | null,
    driverName:          r.driver_name as string | null,
    driverState:         r.driver_state as string | null,
  }));

  return {
    locationId,
    summary: {
      pendingCount:          sum?.pending_count ?? 0,
      immediateCount:        sum?.immediate_count ?? 0,
      preAssignCount:        sum?.pre_assign_count ?? 0,
      acceptedCount:         sum?.accepted_count ?? 0,
      autoDispatchedCount:   sum?.auto_dispatched_count ?? 0,
      dismissedCount:        sum?.dismissed_count ?? 0,
      avgAcceptedScore:      sum?.avg_accepted_score ?? null,
      lastGeneratedAt:       sum?.last_generated_at ?? null,
    },
    suggestions,
    stats: {
      unassignedOrders: unassignedCount ?? 0,
      availableDrivers: availableDriverCount ?? 0,
      returningDrivers: returningDriverCount ?? 0,
    },
  };
}

export async function getActiveSuggestions(locationId: string): Promise<AssignmentSuggestion[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('v_assignment_suggestions_active')
    .select('*')
    .eq('location_id', locationId)
    .limit(30);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:                  r.id as string,
    locationId:          r.location_id as string,
    orderId:             r.order_id as string,
    driverId:            r.driver_id as string,
    suggestionType:      r.suggestion_type as SuggestionType,
    score:               Number(r.score),
    status:              r.status as SuggestionStatus,
    predictedReturnUtc:  r.predicted_return_utc as string | null,
    minutesUntilReturn:  r.minutes_until_return as number | null,
    returnConfidence:    r.return_confidence != null ? Number(r.return_confidence) : null,
    reason:              r.reason as string,
    distanceKm:          r.distance_km != null ? Number(r.distance_km) : null,
    vehicle:             r.vehicle as 'bike' | 'car' | null,
    createdAt:           r.created_at as string,
    expiresAt:           r.expires_at as string,
    resolvedAt:          r.resolved_at as string | null,
    bestellnummer:       r.bestellnummer as string | null,
    kundeAdresse:        r.kunde_adresse as string | null,
    gesamtbetrag:        r.gesamtbetrag != null ? Number(r.gesamtbetrag) : null,
    priority:            r.priority as string | null,
    driverName:          r.driver_name as string | null,
    driverState:         r.driver_state as string | null,
  }));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function expireOldSuggestions(hoursOld = 1): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('expire_old_assignment_suggestions', { p_hours: hoursOld });
  if (error) throw new Error(`expire_old_assignment_suggestions failed: ${error.message}`);
  return (data as number) ?? 0;
}
