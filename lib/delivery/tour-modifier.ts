/**
 * lib/delivery/tour-modifier.ts
 *
 * Live-Tour-Modifikation Engine — Phase 52
 *
 * Ermöglicht das Einfügen und Entfernen von Stops in aktiven Touren
 * sowie die Neuoptimierung der verbleibenden Route — ohne Tour abbrechen zu müssen.
 *
 * Operationen:
 *  insertStopIntoActiveTour()   — Neue Bestellung in laufende Tour einreihen
 *  removeStopFromActiveTour()   — Stop aus Tour entfernen (z.B. stornierte Bestellung)
 *  reoptimizeActiveTour()       — Verbleibende offene Stops neu optimieren
 *  getTourModifications()       — Audit-Trail einer Tour abrufen
 *
 * Invarianten:
 *  - Nur aktive Batches können modifiziert werden (state: pending_acceptance / assigned / at_restaurant / on_route)
 *  - Abgeschlossene Stops (completed_at IS NOT NULL) werden nie bewegt
 *  - Jede Änderung wird in tour_modifications protokolliert
 *  - location_id wird bei jeder Abfrage geprüft (Multi-Tenant-Sicherheit)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';
import { optimizeTour } from './tour-optimizer';
import { logDeliveryEvent } from './events';
import { enqueueBatchPush } from './push-notify';

// ─── Konstanten ───────────────────────────────────────────────────────────────
const ACTIVE_STATES = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'en_route'] as const;
const SAME_RESTAURANT_KM = 0.05;

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface TourModification {
  id: string;
  locationId: string;
  batchId: string;
  modificationType: 'stop_inserted' | 'stop_removed' | 'reoptimized';
  orderId: string | null;
  stopId: string | null;
  positionBefore: number | null;
  positionAfter: number | null;
  etaBeforeMin: number | null;
  etaAfterMin: number | null;
  performedBy: string | null;
  reason: string | null;
  createdAt: string;
}

export interface InsertStopResult {
  ok: boolean;
  stopId: string | null;
  newStopCount: number;
  newEtaMin: number;
  modificationId: string | null;
  reason: string;
}

export interface RemoveStopResult {
  ok: boolean;
  orderLiberated: boolean;
  newStopCount: number;
  newEtaMin: number;
  modificationId: string | null;
  reason: string;
}

export interface ReoptimizeResult {
  ok: boolean;
  etaBeforeMin: number | null;
  etaAfterMin: number;
  stopsResequenced: number;
  modificationId: string | null;
  reason: string;
}

// ─── DB-Zeilen-Typen ─────────────────────────────────────────────────────────

interface BatchRow {
  id: string;
  location_id: string;
  fahrer_id: string | null;
  state: string;
  stop_count: number;
  total_eta_min: number | null;
  modification_count: number;
}

interface StopRow {
  id: string;
  batch_id: string;
  order_id: string;
  type: 'pickup' | 'dropoff';
  sequence: number;
  lat: number | null;
  lng: number | null;
  address: string | null;
  completed_at: string | null;
}

interface OrderRow {
  id: string;
  location_id: string;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  mise_batch_id: string | null;
  status: string | null;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function isActiveState(state: string): boolean {
  return (ACTIVE_STATES as readonly string[]).includes(state);
}

/**
 * Nearest-Neighbor-Resequenzierung für offene Stops.
 * Wird für aktive Touren verwendet, damit bereits besuchte Stops unverändert bleiben.
 */
function nearestNeighborSequence(
  openDropoffs: StopRow[],
  origin: { lat: number; lng: number },
): StopRow[] {
  if (openDropoffs.length <= 1) return openDropoffs;

  const remaining = [...openDropoffs];
  const ordered: StopRow[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      if (s.lat == null || s.lng == null) continue;
      const d = haversineKm(current, { lat: s.lat, lng: s.lng });
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    if (next.lat != null && next.lng != null) {
      current = { lat: next.lat, lng: next.lng };
    }
  }

  return ordered;
}

/**
 * Berechnet Gesamtdistanz und ETA über eine Stop-Sequenz (Haversine).
 */
function calcRouteStats(
  stops: Array<{ lat: number | null; lng: number | null }>,
): { distanceKm: number; etaMin: number } {
  let dist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      dist += haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    }
  }
  return {
    distanceKm: Math.round(dist * 10) / 10,
    etaMin: Math.round((dist / 25) * 60),
  };
}

