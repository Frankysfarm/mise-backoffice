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
 *
 * Phase 4 (2026-07-20): Smart Hold-Window, Single-Driver-Modus, dynamischer CAP,
 *    pickBest Restaurant-Präferenz.
 *
 * Phase 4.1 (2026-07-20): DB-persistente Holds (statt in-memory siblingHoldMap),
 *    N+1-Fix (Driver-Cache pro Tick), Advisory-Lock via mise_frank_decisions.
 *
 * Phase 4.2 (2026-07-20): Präzise Hold-Reasons (NO_DRIVER/DRIVER_STALE_GPS/DRIVER_FULL),
 *    Stale-Driver-Reconciliation (state='stale'), In-Memory Tick-Throttle pro Tenant,
 *    Eskalations-Alert via mise_alerts-Tabelle nach 5 min ohne Fahrer.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { directions, geocode, haversineKm, type RouteResult } from './google-maps';
import { enqueueBatchPush } from './delivery/push-notify';
import { scheduleKitchenHold } from './delivery/kitchen-sync';
import { hasCurrentDriverSession } from './delivery/driver-shift-eligibility';

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
  created_at?: string | null;
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

function dispatchCreatedAfter(): string | null {
  const raw = process.env.DELIVERY_DISPATCH_CREATED_AFTER?.trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error('DELIVERY_DISPATCH_CREATED_AFTER must be a valid ISO timestamp');
  }
  return new Date(timestamp).toISOString();
}

// FIX 2: In-Memory Tick-Throttle — vermeidet sinnlose DB-Writes wenn Tenant dauerhaft kein Fahrer hat.
// Map<tenantId, lastNoDriverAt (ms)> — verliert sich bei Restart, ist OK.
const tenantNoDriverThrottle = new Map<string, number>();
// FIX 4: Throttle für Eskalations-Alerts — max 1 Alert pro Tenant pro 55min.
const tenantAlertThrottle = new Map<string, number>();

const VEHICLE_SLOTS: Record<'bike' | 'car', number> = { bike: 2, car: 4 };
const MAX_BUNDLE_DETOUR_KM = 1.5;
const CAP_BASE = 4;                 // Basis: max aktive Liefer-Stopps pro Fahrer (Pasta bleibt warm - Founder Tahar)
const CAP_CLUSTER = 5;              // bis 5 erlaubt, WENN die neue Order nah an der bestehenden Tour liegt
const CAP_CLUSTER_RADIUS_KM = 2.0;  // "nah beieinander" = neue Lieferadresse <= 2 km an einem bestehenden Stopp

// Sibling-Hold (Founder-Idee): Fern-Order max. HOLD_MAX_MS warten wenn nahe Schwester-Order fast fertig
const FAR_KM = 3.5;        // ab dieser Dropoff-Distanz gilt "Fern" (Orders < 3.5 km werden IMMER sofort geschickt)
// HOLD_MAX_MS wird jetzt dynamisch aus tenants.dispatch_strategy gelesen (s.u.)
// ENTFERNT: siblingHoldMap und siblingTargetMap — nicht restart-sicher.
// Holds werden DB-persistent in customer_orders.dispatch_after / hold_reason / hold_for_order_id gespeichert.

// --- Dispatch-Strategien pro Restaurant (tenants.dispatch_strategy) ---
type DispatchStrategy = 'speed' | 'balance' | 'spar';
interface StrategyPreset {
  detourKm: number;
  slotBonus: number;
  holdSec: number;    // Hold-Window in Sekunden (0 = kein Hold)
  maxStops: number;   // Maximale Stops pro Fahrer (CAP_BASE override)
  maxStopsCluster: number; // CAP_CLUSTER override
}
const STRATEGY_PRESETS: Record<DispatchStrategy, StrategyPreset> = {
  speed:   { detourKm: 0.5, slotBonus: 0, holdSec: 0,   maxStops: 3, maxStopsCluster: 4 },
  balance: { detourKm: 1.5, slotBonus: 0, holdSec: 300,  maxStops: 4, maxStopsCluster: 5 },
  spar:    { detourKm: 2.5, slotBonus: 1, holdSec: 600,  maxStops: 5, maxStopsCluster: 6 },
};

async function tenantStrategy(tenantId: string): Promise<StrategyPreset & { strategy: DispatchStrategy }> {
  const { data } = await sb().from('tenants').select('dispatch_strategy').eq('id', tenantId).maybeSingle();
  const s = ((data as { dispatch_strategy?: string } | null)?.dispatch_strategy as DispatchStrategy) ?? 'balance';
  const preset = STRATEGY_PRESETS[s] ?? STRATEGY_PRESETS.balance;
  return { ...preset, strategy: s };
}

export interface DispatchTickResult {
  scanned_orders: number;
  bundled: number;
  assigned: number;
  held: number;
}

/**
 * Periodisch vom Cron aufgerufen — scannt unzugewiesene Lieferungs-Orders
 * und ordnet sie zu.
 *
 * Änderung 3 (Advisory-Lock): Verhindert Doppel-Ticks via mise_frank_decisions.
 * Änderung 2 (N+1-Fix): Fahrer werden einmal pro Tick geladen, nicht pro Order.
 * Änderung 1 (DB-Holds): dispatch_after-Filter in der Query schließt gehaltene Orders aus.
 */
