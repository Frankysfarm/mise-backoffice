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
import { rankDrivers, type DriverScoreInput, type OrderScoreInput } from './scoring';
import { findBundleCandidates } from './bundling';
import { optimizeTour } from './tour-optimizer';
import { calculateEta } from './eta';
import { upsertKitchenTiming } from './kitchen-sync';
import { logDeliveryEvent } from './events';
import { enqueueBatchPush } from './push-notify';
import { logEtaPrediction } from './eta-calibration';
import { recordCustomerEvent } from './customer-notify';
import { markWindowDispatched } from './windows';
import type { ZoneName } from './zones';

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
  auth_user_id: string | null;
  employee_id: string | null;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  last_lat: number | null;
  last_lng: number | null;
  current_capacity: number;
  max_capacity: number;
  total_deliveries: number;
  rating?: number | null;
  avg_delivery_min?: number | null;
  zone?: ZoneName | null;
  state: string;
  active: boolean;
  shift_started_at: string | null;
  mise_batch_id?: string | null;
  active_batch_state?: string | null;
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

function dispatchCreatedAfter(): string | null {
  const raw = process.env.DELIVERY_DISPATCH_CREATED_AFTER?.trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error('DELIVERY_DISPATCH_CREATED_AFTER must be a valid ISO timestamp');
  }
  return new Date(timestamp).toISOString();
}

async function releaseDriverIfNoOtherBatch(
  client: SupabaseClient,
  driverId: string | null,
  finishedBatchId: string,
): Promise<void> {
  if (!driverId) return;
  const { data: otherActive } = await client.from('mise_delivery_batches')
    .select('id')
    .eq('driver_id', driverId)
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .neq('id', finishedBatchId)
    .limit(1);
  if (!otherActive || otherActive.length === 0) {
    await client.from('mise_drivers')
      .update({ state: 'idle' })
      .eq('id', driverId)
      .in('state', ['assigned', 'at_restaurant', 'picked_up', 'en_route', 'returning']);
  }
}

/** Dispatch-Tick: alle unzugewiesenen Lieferungs-Orders dispatchen. */
/**
 * Schließt in_progress-Batches ab, deren Stops alle erledigt sind.
 * Der delivered-Endpoint macht das normalerweise selbst — bei einem Race
 * (z.B. Tour nach App-Reload fortgesetzt, Livefall 12.08.) bleibt der Batch
 * sonst für immer offen und der Fahrer im busy-Filter gefangen.
 */
