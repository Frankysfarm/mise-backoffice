/**
 * lib/delivery/dispatch-engine.ts
 *
 * Smart Dispatch Engine — Kern-Algorithmus.
 * Koordiniert Scoring, Bündelung, Zonen, ETA und Küchen-Sync.
 *
 * Ablauf für jede unzugewiesene Bestellung:
 *  1. Zone berechnen (A/B/C/D)
 *  2. Verfügbare Fahrer laden + Scoring
 *  3. Bündelungs-Check für besten Fahrer
 *  4. Tour erstellen oder Bundle anhängen
 *  5. Tour optimieren (Route-Berechnung)
 *  6. ETA berechnen + Bestellung updaten
 *  7. Küchen-Timing synchronisieren
 *  8. Scoring in dispatch_scores loggen
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { haversineKm, geocode } from '@/lib/google-maps';
import { classifyZone } from './zones';
import { scoreDriver, rankDrivers, type DriverScoreInput, type OrderScoreInput } from './scoring';
import { findBundleCandidates, appendToTour, MAX_DETOUR_KM } from './bundling';
import { getZoneDifficultyModifiers } from './zone-difficulty';
import { optimizeTour } from './tour-optimizer';
import { calculateEta, updateOrderEta } from './eta';
import { upsertKitchenTiming } from './kitchen-sync';
import { logDeliveryEvent } from './events';
import { enqueueBatchPush } from './push-notify';
import { logEtaPrediction } from './eta-calibration';
import { recordCustomerEvent } from './customer-notify';
import { markWindowDispatched } from './windows';
import { sortByPriority } from './queue-intelligence';
import { getDriverZoneAffinities } from './zone-affinity';
import { getScoringV2Config, rankDriversV2, enrichDriversV2, type DriverScoreInputV2 } from './scoring-v2';
import type { ZoneName } from './zones';

// Phase 59: Compliance-blocked drivers are excluded from dispatch
// Import is lazy-evaluated to avoid circular deps and handle missing migration gracefully

export interface DispatchResult {
  orderId: string;
  outcome: 'dispatched' | 'bundled' | 'held';
  batchId: string | null;
  driverId: string | null;
  zone: ZoneName | null;
  score: number | null;
  reason: string;
  escalated?: boolean;
}

interface OrderRow {
  id: string;
  location_id: string;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  bestellnummer: string;
  priority: string | null;
  estimated_prep_min: number | null;
  created_at: string;
  dispatch_attempts: number;
  dispatch_escalated_at: string | null;
  schedule_status: 'scheduled' | 'released' | 'immediate' | null;
  delivery_zone?: string | null;
  dispatch_priority_boost?: number;
  status?: string | null;
}

interface LocationRow {
  id: string;
  tenant_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
  plz: string | null;
  stadt: string | null;
}

interface DriverRow {
  id: string;
  employee_id: string | null;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  last_lat: number | null;
  last_lng: number | null;
  current_capacity: number;
  max_capacity: number;
  total_deliveries: number;
  state: string;
  active: boolean;
  mise_batch_id?: string | null;
}

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => fetch(i as RequestInfo, { ...init, cache: 'no-store' }) },
    },
  );
  return _sb;
}

/** Dispatch-Tick: alle unzugewiesenen Lieferungs-Orders dispatchen. */
export async function smartDispatchTick(): Promise<{
  scanned: number;
  dispatched: number;
  bundled: number;
  held: number;
  escalated: number;
  results: DispatchResult[];
}> {
  const { data: rawOrders } = await sb()
    .from('customer_orders')
    .select('id, location_id, status, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at, dispatch_attempts, dispatch_escalated_at, schedule_status, delivery_zone, dispatch_priority_boost')
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .in('status', ['neu', 'in_zubereitung', 'fertig'])
    // Vorbestellungen (schedule_status='scheduled') überspringen — nur freigeben wenn Küche-Startzeit erreicht
    .or('schedule_status.is.null,schedule_status.neq.scheduled')
    .order('created_at', { ascending: true })
    .limit(50);

  // Phase 55: Smart Priority Queue — VIP/Express/fertige/Zone-D-Orders zuerst
  const orders = sortByPriority((rawOrders ?? []) as OrderRow[]);

  const results: DispatchResult[] = [];
  const now = new Date().toISOString();

  for (const o of orders) {
    const row = o as OrderRow;
    // Eskalations-Radius: nach ≥3 Versuchen Radius um 50% erweitern
    const radiusFactor = row.dispatch_attempts >= 3 ? 1.5 : 1.0;
    const r = await dispatchSingleOrder(row, radiusFactor);
    results.push(r);

    if (r.outcome === 'held') {
      // Fehlversuch tracken + ggf. Eskalation markieren
      const newAttempts = row.dispatch_attempts + 1;
      const needsEscalation = newAttempts >= 3 && !row.dispatch_escalated_at;
      const patch: Record<string, unknown> = {
        dispatch_attempts:        newAttempts,
        last_dispatch_attempt_at: now,
      };
      if (needsEscalation) {
        patch.dispatch_escalated_at = now;
        r.escalated = true;
        logDeliveryEvent({
          event_type:  'order_held',
          location_id: row.location_id,
          order_id:    row.id,
          payload:     { attempts: newAttempts, reason: r.reason, escalated: true },
        });
      }
      await sb().from('customer_orders').update(patch).eq('id', row.id);
    }
  }

  return {
    scanned:   results.length,
    dispatched: results.filter((r) => r.outcome === 'dispatched').length,
    bundled:    results.filter((r) => r.outcome === 'bundled').length,
    held:       results.filter((r) => r.outcome === 'held').length,
    escalated:  results.filter((r) => r.escalated).length,
    results,
  };
}