export async function dispatchTick(): Promise<DispatchTickResult> {
  const c = sb();

  // --- Änderung 3: Advisory-Lock via mise_frank_decisions ---
  // Prüfe ob in den letzten 55 Sekunden ein tick_lock-Eintrag existiert.
  // Verhindert parallele Ticks wenn Cron-Intervall kürzer ist als Tick-Dauer.
  const { data: recentLock } = await c
    .from('mise_frank_decisions')
    .select('created_at')
    .eq('type', 'tick_lock')
    .gt('created_at', new Date(Date.now() - 55_000).toISOString())
    .limit(1);
  if (recentLock && recentLock.length > 0) {
    console.log('[frank] Tick bereits aktiv, überspringe');
    return { scanned_orders: 0, bundled: 0, assigned: 0, held: 0 };
  }
  // Lock setzen
  await c.from('mise_frank_decisions').insert({
    type: 'tick_lock',
    driver_id: null,
    order_ids: [],
    reason_text: 'tick_lock:' + new Date().toISOString(),
  });

  // Stale-Tour-Rettung: haengende pending-Batches aufraeumen
  try { await rescueStaleTours(); } catch { /* nicht fatal */ }

  // FIX 3: Stale-Driver-Reconciliation — setzt GPS-tote Fahrer auf state='stale'
  try { await reconcileStaleDrivers(); } catch { /* nicht fatal */ }

  // --- Änderung 1: dispatch_after-Filter — Orders im Hold werden übersprungen ---
  // Orders ohne dispatch_after (kein Hold) oder mit dispatch_after in der Vergangenheit werden geladen.
  const nowIso = new Date().toISOString();
  const cutoff = dispatchCreatedAfter();
  let pendingOrdersQuery = c
    .from('customer_orders')
    .select('id, bestellnummer, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, created_at')
    .eq('typ', 'lieferung')
    .is('mise_driver_id', null)
    .is('mise_batch_id', null)
    .in('status', ['fertig'])  // B: Fahrer erst rufen wenn die Kueche FERTIG gekocht hat (Kueche zuerst)
    .or(`dispatch_after.is.null,dispatch_after.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(50);

  // Keep unresolved historical orders available for an explicit operator
  // decision. Both dispatch engines must honor the same rollout cutoff; this
  // legacy Frank tick runs independently every few seconds.
  if (cutoff) pendingOrdersQuery = pendingOrdersQuery.gte('created_at', cutoff);

  const { data: orders, error: ordersError } = await pendingOrdersQuery;
  if (ordersError) {
    throw new Error(`Frank pending delivery query failed: ${ordersError.message}`);
  }

  const result: DispatchTickResult = {
    scanned_orders: orders?.length ?? 0,
    bundled: 0,
    assigned: 0,
    held: 0,
  };

  // --- Änderung 2: N+1-Fix — alle Tenant-Fahrer einmal vorladen ---
  // Sammle alle unique tenant_ids der pending Orders und lade Fahrer in einem Query pro Tenant.
  // Dazu müssen wir die tenant_id der Orders über ihre location_id auflösen.
  // Da OrderRow keine tenant_id hat, laden wir locations parallel.
  const tenantDriverCache = new Map<string, DriverRow[]>();

  if (orders && orders.length > 0) {
    // Alle unique location_ids holen
    const uniqueLocationIds = [...new Set((orders as OrderRow[]).map(o => o.location_id).filter(Boolean))] as string[];
    // Locations laden um tenant_ids zu erhalten
    const { data: locationsForCache } = await c
      .from('locations')
      .select('id, tenant_id')
      .in('id', uniqueLocationIds);
    // Unique tenant_ids extrahieren
    const uniqueTenantIds = [...new Set((locationsForCache ?? []).map((l: any) => l.tenant_id).filter(Boolean))] as string[];
    // Fahrer für alle Tenants vorladen
    for (const tid of uniqueTenantIds) {
      tenantDriverCache.set(tid, await driversForTenant(tid));
    }
  }

  for (const o of orders ?? []) {
    const outcome = await dispatchOrder(o as OrderRow, tenantDriverCache);
    if (outcome === 'bundled') result.bundled++;
    else if (outcome === 'assigned') result.assigned++;
    else result.held++;
  }
  return result;
}

type Outcome = 'bundled' | 'assigned' | 'held';

/**
 * Prüft ob ein Hold für eine Order noch aktiv ist (DB-persistent).
 * Gibt false zurück wenn:
 *  - dispatch_after in der Vergangenheit liegt (Hold abgelaufen)
 *  - hold_for_order_id bereits einen Batch hat (Sibling wurde dispatcht → sofort freigeben)
 */
async function isStillOnHold(orderId: string, holdForOrderId: string | null, dispatchAfter: string | null): Promise<boolean> {
  if (!dispatchAfter) return false;
  // Ist der Hold-Zeitpunkt bereits abgelaufen?
  if (new Date(dispatchAfter) <= new Date()) return false;
  // Ist der Sibling bereits in einem Batch? → sofort freigeben
  if (holdForOrderId) {
    const { data: siblingOrder } = await sb()
      .from('customer_orders')
      .select('mise_batch_id')
      .eq('id', holdForOrderId)
      .maybeSingle();
    if (siblingOrder?.mise_batch_id) return false; // Sibling dispatcht → Hold aufheben
  }
  return true; // Hold noch aktiv
}

export async function dispatchOrder(o: OrderRow, tenantDriverCache?: Map<string, DriverRow[]>): Promise<Outcome> {
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

  // Tenant-Strategie laden (für Hold-Window, CAP etc.)
  const preset = await tenantStrategy(loc.tenant_id);

  // 2b) Smart Geographic Hold: Fern-Order halten wenn nahe Schwester-Order wartet
  // Änderung 1: DB-persistente Holds statt in-memory siblingHoldMap
  const shouldHoldForSibling = await checkSiblingHold(o, preset.holdSec).catch(() => false);
  if (shouldHoldForSibling) return 'held';

  // 3) Fahrer für Tenant laden
  // Änderung 2: aus Cache laden wenn vorhanden (N+1-Fix)
  const allDrivers = tenantDriverCache?.get(loc.tenant_id) ?? await driversForTenant(loc.tenant_id);

  // Single-Driver-Modus: Wenn nur 1 Fahrer online, spezielle Behandlung
  const soloMode = allDrivers.length === 1;

  if (allDrivers.length === 0) {
    // FIX 2: In-Memory Tick-Throttle — schreibe hold nur wenn letzter für diesen Tenant > 60s alt
    const lastNoDriver = tenantNoDriverThrottle.get(loc.tenant_id) ?? 0;
    const throttleAge = Date.now() - lastNoDriver;
    if (throttleAge > 60_000) {
      // FIX 1: Präziser Hold-Reason — unterscheide stale vs. wirklich offline
      const staleInfo = await getStaleDriverInfo(loc.tenant_id);
      let reasonCode: string;
      let reasonData: Record<string, unknown> | undefined;
      if (staleInfo.staleCount > 0 && staleInfo.totalActive === 0) {
        reasonCode = `ALL_DRIVERS_STALE (${staleInfo.staleCount} Fahrer, GPS >15min)`;
        reasonData = { stale_drivers: staleInfo.staleDrivers };
      } else {
        reasonCode = 'NO_DRIVER_ONLINE';
      }
      await logDecision('hold', null, [o.id], reasonCode, reasonData);
      tenantNoDriverThrottle.set(loc.tenant_id, Date.now());
    }
    // FIX 4: Eskalations-Alert nach 5 min ohne Fahrer
    if (o.created_at && Date.now() - new Date(o.created_at).getTime() > 5 * 60 * 1000) {
      void checkEscalation(loc.tenant_id, o).catch((err) => { console.error('[frank] checkEscalation fehlgeschlagen:', err?.message ?? err); });
      // Legacy-Push weiterhin feuern (VAPID-Fallback)
      void alertOwnerNoDriver(o).catch((err) => { console.error('[frank] alertOwnerNoDriver fehlgeschlagen:', err?.message ?? err); });
    }
    return 'held';
  }

  // Dynamischer CAP: aus Tenant-Strategie holen; im Solo-Modus +2 Bonus
  const capBase    = soloMode ? preset.maxStops + 2    : preset.maxStops;
  const capCluster = soloMode ? preset.maxStopsCluster + 2 : preset.maxStopsCluster;

  // Solo-Modus: Radius-Filter überspringen und maximalen Radius setzen
  const driversWithRadius: DriverRow[] = soloMode
    ? allDrivers.map((d) => ({ ...d, max_radius_km: 9999 }))
    : allDrivers;

  const eligible: DriverRow[] = [];
  for (const d of driversWithRadius) {
    const dropoffs = await driverActiveDropoffs(d.id);
    const n = dropoffs.length;
    if (n < capBase) { eligible.push(d); continue; }
    if (n < capCluster && o.kunde_lat != null && o.kunde_lng != null) {
      const nearCluster = dropoffs.some((st) => haversineKm(st, { lat: o.kunde_lat!, lng: o.kunde_lng! }) <= CAP_CLUSTER_RADIUS_KM);
      if (nearCluster) eligible.push(d);
    }
  }
  if (eligible.length === 0) {
    // Ueberlauf: Order in die Koch-Warteschlange -> Kueche kocht erst wenn ein Fahrer auf Rueckweg ist (JIT-Frische)
    if (o.location_id) { try { await scheduleKitchenHold(o.id, o.location_id, null); } catch { /* nicht fatal */ } }
    // FIX 1: Präziser Hold-Reason DRIVER_FULL
    const capLabel = soloMode ? `Solo-Modus: Fahrer voll (Basis ${capBase}, Cluster bis ${capCluster})` : `Alle Fahrer voll (Basis ${capBase}, Cluster bis ${capCluster})`;
    await logDecision('hold', null, [o.id], `DRIVER_FULL: ${capLabel} - Order wartet (kochgesperrt)`, {
      reason_code: 'DRIVER_FULL',
      cap_base: capBase,
      cap_cluster: capCluster,
      solo_mode: soloMode,
    });
    return 'held';
  }

  // Radius-Präferenz: wer im Radius ist zuerst; bei Solo-Modus Radius-Filter komplett überspringen
  let pool: DriverRow[];
  if (soloMode) {
    // Im Solo-Modus: Radius-Filter vollständig überspringen
    pool = eligible;
  } else {
    const inRadius = eligible.filter((d) => {
      if (d.last_lat == null || d.last_lng == null) return true;
      if (loc.lat == null || loc.lng == null) return true;
      return haversineKm({ lat: d.last_lat, lng: d.last_lng }, { lat: loc.lat, lng: loc.lng }) <= d.max_radius_km;
    });
    pool = inRadius.length > 0 ? inRadius : eligible;
  }

  const dropoffCountMap = new Map<string, number>();
  for (const d of pool) {
    const dc = await driverActiveDropoffs(d.id);
    dropoffCountMap.set(d.id, dc.length);
  }
  const best = pickBest(pool, loc, dropoffCountMap);
  const restaurantName = [loc.adresse, loc.plz, loc.stadt].filter(Boolean).join(', ') || loc.name;
  const distanceKm = (best.last_lat != null && best.last_lng != null && loc.lat != null && loc.lng != null)
    ? haversineKm({ lat: best.last_lat, lng: best.last_lng }, { lat: loc.lat, lng: loc.lng })
    : 0;

  // Cross-shop bundling: gleiche Pickup-Adresse, selber Fahrer, noch pending_acceptance
  const existingBatchId = await findBundleableBatch(best.id, loc, capBase);
  if (existingBatchId) {
    await addOrderToBundle(existingBatchId, o.id, loc, best.vehicle);
    await logDecision('bundle', best.id, [o.id], `Cross-shop Bundle (gleiche Pickup-Adresse)${soloMode ? ' [Solo-Modus]' : ''}`);
    void enqueueBatchPush({ driverId: best.id, batchId: existingBatchId, orderCount: 2, restaurantName, distanceKm, outcome: 'dispatched' }).catch(() => {});
    return 'bundled';
  }

  const batchId = await createBundle(best.id, o, loc);
  await logDecision('assign', best.id, [o.id], `Einzeln angeboten (simpler Dispatch)${soloMode ? ' [Solo-Modus]' : ''}`);
  void enqueueBatchPush({ driverId: best.id, batchId, orderCount: 1, restaurantName, distanceKm, outcome: 'dispatched' }).catch(() => {});
  return 'assigned';
}

// Aktive Liefer-Stopps (Dropoff-Positionen) eines Fahrers ueber alle offenen Touren -> fuer den dynamischen Cap
async function driverActiveDropoffs(driverId: string): Promise<Array<{ lat: number; lng: number }>> {
  const c = sb();
  const { data } = await c
    .from('mise_delivery_batches')
    .select('id, stops:mise_delivery_batch_stops(type, lat, lng, completed_at)')
    .eq('driver_id', driverId)
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress']);
  const out: Array<{ lat: number; lng: number }> = [];
  for (const b of (data ?? []) as any[]) {
    for (const st of ((b.stops ?? []) as any[])) {
      if (st.type === 'dropoff' && st.completed_at == null && st.lat != null && st.lng != null) out.push({ lat: st.lat, lng: st.lng });
    }
  }
  return out;
}

async function driversForTenant(tenantId: string): Promise<DriverRow[]> {
  const c = sb();
  const nowIso = new Date().toISOString();
  const { data } = await c
    .from('mise_driver_tenants')
    .select(
      `status,
       driver:driver_id(id, vehicle, max_radius_km, last_lat, last_lng, state, active, excluded_until, last_position_at, shift_started_at)`,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  return (data ?? [])
    .map((row: any) => row.driver)
    .filter((d: any) => d && d.active && d.state !== 'offline')
    // A device left online overnight must not receive tomorrow's orders.
    .filter((d: any) => hasCurrentDriverSession(d.shift_started_at))
    // Fahrer ausschliessen die gerade im DB-Timeout sind (excluded_until in der Zukunft)
    .filter((d: any) => !d.excluded_until || d.excluded_until < nowIso)
    // Ghost-Driver-Fix: Fahrer ohne frisches GPS (>15 Min) aus dem Pool
    .filter((d: any) => !d.last_position_at || d.last_position_at > new Date(Date.now() - 15 * 60 * 1000).toISOString())
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
  preset: StrategyPreset,
): Promise<boolean> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, lat, lng, order_id')
    .eq('batch_id', batchId);
  const dropoffs = (stops ?? []).filter((s: any) => s.type === 'dropoff');
  const pickups = (stops ?? []).filter((s: any) => s.type === 'pickup');

  // Slot-Check
  if (dropoffs.length >= VEHICLE_SLOTS[driver.vehicle] + preset.slotBonus) return false;

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
      ) < preset.detourKm
    );
  });

  return samePickup && nearDropoff;
}

/**
 * Wählt den besten Fahrer aus dem Pool.
 * Priorität:
 *  1. Fahrer, der bereits am selben Restaurant wartet (at_restaurant) — direkter Bundle-Vorteil
 *  2. Fahrer mit wenigsten aktiven Stops
 *  3. Fahrer der räumlich am nächsten zum Restaurant ist
 */
function pickBest(drivers: DriverRow[], pickupLoc: LocationRow, activeDropoffCounts?: Map<string, number>): DriverRow {
  if (pickupLoc.lat == null || pickupLoc.lng == null) return drivers[0];

  // Prüfen ob Pickup-Koordinaten vorhanden
  const pickupCoord = { lat: pickupLoc.lat!, lng: pickupLoc.lng! };

  return drivers
    .map((d) => {
      const km =
        d.last_lat != null && d.last_lng != null
          ? haversineKm({ lat: d.last_lat, lng: d.last_lng }, pickupCoord)
          : 999;
      const stops = activeDropoffCounts?.get(d.id) ?? 0;

      // Restaurant-Präferenz: Fahrer der bereits am Pickup ist bekommt Bonus
      // (state='at_restaurant' UND nah am Restaurant → sehr wahrscheinlich warten sie dort)
      const atRestaurant =
        d.state === 'at_restaurant' &&
        d.last_lat != null &&
        d.last_lng != null &&
        haversineKm({ lat: d.last_lat, lng: d.last_lng }, pickupCoord) < 0.3; // < 300m

      return { d, km, stops, atRestaurant };
    })
    // Sortierung: 1. am Restaurant (true vor false), 2. wenigste Stops, 3. kürzeste Distanz
    .sort((a, b) => {
      if (a.atRestaurant !== b.atRestaurant) return a.atRestaurant ? -1 : 1;
      if (a.stops !== b.stops) return a.stops - b.stops;
      return a.km - b.km;
    })[0].d;
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
export async function rerouteBundle(batchId: string): Promise<void> {
  const c = sb();
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('id, type, sequence, lat, lng')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });
  if (!stops || stops.length < 2) return;

  // Fahrer-Position als Route-Origin fuer korrekte ETAs waehrend Fahrt
  const pickups = stops.filter((s: any) => s.type === 'pickup');
  const dropoffs = stops.filter((s: any) => s.type === 'dropoff');
  const ordered = [...pickups, ...dropoffs].filter(
    (s: any) => s.lat != null && s.lng != null,
  );
  if (ordered.length < 2) return;

  const { data: batchOriginRow } = await c
    .from('mise_delivery_batches')
    .select('driver:mise_drivers(last_lat, last_lng, last_position_at)')
    .eq('id', batchId)
    .maybeSingle();
  const dp = (batchOriginRow as any)?.driver;
  const dpAge = dp?.last_position_at ? Date.now() - new Date(dp.last_position_at).getTime() : Infinity;
  const useDriverPos = dp?.last_lat != null && dp?.last_lng != null && dpAge < 5 * 60 * 1000;
  const origin = useDriverPos
    ? { lat: dp.last_lat as number, lng: dp.last_lng as number }
    : { lat: ordered[0].lat as number, lng: ordered[0].lng as number };
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
      optimize: dropoffs.length > 1 && pickups.length === 1, // TSP nur bei mehreren Dropoffs + GENAU EINEM Pickup (sonst koennte ein Dropoff vor seinen Pickup sortiert werden)
      mode: 'driving',
    });
  } catch {
    route = null;
  }

  if (route) {
    // Google-optimierte Reihenfolge (TSP) auf die Stopps anwenden -> Fahrer faehrt nicht kreuz und quer
    if (route.optimized_order && route.optimized_order.length === waypoints.length) {
      const middle = ordered.slice(1, -1);
      const finalOrder = [ordered[0], ...route.optimized_order.map((i) => middle[i]), ordered[ordered.length - 1]];
      for (let i = 0; i < finalOrder.length; i++) {
        await c.from('mise_delivery_batch_stops').update({ sequence: i + 1 }).eq('id', (finalOrder[i] as any).id);
      }
    }
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
    // Fahrzeug-Typ fuer realistische ETA (B2-Fix: 'car' statt 'auto')
    const { data: bv } = await c
      .from('mise_delivery_batches')
      .select('driver:mise_drivers(vehicle)')
      .eq('id', batchId)
      .maybeSingle();
    const vType = (bv as any)?.driver?.vehicle ?? 'bike';
    const speedKmh = vType === 'car' || vType === 'scooter' ? 40 : 18;
    await c
      .from('mise_delivery_batches')
      .update({
        polyline: null,
        total_distance_km: Math.round(km * 10) / 10,
        total_eta_min: Math.round((km / speedKmh) * 60),
      })
      .eq('id', batchId);
  }
}


/**
 * Smart Geographic Hold — DB-persistent (Änderung 1, Phase 4.1).
 *
 * Hält ferne Orders in der DB (dispatch_after / hold_reason / hold_for_order_id),
 * statt in-memory siblingHoldMap. Restart-sicher.
 *
 * Logik:
 *  - Nahe Orders (Dropoff <= FAR_KM vom Restaurant): nie halten, sofort dispatchen.
 *  - Ferne Orders: Suche Sibling-Order im selben Standort die noch in_zubereitung/neu ist
 *    UND deren Dropoff geographisch nahe an unserer Order liegt (< 5 km).
 *  - Hold-Window kommt aus tenants.dispatch_strategy (speed=0s, balance=300s, spar=600s).
 *  - Hold wird in customer_orders.dispatch_after/hold_reason/hold_for_order_id gespeichert.
 *
 * @param o - Die zu prüfende Order
 * @param holdSec - Hold-Dauer in Sekunden aus dem Tenant-Preset (0 = kein Hold)
 */
async function checkSiblingHold(o: OrderRow, holdSec: number): Promise<boolean> {
  if (!o.kunde_lat || !o.kunde_lng || !o.location_id) return false;
  if (!o.created_at) return false;

  // Wenn hold_window = 0 (Speed-Strategie), nie halten
  if (holdSec <= 0) return false;

  // Nur Fern-Orders halten (nahe Orders sofort schicken)
  const restaurantLoc = await sb().from('locations').select('lat, lng').eq('id', o.location_id).maybeSingle();
  if (!restaurantLoc.data?.lat || !restaurantLoc.data?.lng) return false;
  const dropoffDist = haversineKm(
    { lat: restaurantLoc.data.lat, lng: restaurantLoc.data.lng },
    { lat: o.kunde_lat, lng: o.kunde_lng }
  );
  if (dropoffDist <= FAR_KM) return false; // Nahe Order -> immer sofort schicken

  // --- Änderung 1: DB-persistenter Hold-Check statt in-memory Map ---
  // Lade aktuellen Hold-Status aus der DB
  const { data: currentOrderData } = await sb()
    .from('customer_orders')
    .select('dispatch_after, hold_reason, hold_for_order_id')
    .eq('id', o.id)
    .maybeSingle();

  const dispatchAfter: string | null = (currentOrderData as any)?.dispatch_after ?? null;
  const holdForOrderId: string | null = (currentOrderData as any)?.hold_for_order_id ?? null;

  if (dispatchAfter) {
    // Aktiver Hold vorhanden: prüfen ob noch gültig
    const stillHeld = await isStillOnHold(o.id, holdForOrderId, dispatchAfter);
    if (!stillHeld) {
      // Hold abgelaufen oder Sibling dispatcht → Hold in DB zurücksetzen
      await sb()
        .from('customer_orders')
        .update({ dispatch_after: null, hold_reason: null, hold_for_order_id: null })
        .eq('id', o.id)
        .is('mise_batch_id', null);
      return false;
    }
    return true; // Hold weiter aktiv
  }

  // Kein aktiver Hold: Sibling suchen
  // Geografischer Hold: suche Orders desselben Standorts, deren Dropoff < 5km von unserer liegt
  const GEO_SIBLING_RADIUS_KM = 5.0;
  const holdWindowMs = holdSec * 1000;

  // Suche Sibling-Orders: gleicher Standort, in Zubereitung/neu, noch nicht dispatched
  // und erstellt innerhalb des Hold-Windows
  const windowStart = new Date(Date.now() - holdWindowMs).toISOString();
  const { data: siblings } = await sb()
    .from('customer_orders')
    .select('id, bestellnummer, created_at, kunde_lat, kunde_lng')
    .eq('location_id', o.location_id)
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .neq('id', o.id)
    .in('status', ['in_zubereitung', 'neu', 'fertig'])
    .gt('created_at', windowStart)  // Nur Orders die nicht älter als hold_window sind
    .limit(10);

  if (!siblings || siblings.length === 0) return false;

  // Sibling muss geografisch nah genug sein
  const nearSibling = (siblings as any[]).find((s: any) => {
    if (s.kunde_lat == null || s.kunde_lng == null) return false;
    const dist = haversineKm(
      { lat: s.kunde_lat, lng: s.kunde_lng },
      { lat: o.kunde_lat!, lng: o.kunde_lng! }
    );
    return dist <= GEO_SIBLING_RADIUS_KM;
  });

  if (!nearSibling) return false;

  // --- Änderung 1: Hold DB-persistent speichern statt in-memory Map ---
  const holdUntilIso = new Date(Date.now() + holdWindowMs).toISOString();
  await sb()
    .from('customer_orders')
    .update({
      dispatch_after: holdUntilIso,
      hold_reason: 'bundling_window',
      hold_for_order_id: nearSibling.id,
    })
    .eq('id', o.id)
    .is('mise_batch_id', null);

  const nearSiblingDist = nearSibling.kunde_lat != null && nearSibling.kunde_lng != null
    ? haversineKm({ lat: nearSibling.kunde_lat, lng: nearSibling.kunde_lng }, { lat: o.kunde_lat!, lng: o.kunde_lng! })
    : 0;

  await logDecision('hold', null, [o.id],
    `geographic_hold: Fern-Order (${dropoffDist.toFixed(1)} km) wartet auf Bestellung #${String(nearSibling.bestellnummer ?? '').slice(-5)} ` +
    `(Sibling-Dropoff ${nearSiblingDist.toFixed(1)} km entfernt, max ${Math.round(holdSec / 60)} min)`
  );
  return true;
}

