/**
 * lib/delivery/zone-capacity-balancer.ts
 *
 * Phase 307 — Zone Capacity Balancer
 *
 * Erkennt Kapazitäts-Ungleichgewichte zwischen Zonen (zu viele Bestellungen,
 * zu wenig Fahrer) und generiert Rebalancing-Empfehlungen.
 *
 * Kern-Logik:
 *  1. snapZoneCapacity(locationId)     — Snapshot aller Zonen (Demand vs Driver)
 *  2. generateRebalancingSuggestions() — Empfehlungen bei Ungleichgewicht
 *  3. runBalancerAllLocations()        — Cron-Batch
 *  4. getBalancerDashboard()           — Admin-Dashboard
 *  5. resolveRebalancingSuggestion()   — Empfehlung annehmen/verwerfen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Schwellwerte ───────────────────────────────────────────────────────────────

/** Maximale Bestellungen pro freiem Fahrer bevor Imbalance gilt */
const ORDERS_PER_DRIVER_HIGH  = 3;
const ORDERS_PER_DRIVER_CRIT  = 6;

/** Mindest-Anzahl pending/active Bestellungen in Zone um Alarm auszulösen */
const MIN_ORDERS_FOR_ALARM = 2;

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ZoneCapacitySnap {
  zone: string;
  pending_orders: number;
  active_orders:  number;
  idle_drivers:   number;
  busy_drivers:   number;
  capacity_score: number;
  demand_score:   number;
  imbalance_flag: boolean;
}

export interface RebalancingSuggestion {
  id:          string;
  from_zone:   string | null;
  to_zone:     string;
  driver_id:   string | null;
  driver_name: string | null;
  reason:      string;
  urgency:     'normal' | 'high' | 'critical';
  status:      'pending' | 'accepted' | 'dismissed' | 'auto_applied';
  suggested_at: string;
}

