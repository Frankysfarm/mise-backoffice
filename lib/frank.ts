/**
 * Frank — der Smart-Dispatcher.
 *
 * Phase 3 (2026-05-05): Verteilt eingehende Lieferungs-Bestellungen auf
 * Fahrer und bündelt sie zu Multi-Stop-Touren wenn das Sinn ergibt.
 *
 * Strategie (vereinfacht):
 *  - Pro Tenant: alle nicht-zugewiesenen Lieferungs-Orders sammeln
 *  - Driver-Pool: aktive Fahrer dieses Tenants, die online sind
 *  - Pro Order:
 *    1. Existiert ein Bundle bei einem Driver dass noch nicht akzeptiert wurde
 *       (state='pending_acceptance')? → anhängen wenn Detour < 1.5 km haversine
 *       und Slot frei (vehicle bike=2, car=4 dropoffs)
 *    2. Existiert ein Bundle 'assigned' für den selben Pickup (Restaurant) und
 *       Driver hat Slot frei? → anhängen
 *    3. Sonst: neuen Bundle anlegen, nearest-driver wählen, Push triggern
 *  - Bei jedem Bundle-Update: Route via Google Directions berechnen, Polyline +
 *    total_distance + total_eta speichern. Fallback auf Haversine wenn Google
 *    nicht antwortet.
 *  - Frank-Decisions werden geloggt (mise_frank_decisions) — Trigger
 *    fn_enqueue_push_on_assign feuert auf type='assign' den Push.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { directions, geocode, haversineKm, type RouteResult } from './google-maps';

interface DriverRow {
  id: string;
  vehicle: 'bike' | 'car';
  max_radius_km: number;
  last_lat: number | null;
  last_lng: number | null;
  state: string;
}

interface OrderRow {
  id: string;
  bestellnummer: string;
  location_id: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
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

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => fetch(i as RequestInfo, { ...init, cache: 'no-store' }) },
    },
  );
  return _sb;
}

const VEHICLE_SLOTS: Record<'bike' | 'car', number> = { bike: 2, car: 4 };
const MAX_BUNDLE_DETOUR_KM = 1.5;

export interface DispatchTickResult {
  scanned_orders: number;
  bundled: number;
  assigned: number;
  held: number;
}

/**
 * Periodisch vom Cron aufgerufen — scannt unzugewiesene Lieferungs-Orders
 * und ordnet sie zu.
 */
export async function dispatchTick(): Promise<DispatchTickResult> {
  const c = sb();
  const { data: orders } = await c
    .from('customer_orders')
    .select('id, bestellnummer, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt')
    .eq('typ', 'lieferung')
    .is('mise_driver_id', null)
    .is('mise_batch_id', null)
    .in('status', ['neu', 'in_zubereitung', 'fertig'])
    .order('created_at', { ascending: true })
    .limit(50);

  const result: DispatchTickResult = {
    scanned_orders: orders?.length ?? 0,
    bundled: 0,
    assigned: 0,
    held: 0,
  };

  for (const o of orders ?? []) {
    const outcome = await dispatchOrder(o as OrderRow);
    if (outcome === 'bundled') result.bundled++;
    else if (outcome === 'assigned') result.assigned++;
    else result.held++;
  }
  return result;
}

type Outcome = 'bundled' | 'assigned' | 'held';