// Findet einen bestehenden pending_acceptance-Batch des Fahrers am selben Pickup-Ort (Cross-shop bundling)
async function findBundleableBatch(driverId: string, loc: LocationRow, capBase: number = CAP_BASE): Promise<string | null> {
  if (!loc.lat || !loc.lng) return null;
  const c = sb();
  const { data: batches } = await c
    .from('mise_delivery_batches')
    .select('id, stops:mise_delivery_batch_stops(type, lat, lng, completed_at)')
    .eq('driver_id', driverId)
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant'])
    .limit(5);
  for (const batch of (batches ?? []) as any[]) {
    const stops = (batch.stops ?? []) as any[];
    const pickups = stops.filter((s: any) => s.type === 'pickup' && s.completed_at == null);
    const dropoffs = stops.filter((s: any) => s.type === 'dropoff' && s.completed_at == null);
    if (dropoffs.length >= capBase) continue;
    const samePickup = pickups.some((p: any) =>
      p.lat != null && p.lng != null &&
      haversineKm({ lat: p.lat, lng: p.lng }, { lat: loc.lat!, lng: loc.lng! }) < 0.1
    );
    if (samePickup) return batch.id as string;
  }
  return null;
}

// Haengende pending_acceptance-Batches abraeumen — Timeout 3 min (Fahrer hat nicht reagiert)
// Der abgelehnde Fahrer wird fuer 10 min per DB-Spalte excluded_until gesperrt (persistent, crash-sicher).