async function reconcileCompletedBatches(locationId?: string): Promise<number> {
  const c = sb();
  // Auch assigned/at_restaurant/picked_up können mit komplett erledigten Stops
  // hängen bleiben (z. B. Direct-Write-Pfade, App-Reload) — nicht nur in_progress.
  const RECONCILE_STATES = ['in_progress', 'picked_up', 'at_restaurant', 'assigned'];
  let openBatchesQuery = c
    .from('mise_delivery_batches')
    .select('id, driver_id, state, created_at')
    .in('state', RECONCILE_STATES)
    .limit(20);
  if (locationId) openBatchesQuery = openBatchesQuery.eq('location_id', locationId);
  const { data: openBatches } = await openBatchesQuery;
  if (!openBatches || openBatches.length === 0) return 0;

  let reconciled = 0;
  for (const batch of openBatches) {
    const { data: allStops } = await c
      .from('mise_delivery_batch_stops')
      .select('id, completed_at, cancelled')
      .eq('batch_id', batch.id);
    // Ein atomar erzeugter Batch ist nie dauerhaft stoplos. Stoplose und zugleich
    // orderlose Batches >5 Min sind Test-/Crash-Artefakte und blockieren sonst
    // den Fahrer fuer immer. Verknuepfte Orders werden bewusst nicht angefasst.
    if (!allStops || allStops.length === 0) {
      const ageMs = Date.now() - new Date(batch.created_at as string).getTime();
      if (ageMs >= 5 * 60_000) {
        const { data: linkedOrders } = await c.from('customer_orders')
          .select('id').eq('mise_batch_id', batch.id).limit(1);
        if (!linkedOrders || linkedOrders.length === 0) {
          await c.from('mise_delivery_batches')
            .update({ state: 'cancelled' })
            .eq('id', batch.id)
            .eq('state', batch.state);
          await c.from('driver_status')
            .update({ aktueller_batch_id: null })
            .eq('aktueller_batch_id', batch.id);
          await releaseDriverIfNoOtherBatch(c, batch.driver_id as string | null, batch.id as string);
          reconciled++;
        }
      }
      continue;
    }
    // Offene Stops -> weiter warten.
    // Stornierte Stops zählen nicht als offen (sonst hängt der Batch nach Order-Storno ewig).
    if (!allStops || allStops.length === 0) continue;
    const relevant = allStops.filter((s) => !s.cancelled);
    if (relevant.length === 0) {
      await c.from('mise_delivery_batches').update({ state: 'cancelled' })
        .eq('id', batch.id).eq('state', batch.state);
      await c.from('driver_status').update({ aktueller_batch_id: null })
        .eq('aktueller_batch_id', batch.id);
      await releaseDriverIfNoOtherBatch(c, batch.driver_id as string | null, batch.id as string);
      reconciled++;
      continue;
    }
    if (relevant.some((s) => s.completed_at === null)) continue;

    await c
      .from('mise_delivery_batches')
      .update({ state: 'completed', completed_at: new Date().toISOString() })
      .eq('id', batch.id)
      .eq('state', batch.state);
    await c
      .from('driver_status')
      .update({ aktueller_batch_id: null })
      .eq('aktueller_batch_id', batch.id);
    await releaseDriverIfNoOtherBatch(c, batch.driver_id as string | null, batch.id as string);
    reconciled++;
  }
  if (reconciled > 0) console.log(`[dispatch] reconcileCompletedBatches: ${reconciled} Batch(es) abgeschlossen`);
  return reconciled;
}