export async function dispatchOrder(o: OrderRow): Promise<Outcome> {
  const c = sb();

  // 1) Pickup-Location (Restaurant) laden
  if (!o.location_id) return 'held';
  const { data: locRaw } = await c
    .from('locations')
    .select('id, tenant_id, name, lat, lng, adresse, plz, stadt')
    .eq('id', o.location_id)
    .maybeSingle();
  if (!locRaw) return 'held';
  const loc = locRaw as LocationRow;

  // 2) Customer-Adresse geocoden falls nötig
  if (o.kunde_lat == null || o.kunde_lng == null) {
    const addr = [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean).join(', ');
    if (!addr) {
      await logDecision('hold', null, [o.id], 'Keine Lieferadresse');
      return 'held';
    }
    try {
      const g = await geocode(addr);
      if (!g) {
        await logDecision('hold', null, [o.id], `Adresse nicht gefunden: ${addr}`);
        return 'held';
      }
      await c
        .from('customer_orders')
        .update({ kunde_lat: g.lat, kunde_lng: g.lng })
        .eq('id', o.id);
      o.kunde_lat = g.lat;
      o.kunde_lng = g.lng;
    } catch (e: unknown) {
      // Google deny / network → Order parken, Cron probiert nächste Runde wieder
      const msg = e instanceof Error ? e.message : String(e);
      await logDecision('hold', null, [o.id], `Geocoding-Fehler: ${msg.slice(0, 100)}`);
      return 'held';
    }
  }

  // 3) Driver-Pool: tenant + active + online + im Radius vom Restaurant (haversine)
  if (loc.lat == null || loc.lng == null) {
    await logDecision('hold', null, [o.id], 'Restaurant nicht geocodiert');
    return 'held';
  }
  const drivers = await driversForTenant(loc.tenant_id);
  const nearby = drivers.filter((d) => {
    if (d.last_lat == null || d.last_lng == null) return true; // keine Position → trotzdem versuchen
    const km = haversineKm({ lat: d.last_lat, lng: d.last_lng }, { lat: loc.lat!, lng: loc.lng! });
    return km <= d.max_radius_km;
  });

  if (nearby.length === 0) {
    await logDecision('hold', null, [o.id], 'Kein Fahrer im Radius');
    return 'held';
  }

  // 4) Bundling: gibt's einen Driver mit pending_acceptance Bundle das passt?
  for (const d of nearby) {
    const { data: openBatch } = await c
      .from('mise_delivery_batches')
      .select('id, state')
      .eq('driver_id', d.id)
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant'])
      .maybeSingle();
    if (!openBatch) continue;

    const fits = await canBundle(openBatch.id, d, o, loc);
    if (!fits) continue;

    await addOrderToBundle(openBatch.id, o.id, loc, d.vehicle);
    await rerouteBundle(openBatch.id);
    await logDecision(
      'bundle',
      d.id,
      [o.id],
      `An offenen Bundle gehängt — kürzerer Umweg als neuer Trip.`,
    );
    return 'bundled';
  }

  // 5) Neuer Bundle für nearest-Driver (nach last position oder zufällig)
  const best = pickBest(nearby, loc);
  const batch = await createBundle(best.id, o, loc);
  await rerouteBundle(batch);
  await logDecision('assign', best.id, [o.id], `Direkt zugewiesen — kein passender Bundle offen.`);
  return 'assigned';
}

async function driversForTenant(tenantId: string): Promise<DriverRow[]> {
  const c = sb();
  const { data } = await c
    .from('mise_driver_tenants')
    .select(
      `status,
       driver:driver_id(id, vehicle, max_radius_km, last_lat, last_lng, state, active)`,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  return (data ?? [])
    .map((row: any) => row.driver)
    .filter((d: any) => d && d.active && d.state !== 'offline')
    .map((d: any) => ({
      id: d.id,
      vehicle: d.vehicle,
      max_radius_km: Number(d.max_radius_km),
      last_lat: d.last_lat,
      last_lng: d.last_lng,
      state: d.state,
    }));
}

async function canBundle(
  batchId: string,
  driver: DriverRow,
  newOrder: OrderRow,
  pickupLoc: LocationRow,
): Promise<boolean> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, lat, lng, order_id')
    .eq('batch_id', batchId);
  const dropoffs = (stops ?? []).filter((s: any) => s.type === 'dropoff');
  const pickups = (stops ?? []).filter((s: any) => s.type === 'pickup');

  // Slot-Check
  if (dropoffs.length >= VEHICLE_SLOTS[driver.vehicle]) return false;

  // Pickup-Restaurant identisch? Sonst zwingt das eine 2. Pickup-Stop → nur erlaubt
  // wenn Pickup auch nah am bestehenden Bundle (haversine < detour)
  const samePickup = pickups.some(
    (p: any) =>
      p.lat != null &&
      p.lng != null &&
      pickupLoc.lat != null &&
      pickupLoc.lng != null &&
      haversineKm({ lat: p.lat, lng: p.lng }, { lat: pickupLoc.lat, lng: pickupLoc.lng }) < 0.1,
  );

  // Dropoff in der Nähe einer existierenden Dropoff?
  if (newOrder.kunde_lat == null || newOrder.kunde_lng == null) return false;
  const nearDropoff = dropoffs.some((d: any) => {
    if (d.lat == null || d.lng == null) return false;
    return (
      haversineKm(
        { lat: d.lat, lng: d.lng },
        { lat: newOrder.kunde_lat!, lng: newOrder.kunde_lng! },
      ) < MAX_BUNDLE_DETOUR_KM
    );
  });

  return samePickup && nearDropoff;
}