/**
 * Speichert einen Modifikations-Eintrag und aktualisiert den Zähler am Batch.
 */
async function logModification(params: {
  locationId: string;
  batchId: string;
  modificationType: 'stop_inserted' | 'stop_removed' | 'reoptimized';
  orderId?: string | null;
  stopId?: string | null;
  positionBefore?: number | null;
  positionAfter?: number | null;
  etaBeforeMin?: number | null;
  etaAfterMin?: number | null;
  performedBy?: string | null;
  reason?: string | null;
}): Promise<string | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('tour_modifications')
    .insert({
      location_id:       params.locationId,
      batch_id:          params.batchId,
      modification_type: params.modificationType,
      order_id:          params.orderId ?? null,
      stop_id:           params.stopId ?? null,
      position_before:   params.positionBefore ?? null,
      position_after:    params.positionAfter ?? null,
      eta_before_min:    params.etaBeforeMin ?? null,
      eta_after_min:     params.etaAfterMin ?? null,
      performed_by:      params.performedBy ?? 'system',
      reason:            params.reason ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return null;

  // modification_count lesen und inkrementieren (kein concurrency-Problem bei Admin-Operationen)
  const { data: batchRow } = await sb
    .from('mise_delivery_batches')
    .select('modification_count')
    .eq('id', params.batchId)
    .single<{ modification_count: number }>();

  await sb
    .from('mise_delivery_batches')
    .update({
      modification_count: (batchRow?.modification_count ?? 0) + 1,
      last_modified_at:   new Date().toISOString(),
    })
    .eq('id', params.batchId);

  return data.id;
}

// ─── Öffentliche Funktionen ───────────────────────────────────────────────────

/**
 * Fügt eine neue Bestellung als Stop in eine aktive Tour ein.
 *
 * Die Bestellung muss:
 *  - zur selben Location gehören
 *  - noch nicht in einer anderen Tour sein
 *  - Koordinaten haben
 *
 * Nach dem Einfügen werden die verbleibenden offenen Stops neu optimiert
 * und der Fahrer erhält eine Push-Benachrichtigung.
 */
export async function insertStopIntoActiveTour(
  batchId: string,
  orderId: string,
  locationId: string,
  performedBy?: string,
): Promise<InsertStopResult> {
  const sb = createServiceClient();

  // 1. Batch laden + Validierung
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, fahrer_id, state, stop_count, total_eta_min, modification_count')
    .eq('id', batchId)
    .eq('location_id', locationId)
    .single<BatchRow>();

  if (!batch) {
    return { ok: false, stopId: null, newStopCount: 0, newEtaMin: 0, modificationId: null, reason: 'Tour nicht gefunden oder falsche Location' };
  }
  if (!isActiveState(batch.state)) {
    return { ok: false, stopId: null, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: `Tour ist nicht aktiv (state: ${batch.state})` };
  }

  // 2. Bestellung laden + Validierung
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, mise_batch_id, status')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .single<OrderRow>();

  if (!order) {
    return { ok: false, stopId: null, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: 'Bestellung nicht gefunden oder falsche Location' };
  }
  if (order.mise_batch_id && order.mise_batch_id !== batchId) {
    return { ok: false, stopId: null, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: `Bestellung ist bereits in Tour ${order.mise_batch_id}` };
  }
  if (order.kunde_lat == null || order.kunde_lng == null) {
    return { ok: false, stopId: null, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: 'Bestellung hat keine Lieferkoordinaten' };
  }

  // 3. Duplikat prüfen (bereits in dieser Tour)
  const { data: existing } = await sb
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batchId)
    .eq('order_id', orderId)
    .eq('type', 'dropoff')
    .maybeSingle();

  if (existing) {
    return { ok: false, stopId: existing.id, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: 'Bestellung ist bereits in dieser Tour' };
  }

  // 4. Restaurant-Koordinaten aus Location laden
  const { data: location } = await sb
    .from('locations')
    .select('id, lat, lng, adresse, name')
    .eq('id', locationId)
    .single<{ id: string; lat: number | null; lng: number | null; adresse: string | null; name: string }>();

  const restaurantLat = location?.lat ?? 0;
  const restaurantLng = location?.lng ?? 0;
  const restaurantAddress = location?.adresse ?? location?.name ?? '';

  const etaBefore = batch.total_eta_min;

  // 5. Nächste Sequenz-Nummer ermitteln
  const { data: allStopsRaw } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, sequence, type, lat, lng, completed_at')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: false });

  const allStops = (allStopsRaw ?? []) as Array<{
    id: string; sequence: number; type: string; lat: number | null; lng: number | null; completed_at: string | null;
  }>;

  const maxSeq = allStops[0]?.sequence ?? -1;

  // 6. Prüfen ob Pickup für dieses Restaurant bereits existiert
  const alreadyHasPickup = allStops.some(
    (s) =>
      s.type === 'pickup' &&
      s.lat != null &&
      s.lng != null &&
      haversineKm({ lat: s.lat, lng: s.lng }, { lat: restaurantLat, lng: restaurantLng }) < SAME_RESTAURANT_KM,
  );

  let nextSeq = maxSeq + 1;
  let insertedPickupId: string | null = null;

  if (!alreadyHasPickup && restaurantLat !== 0) {
    const { data: pickupRow } = await sb
      .from('mise_delivery_batch_stops')
      .insert({
        batch_id: batchId,
        order_id: orderId,
        type: 'pickup',
        sequence: nextSeq++,
        lat: restaurantLat,
        lng: restaurantLng,
        address: restaurantAddress,
      })
      .select('id')
      .single();
    insertedPickupId = pickupRow?.id ?? null;
  }

  const { data: dropoffRow } = await sb
    .from('mise_delivery_batch_stops')
    .insert({
      batch_id: batchId,
      order_id: orderId,
      type: 'dropoff',
      sequence: nextSeq,
      lat: order.kunde_lat,
      lng: order.kunde_lng,
      address: order.kunde_adresse ?? '',
    })
    .select('id')
    .single();

  const dropoffId = dropoffRow?.id ?? null;

  // 7. Bestellung mit Tour verknüpfen
  await sb
    .from('customer_orders')
    .update({ mise_batch_id: batchId })
    .eq('id', orderId);

  // 8. Stop-Count aktualisieren
  const { count: stopCountExact } = await sb
    .from('mise_delivery_batch_stops')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId);

  const newCount = stopCountExact ?? ((allStops?.length ?? 0) + (insertedPickupId ? 2 : 1));

  await sb
    .from('mise_delivery_batches')
    .update({ stop_count: newCount })
    .eq('id', batchId);

  // 9. Tour neu optimieren (nur offene Stops)
  let newEtaMin = etaBefore ?? 0;
  try {
    const optimized = await optimizeTour(batchId);
    newEtaMin = optimized.totalEtaMin;
  } catch {
    // Fallback: Haversine-ETA
    const { data: openStops } = await sb
      .from('mise_delivery_batch_stops')
      .select('lat, lng')
      .eq('batch_id', batchId)
      .is('completed_at', null)
      .order('sequence', { ascending: true });
    if (openStops && openStops.length > 1) {
      const { etaMin } = calcRouteStats(openStops as Array<{ lat: number | null; lng: number | null }>);
      newEtaMin = etaMin;
    }
  }

  // 10. Modifikation protokollieren
  const modificationId = await logModification({
    locationId,
    batchId,
    modificationType: 'stop_inserted',
    orderId,
    stopId: dropoffId,
    positionBefore: null,
    positionAfter: nextSeq,
    etaBeforeMin: etaBefore,
    etaAfterMin: newEtaMin,
    performedBy,
    reason: `Stop für Bestellung ${orderId} eingefügt`,
  });

  // 11. Fahrer per Push benachrichtigen (fire-and-forget)
  if (batch.fahrer_id) {
    enqueueBatchPush({
      driverId: batch.fahrer_id,
      batchId,
      orderCount: 1,
      restaurantName: restaurantAddress,
      distanceKm: order.kunde_lat && order.kunde_lng
        ? haversineKm({ lat: restaurantLat, lng: restaurantLng }, { lat: order.kunde_lat, lng: order.kunde_lng })
        : 0,
      outcome: 'bundled',
    }).catch(() => {});
  }

  // 12. Delivery-Event loggen
  logDeliveryEvent({
    event_type:  'tour_stop_inserted',
    location_id: locationId,
    batch_id:    batchId,
    order_id:    orderId,
    payload:     { performedBy: performedBy ?? 'system', etaBefore, etaAfter: newEtaMin },
  }).catch(() => {});

  return {
    ok: true,
    stopId: dropoffId,
    newStopCount: newCount,
    newEtaMin,
    modificationId,
    reason: `Stop für Bestellung ${orderId} in Tour eingefügt`,
  };
}