export async function dispatchSingleOrder(o: OrderRow, radiusFactor = 1.0): Promise<DispatchResult> {
  const held = (reason: string): DispatchResult => ({
    orderId: o.id, outcome: 'held', batchId: null, driverId: null, zone: null, score: null, reason,
  });

  if (!o.location_id) return held('Keine location_id');

  // 1) Location laden
  const { data: locRaw } = await sb()
    .from('locations')
    .select('id, tenant_id, name, lat, lng, adresse, plz, stadt')
    .eq('id', o.location_id)
    .maybeSingle();
  if (!locRaw) return held('Location nicht gefunden');
  const loc = locRaw as LocationRow;
  if (loc.lat == null || loc.lng == null) return held('Restaurant nicht geocodiert');

  // 2) Kunden-Koordinaten bestimmen
  if (o.kunde_lat == null || o.kunde_lng == null) {
    const addr = [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean).join(', ');
    if (!addr) return held('Keine Lieferadresse');
    try {
      const g = await geocode(addr);
      if (!g) return held(`Adresse nicht auflösbar: ${addr}`);
      await sb().from('customer_orders').update({ kunde_lat: g.lat, kunde_lng: g.lng }).eq('id', o.id);
      o.kunde_lat = g.lat;
      o.kunde_lng = g.lng;
    } catch (e) {
      return held(`Geocoding-Fehler: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3) Zone berechnen
  const { zone, zoneConfig, distanceKm } = await classifyZone(
    o.location_id,
    { lat: loc.lat, lng: loc.lng },
    { lat: o.kunde_lat!, lng: o.kunde_lng! },
  );
  await sb().from('customer_orders').update({ delivery_zone: zone }).eq('id', o.id);

  // Phase 356: Zone-Schwierigkeits-Modifikatoren laden (best-effort, kein Fehler bei fehlender Tabelle)
  const zoneDiffMap = await getZoneDifficultyModifiers(o.location_id).catch(() => null);
  const zoneMod = zoneDiffMap?.[zone];
  const adjustedDetourKm = MAX_DETOUR_KM * (zoneMod?.detourModifier ?? 1.0);
  const adjustedMaxCap   = Math.max(1, Math.floor(4 * (zoneMod?.stopCountModifier ?? 1.0)));

  // 4) Fahrer-Pool
  const drivers = await loadActiveDrivers(loc.tenant_id);
  if (drivers.length === 0) return held('Kein aktiver Fahrer verfügbar');

  const orderInput: OrderScoreInput = {
    id: o.id,
    location_id: o.location_id,
    kunde_lat: o.kunde_lat!,
    kunde_lng: o.kunde_lng!,
    restaurant_lat: loc.lat,
    restaurant_lng: loc.lng,
    zone,
    priority: (o.priority ?? 'normal') as OrderScoreInput['priority'],
    estimated_prep_min: o.estimated_prep_min ?? 15,
    created_at: o.created_at,
  };

  // Radius-Filter (radiusFactor > 1 bei eskalierten Bestellungen)
  const nearby = drivers.filter((d) => {
    if (d.last_lat == null || d.last_lng == null) return true;
    return haversineKm({ lat: d.last_lat, lng: d.last_lng }, { lat: loc.lat!, lng: loc.lng! }) <= d.max_radius_km * radiusFactor;
  });
  if (nearby.length === 0) return held(`Kein Fahrer im Radius (${radiusFactor > 1 ? `×${radiusFactor} eskaliert` : 'normal'})`);

  // 5) Scoring — load zone affinities + optionally V2 config
  const nearbyIds = nearby.map((d) => d.id);
  const [zoneAffinities, scoringV2Config] = await Promise.all([
    getDriverZoneAffinities(nearbyIds, o.location_id).catch(() => ({} as Record<string, Record<string, number>>)),
    getScoringV2Config(o.location_id).catch(() => null),
  ]);

  let ranked: Array<{ driver: DriverScoreInput; score: import('./scoring').ScoreBreakdown }>;

  if (scoringV2Config?.isActive) {
    // V2: enrich drivers with weather + velocity context
    const enriched = await enrichDriversV2(nearbyIds, o.location_id, scoringV2Config).catch(
      () => new Map<string, { weatherDifficulty: number; deliveriesToday: number; shiftActiveMinutes: number; zoneVehicleSuccessRate: Record<string, number> }>(),
    );
    const zoneVehicleRates = enriched.get(nearbyIds[0] ?? '')?.zoneVehicleSuccessRate ?? {};

    const driverInputsV2: DriverScoreInputV2[] = nearby.map((d) => {
      const ctx = enriched.get(d.id);
      return {
        id: d.id,
        vehicle: d.vehicle,
        last_lat: d.last_lat,
        last_lng: d.last_lng,
        current_capacity: d.current_capacity,
        max_capacity: d.max_capacity,
        total_deliveries: d.total_deliveries,
        active_batch_id: d.mise_batch_id ?? null,
        zone_affinity: zoneAffinities[d.id] ?? null,
        weather_difficulty: ctx?.weatherDifficulty ?? null,
        deliveries_today: ctx?.deliveriesToday ?? null,
        shift_active_minutes: ctx?.shiftActiveMinutes ?? null,
      };
    });

    const rankedV2 = rankDriversV2(driverInputsV2, orderInput, scoringV2Config, zoneVehicleRates);
    // Cast to V1 shape (ScoreBreakdownV2 extends ScoreBreakdown)
    ranked = rankedV2 as unknown as typeof ranked;
  } else {
    // V1 (default)
    const driverInputs: DriverScoreInput[] = nearby.map((d) => ({
      id: d.id,
      vehicle: d.vehicle,
      last_lat: d.last_lat,
      last_lng: d.last_lng,
      current_capacity: d.current_capacity,
      max_capacity: d.max_capacity,
      total_deliveries: d.total_deliveries,
      active_batch_id: d.mise_batch_id ?? null,
      zone_affinity: zoneAffinities[d.id] ?? null,
    }));
    ranked = rankDrivers(driverInputs, orderInput);
  }

  if (ranked.length === 0) return held('Alle Fahrer sind voll');

  const best = ranked[0];
  const bestScore = best.score;

  // 6) Bündelung prüfen (mit Zone-Difficulty-Modifikatoren)
  const restaurantAddress = [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name;
  const bundleDecision = await findBundleCandidates(
    best.driver.id,
    loc.lat,
    loc.lng,
    o.kunde_lat!,
    o.kunde_lng!,
    adjustedDetourKm,
    adjustedMaxCap,
  );

  let batchId: string;
  let outcome: 'dispatched' | 'bundled';

  if (bundleDecision.shouldBundle && bundleDecision.candidateBatchId) {
    // An bestehende Tour anhängen
    await appendToTour(
      bundleDecision.candidateBatchId,
      o.id,
      loc.lat,
      loc.lng,
      restaurantAddress,
      o.kunde_lat!,
      o.kunde_lng!,
      o.kunde_adresse,
    );
    batchId = bundleDecision.candidateBatchId;
    outcome = 'bundled';
    // appendToTour setzt nur mise_batch_id — mise_driver_id muss separat gesetzt werden
    await sb().from('customer_orders')
      .update({ mise_driver_id: best.driver.id })
      .eq('id', o.id);
  } else {
    // Neue Tour erstellen
    const { data: newBatch, error } = await sb()
      .from('mise_delivery_batches')
      .insert({
        driver_id:    best.driver.id,
        location_id:  o.location_id,
        state:        'pending_acceptance',
        zone,
        dispatch_score: bestScore.total,
        stop_count:   2,
      })
      .select('id')
      .single();
    if (error || !newBatch) return held(`Batch-Insert fehlgeschlagen: ${error?.message}`);
    batchId = (newBatch as { id: string }).id;

    await sb().from('mise_delivery_batch_stops').insert([
      {
        batch_id: batchId, order_id: o.id, type: 'pickup', sequence: 0,
        lat: loc.lat, lng: loc.lng, address: restaurantAddress,
      },
      {
        batch_id: batchId, order_id: o.id, type: 'dropoff', sequence: 1,
        lat: o.kunde_lat, lng: o.kunde_lng, address: o.kunde_adresse,
      },
    ]);

    await sb().from('customer_orders')
      .update({ mise_batch_id: batchId, mise_driver_id: best.driver.id })
      .eq('id', o.id);

    outcome = 'dispatched';
  }

  // driver_status.aktueller_batch_id synchronisieren (Legacy-Board zeigt Mise-Fahrer als belegt)
  const bestRow = nearby.find((d) => d.id === best.driver.id);
  if (bestRow?.employee_id) {
    sb().from('driver_status')
      .update({ aktueller_batch_id: batchId })
      .eq('employee_id', bestRow.employee_id)
      .then(() => {});
  }

  // 7) Tour optimieren
  try { await optimizeTour(batchId); } catch { /* Non-fatal */ }

  // 8) ETA berechnen
  const prepMin = o.estimated_prep_min ?? 15;
  const orderAgeMins = (Date.now() - new Date(o.created_at).getTime()) / 60_000;
  const prepMinRemaining = Math.max(0, prepMin - orderAgeMins);
  const eta = await calculateEta({
    locationId: o.location_id,
    restaurantLat: loc.lat,
    restaurantLng: loc.lng,
    customerLat: o.kunde_lat!,
    customerLng: o.kunde_lng!,
    driverLat: best.driver.last_lat,
    driverLng: best.driver.last_lng,
    vehicle: best.driver.vehicle,
    zone,
    prepMinRemaining,
    stopsBefore: 0,
  });
  await sb().from('customer_orders').update({
    eta_earliest: eta.earliestUtc.toISOString(),
    eta_latest:   eta.latestUtc.toISOString(),
    dispatch_score: bestScore.total,
  }).eq('id', o.id);

  // 9a) ETA-Vorhersage für Kalibrierungs-Engine loggen (fire-and-forget)
  const nowForCalib = new Date();
  const predictedEarliestMin =
    (eta.earliestUtc.getTime() - nowForCalib.getTime()) / 60_000;
  const predictedLatestMin =
    (eta.latestUtc.getTime() - nowForCalib.getTime()) / 60_000;
  logEtaPrediction({
    orderId:             o.id,
    locationId:          o.location_id,
    batchId,
    driverId:            best.driver.id,
    zone,
    vehicle:             best.driver.vehicle,
    predictedEarliestMin,
    predictedLatestMin,
  }).catch(() => {});

  // 9) Küchen-Timing
  try {
    await upsertKitchenTiming({
      locationId:       o.location_id,
      orderId:          o.id,
      batchId,
      tourPickupAt:     eta.earliestUtc,
      estimatedPrepMin: prepMin,
    });
  } catch { /* Non-fatal */ }

  // 10) Scoring loggen
  await sb().from('dispatch_scores').insert({
    location_id:   o.location_id,
    order_id:      o.id,
    driver_id:     best.driver.id,
    batch_id:      batchId,
    total_score:   bestScore.total,
    f_distance:    bestScore.f_distance,
    f_load:        bestScore.f_load,
    f_vehicle:     bestScore.f_vehicle,
    f_experience:  bestScore.f_experience,
    f_zone:        bestScore.f_zone,
    f_prep_time:   bestScore.f_prep_time,
    f_time_of_day: bestScore.f_time_of_day,
    f_priority:    bestScore.f_priority,
    f_bundle_fit:  bestScore.f_bundle_fit,
    f_history:     bestScore.f_history,
    decision:      outcome,
    reason:        bundleDecision.reason || `Score ${bestScore.total.toFixed(1)}, Zone ${zone}`,
  }).then(() => {});

  // Audit-Event (fire-and-forget)
  logDeliveryEvent({
    event_type:  outcome === 'bundled' ? 'order_bundled' : 'order_dispatched',
    location_id: o.location_id,
    order_id:    o.id,
    batch_id:    batchId,
    driver_id:   best.driver.id,
    payload: {
      zone,
      score:       bestScore.total,
      distance_km: distanceKm,
    },
  });

  // Push-Benachrichtigung an Fahrer (fire-and-forget)
  const restaurantName = [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name;
  enqueueBatchPush({
    driverId:       best.driver.id,
    batchId,
    orderCount:     1,
    restaurantName,
    distanceKm,
    outcome,
  }).catch(() => {});

  // Window-Buchung: Status auf 'dispatched' setzen (fire-and-forget)
  markWindowDispatched(o.id).catch(() => {});

  // Customer Event Feed: Fahrer zugewiesen (fire-and-forget)
  recordCustomerEvent(o.id, o.location_id, 'driver_assigned', {
    driver_id:     best.driver.id,
    batch_id:      batchId,
    zone,
    eta_earliest:  eta.earliestUtc.toISOString(),
    eta_latest:    eta.latestUtc.toISOString(),
  }).catch(() => {});

  return {
    orderId: o.id,
    outcome,
    batchId,
    driverId: best.driver.id,
    zone,
    score: bestScore.total,
    reason: `${outcome}: Fahrer ${best.driver.id.slice(0, 8)}, Score ${bestScore.total.toFixed(1)}, Zone ${zone}, ${distanceKm.toFixed(1)} km`,
  };
}

async function loadActiveDrivers(tenantId: string): Promise<DriverRow[]> {
  const { data } = await sb()
    .from('mise_drivers')
    .select('id, employee_id, vehicle, max_radius_km, last_lat, last_lng, current_capacity, max_capacity, total_deliveries, state, active')
    .eq('active', true)
    .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning'])
    .order('last_position_at', { ascending: false });

  if (!data) return [];

  // Tenant-Filter über locations (Fahrer gehören zu Tenants via location)
  const { data: locations } = await sb()
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId);
  const locationIds = new Set((locations ?? []).map((l) => l.id as string));

  // Aktive Batches für alle Fahrer in einer einzigen Query laden (kein N+1)
  const drivers = data as DriverRow[];
  const driverIds = drivers.map((d) => d.id);
  const batchMap = new Map<string, { id: string; stop_count: number }>();

  if (driverIds.length > 0) {
    const { data: activeBatches } = await sb()
      .from('mise_delivery_batches')
      .select('id, driver_id, stop_count')
      .in('driver_id', driverIds)
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
      .order('created_at', { ascending: false });

    for (const b of activeBatches ?? []) {
      const dId = b.driver_id as string;
      if (!batchMap.has(dId)) {
        batchMap.set(dId, { id: b.id as string, stop_count: b.stop_count as number });
      }
    }
  }

  for (const d of drivers) {
    const batch = batchMap.get(d.id);
    (d as DriverRow & { mise_batch_id?: string | null }).mise_batch_id = batch?.id ?? null;
    d.current_capacity = batch ? Math.floor(batch.stop_count / 2) : 0;
  }

  // Da wir keinen direkten Tenant-Filter auf mise_drivers haben, alle aktiven zurückgeben
  // (Frank-Kompatibilität — Fahrer sind systemweit aktiv, nicht location-gebunden)
  void locationIds; // multi-tenant wird über Frank-Routing sichergestellt

  // Phase 59: Compliance-Block — food_hygiene abgelaufen/gesperrt → Fahrer ausschließen
  if (drivers.length > 0) {
    try {
      const { data: blockedCerts } = await sb()
        .from('driver_certifications')
        .select('driver_id')
        .in('driver_id', drivers.map((d) => d.id))
        .eq('cert_type', 'food_hygiene')
        .in('status', ['expired', 'suspended']);
      if (blockedCerts && blockedCerts.length > 0) {
        const blocked = new Set(blockedCerts.map((c) => String((c as { driver_id: string }).driver_id)));
        return drivers.filter((d) => !blocked.has(d.id));
      }
    } catch {
      // Graceful fallback: wenn Tabelle noch nicht migriert → alle Fahrer erlaubt
    }
  }

  // Phase 355: Absent drivers (approved absence today) are excluded from dispatch
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data: absentRows } = await sb()
      .from('driver_absences')
      .select('driver_id')
      .in('driver_id', drivers.map((d) => d.id))
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    if (absentRows && absentRows.length > 0) {
      const absentSet = new Set(absentRows.map((r) => String((r as { driver_id: string }).driver_id)));
      return drivers.filter((d) => !absentSet.has(d.id));
    }
  } catch {
    // Graceful fallback: if driver_absences table missing, all drivers allowed
  }

  return drivers;
}