function pickBest(drivers: DriverRow[], pickupLoc: LocationRow): DriverRow {
  if (pickupLoc.lat == null || pickupLoc.lng == null) return drivers[0];
  return drivers
    .map((d) => ({
      d,
      km:
        d.last_lat != null && d.last_lng != null
          ? haversineKm(
              { lat: d.last_lat, lng: d.last_lng },
              { lat: pickupLoc.lat!, lng: pickupLoc.lng! },
            )
          : 999,
    }))
    .sort((a, b) => a.km - b.km)[0].d;
}

async function createBundle(driverId: string, o: OrderRow, loc: LocationRow): Promise<string> {
  const c = sb();
  const { data: batch, error } = await c
    .from('mise_delivery_batches')
    .insert({ driver_id: driverId, state: 'pending_acceptance' })
    .select('id')
    .single();
  if (error || !batch) throw new Error(error?.message ?? 'Batch insert failed');

  await c.from('mise_delivery_batch_stops').insert([
    {
      batch_id: batch.id,
      order_id: o.id,
      type: 'pickup',
      sequence: 0,
      lat: loc.lat,
      lng: loc.lng,
      address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
    },
    {
      batch_id: batch.id,
      order_id: o.id,
      type: 'dropoff',
      sequence: 1,
      lat: o.kunde_lat,
      lng: o.kunde_lng,
      address: o.kunde_adresse,
    },
  ]);

  await c
    .from('customer_orders')
    .update({ mise_batch_id: batch.id, mise_driver_id: driverId })
    .eq('id', o.id);

  return batch.id;
}