export interface ZoneBalancerDashboard {
  locationId:          string;
  snappedAt:           string;
  zones:               ZoneCapacitySnap[];
  pendingSuggestions:  RebalancingSuggestion[];
  recentResolved:      RebalancingSuggestion[];
  summary: {
    totalZones:        number;
    imbalancedZones:   number;
    idleDrivers:       number;
    urgentSuggestions: number;
  };
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

/** Normiert Kapazitäts-Score: 100 = ideal (1 Fahrer pro 2 Bestellungen), <50 = überlastet */
function computeCapacityScore(idleDrivers: number, totalOrders: number): number {
  if (totalOrders === 0) return 100;
  if (idleDrivers === 0) return 0;
  const ratio = idleDrivers / totalOrders;
  return Math.min(100, Math.round(ratio * 50 * 100) / 100);
}

/** Demand-Score 0–100: Wie hoch ist der Lieferdruck in dieser Zone */
function computeDemandScore(orders: number, maxOrdersInAnyZone: number): number {
  if (maxOrdersInAnyZone === 0) return 0;
  return Math.round((orders / maxOrdersInAnyZone) * 100);
}

// ── 1. Snapshot: Zonen-Kapazität ───────────────────────────────────────────────

export async function snapZoneCapacity(
  locationId: string,
): Promise<ZoneCapacitySnap[]> {
  const sb = createServiceClient();

  // Offene Lieferbestellungen mit Zonen-Zuweisung
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, lieferzone')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
    .not('lieferzone', 'is', null);

  // Aktive Fahrer mit aktuellem Zone-Hint (aus Batch-Stops)
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, name, status, current_batch_id')
    .eq('location_id', locationId)
    .eq('active', true)
    .in('status', ['idle', 'online', 'on_delivery', 'returning']);

  const zones = new Set<string>(['A', 'B', 'C', 'D']);
  const byZone: Record<string, { pending: number; active: number }> = {};
  for (const z of zones) byZone[z] = { pending: 0, active: 0 };

  for (const o of orders ?? []) {
    const z = String(o.lieferzone ?? 'A').toUpperCase();
    if (!byZone[z]) byZone[z] = { pending: 0, active: 0 };
    if (o.status === 'unterwegs') byZone[z].active++;
    else byZone[z].pending++;
  }

  // Fahrer nach Zone (vereinfacht: idle Fahrer haben keine Zone → gleichmäßig verteilen)
  const idleDrivers   = (drivers ?? []).filter((d) => d.status === 'idle' || d.status === 'online');
  const busyDrivers   = (drivers ?? []).filter((d) => d.status !== 'idle' && d.status !== 'online');
  const idlePerZone: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const busyPerZone:  Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

  // Busy Fahrer: weise Zone aus aktiver Batch zu (approximiert durch pending-Verteilung)
  // Idle Fahrer haben keine feste Zone — verteile gleichmäßig für Score-Berechnung
  const idleCount = idleDrivers.length;
  const zonesArr  = ['A', 'B', 'C', 'D'];
  zonesArr.forEach((z, i) => {
    idlePerZone[z] = Math.floor(idleCount / 4) + (i < (idleCount % 4) ? 1 : 0);
  });
  busyPerZone.A = Math.round(busyDrivers.length * 0.4);
  busyPerZone.B = Math.round(busyDrivers.length * 0.3);
  busyPerZone.C = Math.round(busyDrivers.length * 0.2);
  busyPerZone.D = busyDrivers.length - busyPerZone.A - busyPerZone.B - busyPerZone.C;

  const maxOrders = Math.max(...zonesArr.map((z) => (byZone[z]?.pending ?? 0) + (byZone[z]?.active ?? 0)), 1);

  const snaps: ZoneCapacitySnap[] = [];
  for (const z of zonesArr) {
    const pending  = byZone[z]?.pending ?? 0;
    const active   = byZone[z]?.active  ?? 0;
    const idle     = idlePerZone[z] ?? 0;
    const busy     = busyPerZone[z] ?? 0;
    const total    = pending + active;
    const cap      = computeCapacityScore(idle, total);
    const demand   = computeDemandScore(total, maxOrders);
    const imbFlag  = total >= MIN_ORDERS_FOR_ALARM && cap < 33;
    snaps.push({
      zone:           z,
      pending_orders: pending,
      active_orders:  active,
      idle_drivers:   idle,
      busy_drivers:   busy,
      capacity_score: cap,
      demand_score:   demand,
      imbalance_flag: imbFlag,
    });
  }

  // Snapshots in DB persistieren (fire-and-forget, kein await blocking)
  const rows = snaps.map((s) => ({
    location_id:    locationId,
    zone:           s.zone,
    pending_orders: s.pending_orders,
    active_orders:  s.active_orders,
    idle_drivers:   s.idle_drivers,
    busy_drivers:   s.busy_drivers,
    capacity_score: s.capacity_score,
    demand_score:   s.demand_score,
    imbalance_flag: s.imbalance_flag,
  }));
  sb.from('zone_capacity_snapshots').insert(rows).then(() => {}).catch(() => {});

  return snaps;
}

// ── 2. Rebalancing-Empfehlungen generieren ─────────────────────────────────────

export async function generateRebalancingSuggestions(
  locationId: string,
  snaps: ZoneCapacitySnap[],
): Promise<number> {
  const sb = createServiceClient();

  const imbalanced = snaps.filter((s) => s.imbalance_flag);
  if (imbalanced.length === 0) return 0;

  // Verfügbare idle Fahrer laden
  const { data: idleDrivers } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle_type')
    .eq('location_id', locationId)
    .eq('active', true)
    .in('status', ['idle', 'online'])
    .limit(10);

  if (!idleDrivers || idleDrivers.length === 0) return 0;

  // Überschuss-Zonen: wo sind mehr Fahrer als Bedarf?
  const surplusZones = snaps
    .filter((s) => s.idle_drivers > 0 && s.pending_orders === 0 && s.active_orders === 0)
    .sort((a, b) => b.idle_drivers - a.idle_drivers);

  let created = 0;
  let driverIdx = 0;

  for (const zone of imbalanced) {
    const totalOrders = zone.pending_orders + zone.active_orders;
    const ratio = zone.idle_drivers > 0 ? totalOrders / zone.idle_drivers : totalOrders;
    const urgency: 'normal' | 'high' | 'critical' =
      ratio >= ORDERS_PER_DRIVER_CRIT ? 'critical' :
      ratio >= ORDERS_PER_DRIVER_HIGH ? 'high'     : 'normal';

    const fromZone = surplusZones[0]?.zone ?? null;
    const driver   = idleDrivers[driverIdx % idleDrivers.length];
    driverIdx++;

    const reason = `Zone ${zone.zone}: ${totalOrders} Bestellungen, ${zone.idle_drivers} freie Fahrer (${ratio.toFixed(1)}× Druck)`;

    // Prüfe ob bereits eine offene Empfehlung für diese Zone existiert
    const { count } = await sb
      .from('zone_rebalancing_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('to_zone', zone.zone)
      .eq('status', 'pending');

    if ((count ?? 0) > 0) continue;

    await sb.from('zone_rebalancing_suggestions').insert({
      location_id: locationId,
      from_zone:   fromZone,
      to_zone:     zone.zone,
      driver_id:   driver?.id ?? null,
      driver_name: driver?.name ?? null,
      reason,
      urgency,
      status:      'pending',
    });
    created++;
  }

  return created;
}

// ── 3. Cron-Batch ──────────────────────────────────────────────────────────────

export async function runBalancerAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  suggestions: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let snapshots    = 0;
  let suggestions  = 0;
  let errors       = 0;

  await Promise.allSettled(
    (locs ?? []).map(async (loc) => {
      try {
        const snaps = await snapZoneCapacity(loc.id as string);
        snapshots += snaps.length;
        const sug = await generateRebalancingSuggestions(loc.id as string, snaps);
        suggestions += sug;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, snapshots, suggestions, errors };
}

// ── 4. Admin-Dashboard ─────────────────────────────────────────────────────────

export async function getBalancerDashboard(locationId: string): Promise<ZoneBalancerDashboard> {
  const sb = createServiceClient();

  const [snaps, pending, resolved] = await Promise.all([
    snapZoneCapacity(locationId),
    sb
      .from('zone_rebalancing_suggestions')
      .select('id, from_zone, to_zone, driver_id, driver_name, reason, urgency, status, suggested_at')
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('suggested_at', { ascending: false })
      .limit(20),
    sb
      .from('zone_rebalancing_suggestions')
      .select('id, from_zone, to_zone, driver_id, driver_name, reason, urgency, status, suggested_at')
      .eq('location_id', locationId)
      .in('status', ['accepted', 'dismissed', 'auto_applied'])
      .order('suggested_at', { ascending: false })
      .limit(10),
  ]);

  const pendingSugs  = (pending.data ?? []) as RebalancingSuggestion[];
  const resolvedSugs = (resolved.data ?? []) as RebalancingSuggestion[];

  return {
    locationId,
    snappedAt: new Date().toISOString(),
    zones: snaps,
    pendingSuggestions: pendingSugs,
    recentResolved: resolvedSugs,
    summary: {
      totalZones:        snaps.length,
      imbalancedZones:   snaps.filter((s) => s.imbalance_flag).length,
      idleDrivers:       snaps.reduce((sum, s) => sum + s.idle_drivers, 0),
      urgentSuggestions: pendingSugs.filter((s) => s.urgency === 'critical' || s.urgency === 'high').length,
    },
  };
}

// ── 5. Empfehlung auflösen ─────────────────────────────────────────────────────

export async function resolveRebalancingSuggestion(
  suggestionId: string,
  locationId: string,
  action: 'accept' | 'dismiss',
): Promise<boolean> {
  const sb = createServiceClient();
  const status = action === 'accept' ? 'accepted' : 'dismissed';
  const { error } = await sb
    .from('zone_rebalancing_suggestions')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('location_id', locationId);
  return !error;
}

// ── 6. Prune alte Snapshots ────────────────────────────────────────────────────

export async function pruneZoneCapacitySnapshots(daysOld = 7): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { error } = await sb.rpc('prune_zone_capacity_snapshots', { days_old: daysOld });
  return { pruned: error ? 0 : 1 };
}
