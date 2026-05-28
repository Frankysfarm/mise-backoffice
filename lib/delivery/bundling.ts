/**
 * lib/delivery/bundling.ts
 *
 * Auto-Touren-Bündelung.
 * Entscheidet ob eine neue Bestellung an eine offene Tour gehängt werden soll
 * oder eine neue Tour startet.
 *
 * Bündelt wenn:
 *  - Selbes Restaurant (< 100m Haversine zwischen Pickups)
 *  - Oder Detour < MAX_DETOUR_KM (Umweg durch neue Lieferadresse)
 *  - Und Tour hat noch freie Kapazität
 *  - Und Tour ist in bündelbarem Zustand (pending_acceptance / assigned)
 */
import 'server-only';
import { haversineKm } from '@/lib/google-maps';
import { createServiceClient } from '@/lib/supabase/server';

const MAX_DETOUR_KM = 1.5;
const SAME_RESTAURANT_KM = 0.1;

export interface BundleCandidate {
  batchId: string;
  driverId: string;
  state: string;
  dropoffCount: number;
  maxCapacity: number;
  lastDropoffLat: number | null;
  lastDropoffLng: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
}

export interface BundleDecision {
  shouldBundle: boolean;
  candidateBatchId: string | null;
  reason: string;
}

/** Findet offene Touren eines Fahrers die bündelbar sind. */
export async function findBundleCandidates(
  driverId: string,
  restaurantLat: number,
  restaurantLng: number,
  newOrderLat: number,
  newOrderLng: number,
): Promise<BundleDecision> {
  const sb = createServiceClient();

  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, state, stop_count, driver_id')
    .eq('driver_id', driverId)
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant'])
    .limit(5);

  if (!batches || batches.length === 0) {
    return { shouldBundle: false, candidateBatchId: null, reason: 'Keine offene Tour' };
  }

  for (const batch of batches) {
    const decision = await evaluateBundle(
      batch.id as string,
      batch.state as string,
      restaurantLat,
      restaurantLng,
      newOrderLat,
      newOrderLng,
    );
    if (decision.shouldBundle) return decision;
  }

  return { shouldBundle: false, candidateBatchId: null, reason: 'Kein Bundle passt (Detour zu groß / voll)' };
}

async function evaluateBundle(
  batchId: string,
  state: string,
  restaurantLat: number,
  restaurantLng: number,
  newOrderLat: number,
  newOrderLng: number,
): Promise<BundleDecision> {
  const sb = createServiceClient();

  const { data: stops } = await sb
    .from('mise_delivery_batch_stops')
    .select('type, sequence, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: false });

  if (!stops || stops.length === 0) {
    return { shouldBundle: false, candidateBatchId: null, reason: 'Keine Stops im Bundle' };
  }

  // Kapazitätsprüfung
  const dropoffs = stops.filter((s) => s.type === 'dropoff');
  const maxCap = 4; // Default; wird später aus drivers geladen
  if (dropoffs.length >= maxCap) {
    return { shouldBundle: false, candidateBatchId: null, reason: 'Tour ist voll' };
  }

  // Pickup-Checks: selbes Restaurant?
  const pickups = stops.filter((s) => s.type === 'pickup' && s.lat != null && s.lng != null);
  const sameRestaurant = pickups.some((p) =>
    haversineKm({ lat: p.lat as number, lng: p.lng as number }, { lat: restaurantLat, lng: restaurantLng }) < SAME_RESTAURANT_KM,
  );

  if (sameRestaurant) {
    return { shouldBundle: true, candidateBatchId: batchId, reason: 'Selbes Restaurant → Bundle' };
  }

  // Detour-Prüfung: aktueller letzter Dropoff → neuer Dropoff → Ende
  const lastDropoff = stops.find((s) => s.type === 'dropoff');
  if (!lastDropoff?.lat || !lastDropoff?.lng) {
    return { shouldBundle: false, candidateBatchId: null, reason: 'Kein letzter Dropoff für Detour-Berechnung' };
  }

  const directKm = haversineKm(
    { lat: lastDropoff.lat as number, lng: lastDropoff.lng as number },
    { lat: newOrderLat, lng: newOrderLng },
  );

  // Wenn der Fahrer schon unterwegs ist (assigned/at_restaurant) → strengerer Detour-Check
  const maxDetour = state === 'pending_acceptance' ? MAX_DETOUR_KM : MAX_DETOUR_KM * 0.7;

  if (directKm <= maxDetour) {
    return {
      shouldBundle: true,
      candidateBatchId: batchId,
      reason: `Detour ${directKm.toFixed(1)} km < ${maxDetour.toFixed(1)} km → Bundle`,
    };
  }

  return {
    shouldBundle: false,
    candidateBatchId: null,
    reason: `Detour ${directKm.toFixed(1)} km > ${maxDetour.toFixed(1)} km → Keine Bündelung`,
  };
}

/**
 * Fügt eine Bestellung zu einer bestehenden Tour hinzu.
 * Gibt die neue Stop-Anzahl zurück.
 */
export async function appendToTour(
  batchId: string,
  orderId: string,
  restaurantLat: number,
  restaurantLng: number,
  restaurantAddress: string,
  customerLat: number,
  customerLng: number,
  customerAddress: string | null,
): Promise<number> {
  const sb = createServiceClient();

  const { data: existing } = await sb
    .from('mise_delivery_batch_stops')
    .select('sequence, type, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: false })
    .limit(1);

  const maxSeq = existing?.[0]?.sequence ?? -1;
  let nextSeq = maxSeq + 1;

  // Prüfen ob Pickup für dieses Restaurant schon existiert
  const { data: pickups } = await sb
    .from('mise_delivery_batch_stops')
    .select('lat, lng')
    .eq('batch_id', batchId)
    .eq('type', 'pickup');

  const alreadyHasPickup = (pickups ?? []).some(
    (p) =>
      p.lat != null &&
      p.lng != null &&
      haversineKm({ lat: p.lat as number, lng: p.lng as number }, { lat: restaurantLat, lng: restaurantLng }) < SAME_RESTAURANT_KM,
  );

  const inserts: Array<{
    batch_id: string;
    order_id: string;
    type: 'pickup' | 'dropoff';
    sequence: number;
    lat: number;
    lng: number;
    address: string;
  }> = [];

  if (!alreadyHasPickup) {
    inserts.push({
      batch_id: batchId,
      order_id: orderId,
      type: 'pickup',
      sequence: nextSeq++,
      lat: restaurantLat,
      lng: restaurantLng,
      address: restaurantAddress,
    });
  }

  inserts.push({
    batch_id: batchId,
    order_id: orderId,
    type: 'dropoff',
    sequence: nextSeq,
    lat: customerLat,
    lng: customerLng,
    address: customerAddress ?? '',
  });

  await sb.from('mise_delivery_batch_stops').insert(inserts);
  await sb.from('customer_orders').update({ mise_batch_id: batchId }).eq('id', orderId);

  // stop_count auf Batch updaten
  const { data: allStops } = await sb
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batchId);
  const count = allStops?.length ?? 0;
  await sb.from('mise_delivery_batches').update({ stop_count: count }).eq('id', batchId);

  return count;
}