/**
 * Entfernt einen Stop aus einer aktiven Tour.
 *
 * Wenn der Stop der letzte Dropoff für eine Bestellung ist, wird die Bestellung
 * aus der Tour befreit (mise_batch_id = null) und zurück in die Dispatch-Queue gestellt.
 * Wenn der verknüpfte Pickup-Stop dadurch verwaist, wird er ebenfalls gelöscht.
 */
export async function removeStopFromActiveTour(
  batchId: string,
  stopId: string,
  locationId: string,
  reason: string,
  performedBy?: string,
): Promise<RemoveStopResult> {
  const sb = createServiceClient();

  // 1. Batch laden + Validierung
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, fahrer_id, state, stop_count, total_eta_min, modification_count')
    .eq('id', batchId)
    .eq('location_id', locationId)
    .single<BatchRow>();

  if (!batch) {
    return { ok: false, orderLiberated: false, newStopCount: 0, newEtaMin: 0, modificationId: null, reason: 'Tour nicht gefunden oder falsche Location' };
  }
  if (!isActiveState(batch.state)) {
    return { ok: false, orderLiberated: false, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: `Tour ist nicht aktiv (state: ${batch.state})` };
  }

  // 2. Stop laden + Validierung
  const { data: stop } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, batch_id, order_id, type, sequence, lat, lng, completed_at')
    .eq('id', stopId)
    .eq('batch_id', batchId)
    .single<StopRow>();

  if (!stop) {
    return { ok: false, orderLiberated: false, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: 'Stop nicht gefunden' };
  }
  if (stop.completed_at != null) {
    return { ok: false, orderLiberated: false, newStopCount: batch.stop_count, newEtaMin: batch.total_eta_min ?? 0, modificationId: null, reason: 'Stop bereits abgeschlossen — kann nicht entfernt werden' };
  }

  const etaBefore = batch.total_eta_min;
  const positionBefore = stop.sequence;
  let orderLiberated = false;

  // 3. Alle Stops für diese Bestellung in dieser Tour laden
  const { data: orderStopsRaw } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, type, completed_at')
    .eq('batch_id', batchId)
    .eq('order_id', stop.order_id);

  const orderStops = (orderStopsRaw ?? []) as Array<{ id: string; type: string; completed_at: string | null }>;
  const openOrderStops = orderStops.filter((s) => s.completed_at == null);

  // 4. Stop löschen
  await sb.from('mise_delivery_batch_stops').delete().eq('id', stopId);

  // 5. Verwaiste Pickup-Stops entfernen (Pickup ohne anderen offenen Dropoff derselben Bestellung)
  if (stop.type === 'dropoff') {
    const remainingOpenDropoffs = openOrderStops.filter(
      (s) => s.type === 'dropoff' && s.id !== stopId && s.completed_at == null,
    );
    if (remainingOpenDropoffs.length === 0) {
      // Kein weiterer offener Dropoff → Pickup kann weg (falls er nicht abgeschlossen ist)
      const orphanPickups = openOrderStops.filter(
        (s) => s.type === 'pickup' && s.completed_at == null,
      );
      for (const p of orphanPickups) {
        await sb.from('mise_delivery_batch_stops').delete().eq('id', p.id);
      }

      // Bestellung befreien
      await sb
        .from('customer_orders')
        .update({ mise_batch_id: null, mise_driver_id: null })
        .eq('id', stop.order_id);
      orderLiberated = true;
    }
  }

  // 6. Verbleibende Stops neu sequenzieren
  const { data: remainingStopsRaw } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, type, sequence, completed_at')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  const remainingStops = (remainingStopsRaw ?? []) as Array<{ id: string; type: string; sequence: number; completed_at: string | null }>;
  const completedStops = remainingStops.filter((s) => s.completed_at != null);
  const openStops = remainingStops.filter((s) => s.completed_at == null);

  let baseSeq = completedStops.length > 0
    ? Math.max(...completedStops.map((s) => s.sequence)) + 1
    : 0;

  for (const s of openStops) {
    await sb
      .from('mise_delivery_batch_stops')
      .update({ sequence: baseSeq++ })
      .eq('id', s.id);
  }

  // 7. Stop-Count + ETA aktualisieren
  const newCount = (completedStops.length + openStops.length);
  let newEtaMin = etaBefore ?? 0;

  try {
    if (openStops.length >= 2) {
      const optimized = await optimizeTour(batchId);
      newEtaMin = optimized.totalEtaMin;
    } else {
      // Einfache Haversine-ETA
      const { data: refreshedOpen } = await sb
        .from('mise_delivery_batch_stops')
        .select('lat, lng')
        .eq('batch_id', batchId)
        .is('completed_at', null)
        .order('sequence', { ascending: true });
      if (refreshedOpen && refreshedOpen.length >= 1) {
        const { etaMin } = calcRouteStats(refreshedOpen as Array<{ lat: number | null; lng: number | null }>);
        newEtaMin = etaMin;
      }
    }
  } catch {
    // Behalte alte ETA bei Fehler
  }

  await sb
    .from('mise_delivery_batches')
    .update({ stop_count: newCount, total_eta_min: newEtaMin })
    .eq('id', batchId);

  // 8. Modifikation protokollieren
  const modificationId = await logModification({
    locationId,
    batchId,
    modificationType: 'stop_removed',
    orderId: stop.order_id,
    stopId,
    positionBefore,
    positionAfter: null,
    etaBeforeMin: etaBefore,
    etaAfterMin: newEtaMin,
    performedBy,
    reason,
  });

  logDeliveryEvent({
    event_type:  'tour_stop_removed',
    location_id: locationId,
    batch_id:    batchId,
    order_id:    stop.order_id,
    payload:     { performedBy: performedBy ?? 'system', reason, orderLiberated, etaBefore, etaAfter: newEtaMin },
  }).catch(() => {});

  return {
    ok: true,
    orderLiberated,
    newStopCount: newCount,
    newEtaMin,
    modificationId,
    reason: `Stop entfernt${orderLiberated ? ' — Bestellung wieder in Dispatch-Queue' : ''}`,
  };
}