async function rescueStaleTours(): Promise<void> {
  const c = sb();
  const ago3 = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: stale } = await c
    .from('mise_delivery_batches')
    .select('id, driver_id, stops:mise_delivery_batch_stops(order_id)')
    .eq('state', 'pending_acceptance')
    .lt('created_at', ago3);
  for (const batch of (stale ?? []) as any[]) {
    const orderIds = Array.from(new Set((batch.stops ?? []).map((s: any) => s.order_id).filter(Boolean))) as string[];
    // Nicht-reagierenden Fahrer kurz sperren damit er nicht sofort wieder angeboten bekommt (DB-persistent)
    if (batch.driver_id) {
      await c.from('mise_drivers').update({ excluded_until: new Date(Date.now() + 10 * 60_000).toISOString() }).eq('id', batch.driver_id);
    }
    await c.from('mise_delivery_batches')
      .update({ state: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', batch.id);
    if (orderIds.length > 0) {
      await c.from('customer_orders')
        .update({ mise_batch_id: null, mise_driver_id: null })
        .in('id', orderIds);
    }
    await logDecision('cancel', batch.driver_id ?? null, orderIds, 'Stale pending_acceptance >3min — Order freigegeben, Fahrer 10min gesperrt');
  }
  // Abgelaufene DB-Exclusions bereinigen (excluded_until in der Vergangenheit → zurücksetzen)
  await c.from('mise_drivers').update({ excluded_until: null }).lt('excluded_until', new Date().toISOString());
}

// ─── FIX 1: Stale-Driver-Info — liefert detaillierte Fahrer-Stats für Hold-Reason ───────────────
interface StaleDriverInfo {
  totalActive: number;    // Fahrer active=true, state != 'offline', GPS frisch
  staleCount: number;     // Fahrer active=true, state != 'offline', aber GPS >15min alt
  staleDrivers: Array<{ id: string; name?: string; last_position_at: string | null }>;
}

async function getStaleDriverInfo(tenantId: string): Promise<StaleDriverInfo> {
  const c = sb();
  const staleThresholdIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await c
    .from('mise_driver_tenants')
    .select('driver:driver_id(id, name, active, state, last_position_at)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  const drivers = (data ?? []).map((row: any) => row.driver).filter((d: any) => d && d.active && d.state !== 'offline');
  const freshDrivers = drivers.filter((d: any) => !d.last_position_at || d.last_position_at > staleThresholdIso);
  const staleDrivers = drivers.filter((d: any) => d.last_position_at && d.last_position_at <= staleThresholdIso);
  return {
    totalActive: freshDrivers.length,
    staleCount: staleDrivers.length,
    staleDrivers: staleDrivers.map((d: any) => ({ id: d.id, name: d.name ?? undefined, last_position_at: d.last_position_at })),
  };
}

// ─── FIX 3: Stale-Driver-Reconciliation — setzt GPS-tote Fahrer auf state='stale' ─────────────
async function reconcileStaleDrivers(): Promise<void> {
  const c = sb();
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  // Fahrer die aktiv + nicht offline sind, aber GPS älter als 15 min → auf 'stale' setzen
  const { data: staleDrivers } = await c
    .from('mise_drivers')
    .select('id, name, last_position_at, state')
    .eq('active', true)
    .neq('state', 'offline')
    .neq('state', 'stale')
    .not('last_position_at', 'is', null)
    .lt('last_position_at', staleThreshold);

  if (!staleDrivers || staleDrivers.length === 0) return;

  for (const d of staleDrivers as any[]) {
    await c.from('mise_drivers').update({ state: 'stale' }).eq('id', d.id);
    await logDecision('driver_stale', d.id, [], `GPS-Timeout: ${d.name ?? d.id} — letzte Position ${d.last_position_at}`, {
      reason_code: 'DRIVER_STALE_GPS',
      driver_name: d.name ?? null,
      last_position_at: d.last_position_at,
    });
    console.log(`[frank] Fahrer ${d.name ?? d.id} → state='stale' (GPS ${d.last_position_at})`);
  }
}

// ─── FIX 4: Eskalations-Alert — schreibt in mise_alerts wenn 5min kein Fahrer ─────────────────
async function checkEscalation(tenantId: string, o: OrderRow): Promise<void> {
  // In-Memory Throttle: max 1 Alert pro Tenant alle 55 min
  const lastAlert = tenantAlertThrottle.get(tenantId) ?? 0;
  if (Date.now() - lastAlert < 55 * 60 * 1000) return;

  const c = sb();

  // DB-Throttle zusätzlich (überlebt Restarts): prüfe mise_frank_decisions auf no_driver_alert
  const throttleAgo = new Date(Date.now() - 55 * 60 * 1000).toISOString();
  const { data: recentAlert } = await c
    .from('mise_frank_decisions')
    .select('id')
    .eq('type', 'no_driver_alert')
    .eq('reason_text', `no_driver_alert:${tenantId}`)
    .gte('created_at', throttleAgo)
    .limit(1);
  if (recentAlert && recentAlert.length > 0) {
    tenantAlertThrottle.set(tenantId, Date.now()); // In-Memory sync
    return;
  }

  // Alle wartenden Orders des Tenants zählen
  if (!o.location_id) return;
  const { data: loc } = await c.from('locations').select('id').eq('tenant_id', tenantId).limit(20);
  const locationIds = (loc ?? []).map((l: any) => l.id as string).filter(Boolean);
  if (!locationIds.length) return;

  const { data: waitingOrders } = await c
    .from('customer_orders')
    .select('id, created_at')
    .in('location_id', locationIds)
    .eq('typ', 'lieferung')
    .eq('status', 'fertig')
    .is('mise_batch_id', null)
    .is('mise_driver_id', null);

  const orderCount = waitingOrders?.length ?? 0;
  if (orderCount === 0) return;

  // Älteste Order berechnen
  const now = Date.now();
  const oldestOrderMin = waitingOrders
    ? Math.max(...(waitingOrders as any[]).map((wo: any) => Math.floor((now - new Date(wo.created_at).getTime()) / 60000)))
    : 0;

  const message = `${orderCount} Bestellung${orderCount > 1 ? 'en' : ''} warten — kein Fahrer verfügbar! (älteste: ${oldestOrderMin} min)`;

  // Schreibe in mise_alerts (Lieferzentrale liest dies als rotes Banner)
  await c.from('mise_alerts').insert({
    tenant_id: tenantId,
    type: 'no_driver',
    message,
  });

  // Logge in frank_decisions für Cooldown-Check und Messbarkeit
  await logDecision('no_driver_alert', null, (waitingOrders ?? []).map((wo: any) => wo.id as string), `no_driver_alert:${tenantId}`, {
    reason_code: 'NO_DRIVER_ALERT',
    order_count: orderCount,
    oldest_order_min: oldestOrderMin,
    tenant_id: tenantId,
  });

  tenantAlertThrottle.set(tenantId, Date.now());
  console.log(`[frank] Eskalations-Alert für Tenant ${tenantId}: ${message}`);
}

// Betreiber-Push bei "Kein Fahrer" fuer laengere Zeit (fire-and-forget)
async function alertOwnerNoDriver(o: OrderRow): Promise<void> {
  if (!o.location_id) return;
  const c = sb();
  const { data: loc } = await c.from('locations').select('tenant_id').eq('id', o.location_id).maybeSingle();
  if (!loc?.tenant_id) return;
  // Nur pushen wenn >=2 Hold-Decisions in letzten 5 min (verhindert Spam beim ersten Tick)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recent } = await c.from('mise_frank_decisions')
    .select('id').eq('type', 'hold').contains('order_ids', [o.id]).gte('created_at', fiveMinAgo).limit(3);
  if (!recent || recent.length < 2) return;
  const { data: subs } = await c.from('owner_push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('tenant_id', loc.tenant_id);
  if (!subs || subs.length === 0) return;
  const wp = (await import('web-push').then(m => (m as any).default ?? m)) as typeof import('web-push');
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  wp.setVapidDetails(process.env.VAPID_CONTACT ?? 'mailto:ops@mise-gastro.de', pub, priv);
  const payload = JSON.stringify({
    title: 'Kein Fahrer verfuegbar',
    body: 'Bestellung #' + String(o.bestellnummer ?? '').slice(-5) + ' wartet — kein Fahrer online!',
    url: '/neo/app/lieferzentrale',
    tag: 'no-driver-' + o.id,
    urgent: true,
  });
  await Promise.allSettled((subs as any[]).map((s: any) =>
    wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } }, payload).catch(() => {})
  ));
}

async function logDecision(
  type: 'assign' | 'hold' | 'rebalance' | 'reroute' | 'bundle' | 'cancel' | 'tick_lock' | 'no_driver_alert' | 'driver_stale',
  driverId: string | null,
  orderIds: string[],
  reasonText: string,
  reasonData?: Record<string, unknown>,
): Promise<void> {
  const c = sb();
  await c.from('mise_frank_decisions').insert({
    type,
    driver_id: driverId,
    order_ids: orderIds,
    reason_text: reasonText,
    ...(reasonData !== undefined ? { reason_data: reasonData } : {}),
  });
}