async function addOrderToBundle(
  batchId: string,
  orderId: string,
  loc: LocationRow,
  _vehicle: 'bike' | 'car',
): Promise<void> {
  const c = sb();
  // Existing max sequence holen
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('sequence, type, order_id, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: false });
  const maxSeq = stops && stops.length > 0 ? stops[0].sequence : -1;

  // Pickup für selben Restaurant → nicht erneut anlegen
  const samePickup = (stops ?? []).find(
    (s: any) =>
      s.type === 'pickup' &&
      s.lat != null &&
      s.lng != null &&
      loc.lat != null &&
      loc.lng != null &&
      haversineKm({ lat: s.lat, lng: s.lng }, { lat: loc.lat, lng: loc.lng }) < 0.1,
  );

  const { data: o } = await c
    .from('customer_orders')
    .select('kunde_lat, kunde_lng, kunde_adresse')
    .eq('id', orderId)
    .single();

  const inserts: Array<{
    batch_id: string;
    order_id: string;
    type: 'pickup' | 'dropoff';
    sequence: number;
    lat: number | null;
    lng: number | null;
    address: string | null;
  }> = [];
  let nextSeq = maxSeq + 1;
  if (!samePickup) {
    inserts.push({
      batch_id: batchId,
      order_id: orderId,
      type: 'pickup',
      sequence: nextSeq++,
      lat: loc.lat,
      lng: loc.lng,
      address: [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name,
    });
  }
  inserts.push({
    batch_id: batchId,
    order_id: orderId,
    type: 'dropoff',
    sequence: nextSeq,
    lat: o?.kunde_lat ?? null,
    lng: o?.kunde_lng ?? null,
    address: o?.kunde_adresse ?? null,
  });
  await c.from('mise_delivery_batch_stops').insert(inserts);
  await c
    .from('customer_orders')
    .update({ mise_batch_id: batchId })
    .eq('id', orderId);
  // mise_driver_id wird über die Bundle-Verknüpfung indirekt klar — Backwards-Kompatibilität
  const { data: bundleDriver } = await c
    .from('mise_delivery_batches')
    .select('driver_id')
    .eq('id', batchId)
    .maybeSingle();
  if (bundleDriver?.driver_id) {
    await c
      .from('customer_orders')
      .update({ mise_driver_id: bundleDriver.driver_id })
      .eq('id', orderId);
  }
}

/**
 * Berechnet die Multi-Stop-Route über Google Directions (mit waypoint-optimize),
 * speichert polyline + total_distance + total_eta + neue stop-sequence.
 *
 * Fallback wenn Google nicht antwortet: Stops bleiben in DB-Reihenfolge,
 * polyline bleibt null, distance/eta via Haversine geschätzt.
 */
async function rerouteBundle(batchId: string): Promise<void> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, sequence, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });
  if (!stops || stops.length < 2) return;

  // Pickups zuerst, dann Dropoffs (vereinfacht; bei mehr als 1 pickup wird Google
  // optimieren). Driver-Position als origin wäre besser, ist aber für v1 weggelassen.
  const pickups = stops.filter((s: any) => s.type === 'pickup');
  const dropoffs = stops.filter((s: any) => s.type === 'dropoff');
  const ordered = [...pickups, ...dropoffs].filter(
    (s: any) => s.lat != null && s.lng != null,
  );
  if (ordered.length < 2) return;

  const origin = { lat: ordered[0].lat as number, lng: ordered[0].lng as number };
  const destination = {
    lat: ordered[ordered.length - 1].lat as number,
    lng: ordered[ordered.length - 1].lng as number,
  };
  const waypoints = ordered.slice(1, -1).map((s: any) => ({ lat: s.lat as number, lng: s.lng as number }));

  let route: RouteResult | null = null;
  try {
    route = await directions({
      origin,
      destination,
      waypoints,
      optimize: dropoffs.length > 1, // nur bei mehreren Dropoffs Sinn
      mode: 'driving',
    });
  } catch {
    route = null;
  }

  if (route) {
    await c
      .from('mise_delivery_batches')
      .update({
        polyline: route.polyline,
        total_distance_km: Math.round((route.total_distance_m / 1000) * 10) / 10,
        total_eta_min: Math.round(route.total_duration_s / 60),
      })
      .eq('id', batchId);
  } else {
    // Fallback: haversine
    let km = 0;
    for (let i = 0; i < ordered.length - 1; i++) {
      km += haversineKm(
        { lat: ordered[i].lat as number, lng: ordered[i].lng as number },
        { lat: ordered[i + 1].lat as number, lng: ordered[i + 1].lng as number },
      );
    }
    await c
      .from('mise_delivery_batches')
      .update({
        polyline: null,
        total_distance_km: Math.round(km * 10) / 10,
        total_eta_min: Math.round((km / 18) * 60), // bike-Annahme
      })
      .eq('id', batchId);
  }
}

async function logDecision(
  type: 'assign' | 'hold' | 'rebalance' | 'reroute' | 'bundle' | 'cancel',
  driverId: string | null,
  orderIds: string[],
  reasonText: string,
): Promise<void> {
  const c = sb();
  await c.from('mise_frank_decisions').insert({
    type,
    driver_id: driverId,
    order_ids: orderIds,
    reason_text: reasonText,
  });
}