/**
 * Optimiert die verbleibenden offenen Stops einer aktiven Tour neu.
 * Abgeschlossene Stops werden nicht verändert.
 * Nutzt Nearest-Neighbor-Heuristik (günstig für Live-Änderungen).
 */
export async function reoptimizeActiveTour(
  batchId: string,
  locationId: string,
  performedBy?: string,
): Promise<ReoptimizeResult> {
  const sb = createServiceClient();

  // 1. Batch laden + Validierung
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, fahrer_id, state, stop_count, total_eta_min, modification_count')
    .eq('id', batchId)
    .eq('location_id', locationId)
    .single<BatchRow>();

  if (!batch) {
    return { ok: false, etaBeforeMin: null, etaAfterMin: 0, stopsResequenced: 0, modificationId: null, reason: 'Tour nicht gefunden oder falsche Location' };
  }
  if (!isActiveState(batch.state)) {
    return { ok: false, etaBeforeMin: batch.total_eta_min, etaAfterMin: batch.total_eta_min ?? 0, stopsResequenced: 0, modificationId: null, reason: `Tour ist nicht aktiv (state: ${batch.state})` };
  }

  const etaBefore = batch.total_eta_min;

  // 2. Alle Stops laden
  const { data: allStopsRaw2 } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, type, sequence, lat, lng, address, completed_at')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  const allStops = (allStopsRaw2 ?? []) as StopRow[];

  if (allStops.length === 0) {
    return { ok: false, etaBeforeMin: etaBefore, etaAfterMin: etaBefore ?? 0, stopsResequenced: 0, modificationId: null, reason: 'Keine Stops in Tour' };
  }

  const completedStops = allStops.filter((s) => s.completed_at != null);
  const openStops = allStops.filter((s) => s.completed_at == null);

  if (openStops.length <= 1) {
    return { ok: true, etaBeforeMin: etaBefore, etaAfterMin: etaBefore ?? 0, stopsResequenced: 0, modificationId: null, reason: 'Weniger als 2 offene Stops — keine Neuoptimierung nötig' };
  }

  // 3. Origin: letzter abgeschlossener Stop oder Restaurant-Position
  let origin: { lat: number; lng: number };
  if (completedStops.length > 0) {
    const last = completedStops[completedStops.length - 1];
    origin = { lat: last.lat ?? 0, lng: last.lng ?? 0 };
  } else {
    const { data: loc } = await sb
      .from('locations')
      .select('lat, lng')
      .eq('id', locationId)
      .single<{ lat: number | null; lng: number | null }>();
    origin = { lat: loc?.lat ?? 0, lng: loc?.lng ?? 0 };
  }

  // 4. Offene Pickups + Dropoffs separieren
  const openPickups = openStops.filter((s) => s.type === 'pickup');
  const openDropoffs = openStops.filter((s) => s.type === 'dropoff');

  // Pickups immer zuerst (Nearest-Neighbor unter sich), dann Dropoffs
  const sortedPickups = nearestNeighborSequence(openPickups, origin);
  const pickupOrigin = sortedPickups.length > 0
    ? { lat: sortedPickups[sortedPickups.length - 1].lat ?? origin.lat, lng: sortedPickups[sortedPickups.length - 1].lng ?? origin.lng }
    : origin;
  const sortedDropoffs = nearestNeighborSequence(openDropoffs, pickupOrigin);
  const resequenced = [...sortedPickups, ...sortedDropoffs];

  // 5. Neue Sequenz-Nummern ab (max abgeschlossener Sequenz + 1)
  const baseSeq = completedStops.length > 0
    ? Math.max(...completedStops.map((s) => s.sequence)) + 1
    : 0;

  for (let i = 0; i < resequenced.length; i++) {
    await sb
      .from('mise_delivery_batch_stops')
      .update({ sequence: baseSeq + i })
      .eq('id', resequenced[i].id);
  }

  // 6. Neue ETA berechnen
  const allOrdered = [...resequenced];
  const { distanceKm, etaMin: newEtaMin } = calcRouteStats(
    allOrdered.map((s) => ({ lat: s.lat, lng: s.lng })),
  );

  await sb
    .from('mise_delivery_batches')
    .update({
      total_eta_min:     newEtaMin,
      total_distance_km: distanceKm,
      last_modified_at:  new Date().toISOString(),
    })
    .eq('id', batchId);

  // 7. Modifikation protokollieren
  const modificationId = await logModification({
    locationId,
    batchId,
    modificationType: 'reoptimized',
    etaBeforeMin: etaBefore,
    etaAfterMin: newEtaMin,
    performedBy,
    reason: `${resequenced.length} offene Stops neu optimiert`,
  });

  logDeliveryEvent({
    event_type:  'tour_reoptimized',
    location_id: locationId,
    batch_id:    batchId,
    payload:     { performedBy: performedBy ?? 'system', etaBefore, etaAfter: newEtaMin, stopsResequenced: resequenced.length },
  }).catch(() => {});

  return {
    ok: true,
    etaBeforeMin: etaBefore,
    etaAfterMin: newEtaMin,
    stopsResequenced: resequenced.length,
    modificationId,
    reason: `${resequenced.length} Stops neu optimiert, ETA: ${newEtaMin} Min`,
  };
}