export async function smartDispatchTick(options: {
  locationId?: string;
  runGlobalMaintenance?: boolean;
} = {}): Promise<{
  scanned: number;
  dispatched: number;
  bundled: number;
  held: number;
  escalated: number;
  results: DispatchResult[];
}> {
  const runGlobalMaintenance = options.runGlobalMaintenance ?? !options.locationId;
  if (runGlobalMaintenance) {
    const { error: expiryError } = await sb().rpc('expire_own_fleet_plans');
    if (expiryError) console.error('[dispatch] expire_own_fleet_plans failed:', expiryError.message);
  }
  await reconcileCompletedBatches(options.locationId);
  const cutoff = dispatchCreatedAfter();
  let pendingOrdersQuery = sb()
    .from('customer_orders')
    .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at, dispatch_attempts, dispatch_escalated_at, schedule_status')
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .in('status', ['neu', 'in_zubereitung', 'fertig'])
    // Vorbestellungen (schedule_status='scheduled') überspringen — nur freigeben wenn Küche-Startzeit erreicht
    .or('schedule_status.is.null,schedule_status.neq.scheduled')
    .order('created_at', { ascending: true })
    .limit(50);

  // A rollout cutoff keeps unresolved historical orders visible for manual
  // review without repeatedly mutating or unexpectedly dispatching them.
  if (cutoff) pendingOrdersQuery = pendingOrdersQuery.gte('created_at', cutoff);
  if (options.locationId) pendingOrdersQuery = pendingOrdersQuery.eq('location_id', options.locationId);

  const { data: orders, error: ordersError } = await pendingOrdersQuery;
  if (ordersError) {
    throw new Error(`Pending delivery query failed: ${ordersError.message}`);
  }

  const results: DispatchResult[] = [];
  const now = new Date().toISOString();

  for (const o of orders ?? []) {
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
      if (newAttempts >= 3) {
        await sb().rpc('raise_delivery_dispatch_alert', {
          p_order_id: row.id,
          p_reason: r.reason,
          p_batch_id: null,
        });
      }
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
  const { zone, distanceKm } = await classifyZone(
    o.location_id,
    { lat: loc.lat, lng: loc.lng },
    { lat: o.kunde_lat!, lng: o.kunde_lng! },
  );
  await sb().from('customer_orders').update({ delivery_zone: zone }).eq('id', o.id);

  // 4) Fahrer-Pool
  const drivers = await loadActiveDrivers(loc.tenant_id, loc.id);
  if (drivers.length === 0) return held('Kein aktiver Fahrer verfügbar');

  // Fahrzeug- und Kapazitätswertung müssen die echte Bestellgröße kennen.
  // Ohne Count wurde jede Bestellung wie ein einzelner Artikel behandelt und
  // große Touren konnten fälschlich Fahrräder bevorzugen.
  const { count: itemCount, error: itemCountError } = await sb()
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', o.id);
  if (itemCountError) return held(`Bestellgröße nicht lesbar: ${itemCountError.message}`);

  const orderInput: OrderScoreInput = {
    id: o.id,
    location_id: o.location_id,
    kunde_lat: o.kunde_lat!,
    kunde_lng: o.kunde_lng!,
    restaurant_lat: loc.lat,
    restaurant_lng: loc.lng,
    zone,
    priority: (o.priority ?? 'normal') as OrderScoreInput['priority'],
    item_count: Math.max(1, itemCount ?? 0),
    estimated_prep_min: o.estimated_prep_min ?? 15,
    created_at: o.created_at,
  };

  // Radius-Filter (radiusFactor > 1 bei eskalierten Bestellungen)
  const nearby = drivers.filter((d) => {
    if (d.last_lat == null || d.last_lng == null) return true;
    return haversineKm({ lat: d.last_lat, lng: d.last_lng }, { lat: loc.lat!, lng: loc.lng! }) <= d.max_radius_km * radiusFactor;
  });
  if (nearby.length === 0) return held(`Kein Fahrer im Radius (${radiusFactor > 1 ? `×${radiusFactor} eskaliert` : 'normal'})`);

  // 5) Scoring
  const driverInputs: DriverScoreInput[] = nearby.map((d) => ({
    id: d.id,
    vehicle: d.vehicle,
    last_lat: d.last_lat,
    last_lng: d.last_lng,
    current_capacity: d.current_capacity,
    max_capacity: d.max_capacity,
    total_deliveries: d.total_deliveries,
    zone: d.zone ?? null,
    rating: d.rating ?? null,
    avg_delivery_min: d.avg_delivery_min ?? null,
    active_batch_id: d.mise_batch_id ?? null,
  }));

  const ranked = rankDrivers(driverInputs, orderInput);
  if (ranked.length === 0) return held('Alle Fahrer sind voll');

  // 6) Kandidaten der Reihe nach atomar versuchen. Ein hoch bewerteter Fahrer
  // kann bereits eine nicht passende offene Tour haben; dessen DB-Ablehnung
  // darf die Bestellung nicht blockieren, solange ein anderer Fahrer frei ist.
  let best: (typeof ranked)[number] | null = null;
  let bundleDecision: Awaited<ReturnType<typeof findBundleCandidates>> | null = null;
  let claimResult: { batch_id?: string; outcome?: 'dispatched' | 'bundled' } | null = null;
  let lastClaimError = 'kein Ergebnis';
  for (const candidate of ranked) {
    const candidateBundle = await findBundleCandidates(
      candidate.driver.id,
      loc.lat,
      loc.lng,
      o.kunde_lat!,
      o.kunde_lng!,
      candidate.driver.max_capacity,
    );
    const claimArgs = {
      p_order_id: o.id,
      p_driver_id: candidate.driver.id,
      p_zone: zone,
      p_dispatch_score: candidate.score.total,
      p_bundle_batch_id: candidateBundle.shouldBundle ? candidateBundle.candidateBatchId : null,
    };
    let { data: claim, error: claimError } = await sb().rpc('claim_delivery_order', claimArgs);
    // Das Bundle kann sich zwischen Bewertung und Claim ändern. Ein neuer Batch
    // wird einmal atomar versucht; ist der Fahrer belegt, folgt der nächste.
    if (claimError && claimArgs.p_bundle_batch_id) {
      ({ data: claim, error: claimError } = await sb().rpc('claim_delivery_order', {
        ...claimArgs,
        p_bundle_batch_id: null,
      }));
    }
    const candidateClaim = claim && typeof claim === 'object'
      ? claim as { batch_id?: string; outcome?: 'dispatched' | 'bundled' }
      : null;
    if (!claimError && candidateClaim?.batch_id && candidateClaim.outcome) {
      best = candidate;
      bundleDecision = candidateBundle;
      claimResult = candidateClaim;
      break;
    }
    lastClaimError = claimError?.message ?? 'Atomare Zuweisung lieferte keinen Batch';
  }
  if (!best || !bundleDecision || !claimResult?.batch_id || !claimResult.outcome) {
    return held(`Atomare Zuweisung fehlgeschlagen: ${lastClaimError}`);
  }
  const bestScore = best.score;
  const batchId = claimResult.batch_id;
  const outcome = claimResult.outcome;

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

async function loadActiveDrivers(tenantId: string, locationId: string): Promise<DriverRow[]> {
  const { data, error } = await sb().rpc('get_eligible_delivery_drivers', {
    p_tenant_id: tenantId,
    p_location_id: locationId,
  });
  if (error || !Array.isArray(data)) return [];
  const drivers = data as DriverRow[];
  const driverIds = drivers.map((d) => d.id);
  const batchMap = new Map<string, { id: string; state: string; dropoff_count: number }>();

  if (driverIds.length > 0) {
    const { data: scoringProfiles } = await sb()
      .from('mise_drivers')
      .select('id, rating, avg_delivery_min, zone')
      .in('id', driverIds);
    const scoringByDriver = new Map((scoringProfiles ?? []).map((profile) => [profile.id as string, profile]));
    for (const driver of drivers) {
      const profile = scoringByDriver.get(driver.id);
      driver.rating = profile?.rating == null ? null : Number(profile.rating);
      driver.avg_delivery_min = profile?.avg_delivery_min == null ? null : Number(profile.avg_delivery_min);
      driver.zone = (profile?.zone as ZoneName | null | undefined) ?? null;
    }

    const { data: activeBatches } = await sb()
      .from('mise_delivery_batches')
      .select('id, driver_id, state, stops:mise_delivery_batch_stops(type,completed_at,cancelled)')
      .in('driver_id', driverIds)
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress'])
      .order('created_at', { ascending: false });

    for (const b of activeBatches ?? []) {
      const dId = b.driver_id as string;
      const stops = ((b as unknown as { stops?: Array<{ type: string; completed_at: string | null; cancelled: boolean }> }).stops ?? []);
      const dropoffCount = stops.filter((stop) => stop.type === 'dropoff' && !stop.cancelled && !stop.completed_at).length;
      const candidate = { id: b.id as string, state: b.state as string, dropoff_count: dropoffCount };
      const existing = batchMap.get(dId);
      // Laufende Custody-Tour hat Vorrang vor einem eventuell zusaetzlich
      // vorhandenen Angebot: Dieser Fahrer darf keine weitere Tour gewinnen.
      if (!existing || ['picked_up', 'in_progress'].includes(candidate.state)) batchMap.set(dId, candidate);
    }
  }

  for (const d of drivers) {
    const batch = batchMap.get(d.id);
    (d as DriverRow & { mise_batch_id?: string | null }).mise_batch_id = batch?.id ?? null;
    d.active_batch_state = batch?.state ?? null;
    d.current_capacity = batch?.dropoff_count ?? 0;
  }

  // Eine bereits abgeholte/laufende Tour ist nicht bundlebar. Diese Fahrer aus
  // der Kandidatenliste entfernen, damit der naechste freie Fahrer bewertet wird.
  return drivers.filter((driver) => !['picked_up', 'in_progress'].includes(driver.active_batch_state ?? ''));
}