/**
 * Lädt den Modifikations-Audit-Trail für eine Tour.
 */
export async function getTourModifications(
  batchId: string,
  locationId: string,
  limit = 50,
): Promise<TourModification[]> {
  const sb = createServiceClient();

  interface ModRow {
    id: string;
    location_id: string;
    batch_id: string;
    modification_type: string;
    order_id: string | null;
    stop_id: string | null;
    position_before: number | null;
    position_after: number | null;
    eta_before_min: number | null;
    eta_after_min: number | null;
    performed_by: string | null;
    reason: string | null;
    created_at: string;
  }

  const { data } = await sb
    .from('tour_modifications')
    .select('id, location_id, batch_id, modification_type, order_id, stop_id, position_before, position_after, eta_before_min, eta_after_min, performed_by, reason, created_at')
    .eq('batch_id', batchId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as ModRow[]).map((r) => ({
    id: r.id,
    locationId: r.location_id,
    batchId: r.batch_id,
    modificationType: r.modification_type as TourModification['modificationType'],
    orderId: r.order_id,
    stopId: r.stop_id,
    positionBefore: r.position_before,
    positionAfter: r.position_after,
    etaBeforeMin: r.eta_before_min,
    etaAfterMin: r.eta_after_min,
    performedBy: r.performed_by,
    reason: r.reason,
    createdAt: r.created_at as string,
  }));
}
