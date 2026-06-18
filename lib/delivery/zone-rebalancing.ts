/**
 * lib/delivery/zone-rebalancing.ts — Phase 237
 *
 * Smart Zone Rebalancing Engine
 *
 * Erkennt Kapazitäts-Ungleichgewichte zwischen Lieferzonen und schlägt
 * automatisch Fahrer-Umverteilungen vor (oder führt sie durch).
 *
 * Öffentliche API:
 *   analyzeZoneCapacity(locationId)              — Aktuelle Zonen-Auslastung
 *   suggestRebalancing(locationId)               — Umverteilungsvorschlag
 *   applyRebalancing(locationId, eventId)        — Vorschlag anwenden
 *   dismissRebalancing(locationId, eventId)      — Vorschlag verwerfen
 *   getRebalancingHistory(locationId, limit?)    — Verlauf
 *   getDashboard(locationId)                     — Dashboard-Daten
 *   snapshotZoneCapacityAllLocations()           — Cron: Snapshot aller Standorte
 *   rebalanceAllLocations()                      — Cron: Auto-Vorschläge
 *   pruneOldSnapshots(daysToKeep?)               — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ────────────────────────────────────────────────────────────────────

export type ZoneLoadLevel = 'low' | 'normal' | 'high' | 'overloaded';
export type RebalancingStatus = 'suggested' | 'applied' | 'dismissed';

export interface ZoneCapacityState {
  zoneName: string;
  activeDrivers: number;
  pendingOrders: number;
  activeTours: number;
  avgWaitMin: number | null;
  utilizationPct: number;
  loadLevel: ZoneLoadLevel;
}

export interface ZoneCapacitySnapshot {
  id: string;
  locationId: string;
  zoneName: string;
  snapshottedAt: string;
  activeDrivers: number;
  pendingOrders: number;
  activeTours: number;
  avgWaitMin: number | null;
  utilizationPct: number;
  loadLevel: ZoneLoadLevel;
}

export interface RebalancingEvent {
  id: string;
  locationId: string;
  triggeredAt: string;
  triggerReason: string;
  fromZone: string;
  toZone: string;
  driverIds: string[];
  driversMoved: number;
  status: RebalancingStatus;
  appliedBy: string | null;
  appliedAt: string | null;
  notes: string | null;
  snapshotBefore: ZoneCapacityState[] | null;
  snapshotAfter: ZoneCapacityState[] | null;
}

export interface RebalancingSuggestion {
  fromZone: string;
  toZone: string;
  candidateDriverIds: string[];
  driversToMove: number;
  reason: string;
}

export interface ZoneRebalancingDashboard {
  currentLoad: ZoneCapacityState[];
  pendingEvents: RebalancingEvent[];
  recentHistory: RebalancingEvent[];
  summary: {
    totalSuggested: number;
    totalApplied: number;
    totalDismissed: number;
    overloadedZones: number;
    lowLoadZones: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadLevel(utilizationPct: number): ZoneLoadLevel {
  if (utilizationPct < 30) return 'low';
  if (utilizationPct < 70) return 'normal';
  if (utilizationPct < 100) return 'high';
  return 'overloaded';
}

function mapEvent(r: Record<string, unknown>): RebalancingEvent {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    triggeredAt: r.triggered_at as string,
    triggerReason: r.trigger_reason as string,
    fromZone: r.from_zone as string,
    toZone: r.to_zone as string,
    driverIds: (r.driver_ids as string[]) ?? [],
    driversMoved: (r.drivers_moved as number) ?? 0,
    status: r.status as RebalancingStatus,
    appliedBy: (r.applied_by as string | null) ?? null,
    appliedAt: (r.applied_at as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    snapshotBefore: (r.snapshot_before as ZoneCapacityState[] | null) ?? null,
    snapshotAfter: (r.snapshot_after as ZoneCapacityState[] | null) ?? null,
  };
}

// ── analyzeZoneCapacity ───────────────────────────────────────────────────────

export async function analyzeZoneCapacity(locationId: string): Promise<ZoneCapacityState[]> {
  const supabase = createServiceClient();

  // Active drivers: fetch drivers with their last known zone (from gps_trails or mise_drivers)
  const [driversRes, ordersRes, toursRes] = await Promise.all([
    supabase
      .from('mise_drivers')
      .select('id, current_zone')
      .eq('location_id', locationId)
      .eq('active', true),
    supabase
      .from('customer_orders')
      .select('id, delivery_zone, created_at, status')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'bereit'])
      .gte('created_at', new Date(Date.now() - 2 * 3600_000).toISOString()),
    supabase
      .from('delivery_batches')
      .select('id, zone, status, started_at')
      .eq('location_id', locationId)
      .in('status', ['dispatched', 'en_route']),
  ]);

  const zones = ['A', 'B', 'C', 'D'] as const;
  const stateMap: Record<string, ZoneCapacityState> = {};

  for (const z of zones) {
    stateMap[z] = {
      zoneName: z,
      activeDrivers: 0,
      pendingOrders: 0,
      activeTours: 0,
      avgWaitMin: null,
      utilizationPct: 0,
      loadLevel: 'low',
    };
  }

  // Count drivers per zone
  for (const d of (driversRes.data ?? []) as Array<{ id: string; current_zone: string | null }>) {
    const z = d.current_zone ?? 'A';
    if (stateMap[z]) stateMap[z].activeDrivers++;
  }

  // Count pending orders per zone
  const waitTimes: Record<string, number[]> = { A: [], B: [], C: [], D: [] };
  for (const o of (ordersRes.data ?? []) as Array<{ id: string; delivery_zone: string | null; created_at: string; status: string }>) {
    const z = o.delivery_zone ?? 'A';
    if (stateMap[z]) {
      stateMap[z].pendingOrders++;
      const waitMin = (Date.now() - new Date(o.created_at).getTime()) / 60_000;
      waitTimes[z]?.push(waitMin);
    }
  }

  // Count active tours per zone
  for (const t of (toursRes.data ?? []) as Array<{ id: string; zone: string | null; status: string; started_at: string | null }>) {
    const z = t.zone ?? 'A';
    if (stateMap[z]) stateMap[z].activeTours++;
  }

  // Compute utilization + avg wait
  for (const z of zones) {
    const st = stateMap[z];
    const wtArr = waitTimes[z] ?? [];
    st.avgWaitMin = wtArr.length > 0 ? wtArr.reduce((s, v) => s + v, 0) / wtArr.length : null;

    // Utilization: pending orders relative to driver capacity (each driver handles ~3 stops)
    const capacity = Math.max(1, st.activeDrivers) * 3;
    st.utilizationPct = Math.min(200, Math.round((st.pendingOrders / capacity) * 100));
    st.loadLevel = loadLevel(st.utilizationPct);
  }

  return Object.values(stateMap);
}

// ── suggestRebalancing ────────────────────────────────────────────────────────

export async function suggestRebalancing(locationId: string): Promise<RebalancingSuggestion | null> {
  const supabase = createServiceClient();
  const zoneStates = await analyzeZoneCapacity(locationId);

  const overloaded = zoneStates.filter((z) => z.loadLevel === 'overloaded' || z.loadLevel === 'high');
  const low = zoneStates.filter((z) => z.loadLevel === 'low' && z.activeDrivers > 0);

  if (overloaded.length === 0 || low.length === 0) return null;

  // Find most overloaded and most idle zones
  const worstZone = overloaded.sort((a, b) => b.utilizationPct - a.utilizationPct)[0];
  const idleZone = low.sort((a, b) => b.activeDrivers - a.activeDrivers)[0];

  if (!worstZone || !idleZone) return null;

  // Find eligible drivers in the idle zone (online, not on active tour)
  const activeDriverIds = new Set<string>();
  const { data: activeTourDrivers } = await supabase
    .from('delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .in('status', ['dispatched', 'en_route']);
  for (const t of (activeTourDrivers ?? []) as Array<{ driver_id: string | null }>) {
    if (t.driver_id) activeDriverIds.add(t.driver_id);
  }

  const { data: idleDrivers } = await supabase
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('active', true)
    .eq('current_zone', idleZone.zoneName);

  const candidates = ((idleDrivers ?? []) as Array<{ id: string }>)
    .filter((d) => !activeDriverIds.has(d.id))
    .map((d) => d.id);

  if (candidates.length === 0) return null;

  // Move at most half of idle drivers (min 1)
  const toMove = Math.min(candidates.length, Math.max(1, Math.floor(candidates.length / 2)));

  return {
    fromZone: idleZone.zoneName,
    toZone: worstZone.zoneName,
    candidateDriverIds: candidates.slice(0, toMove),
    driversToMove: toMove,
    reason: `Zone ${worstZone.zoneName} überbelastet (${worstZone.utilizationPct}%), Zone ${idleZone.zoneName} hat ${idleZone.activeDrivers} verfügbare Fahrer`,
  };
}

// ── createRebalancingEvent ────────────────────────────────────────────────────

export async function createRebalancingEvent(
  locationId: string,
  suggestion: RebalancingSuggestion,
  currentLoad: ZoneCapacityState[],
): Promise<RebalancingEvent> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('zone_rebalancing_events')
    .insert({
      location_id: locationId,
      trigger_reason: `overload_zone_${suggestion.toZone}`,
      from_zone: suggestion.fromZone,
      to_zone: suggestion.toZone,
      driver_ids: suggestion.candidateDriverIds,
      drivers_moved: suggestion.driversToMove,
      status: 'suggested',
      snapshot_before: currentLoad,
    })
    .select()
    .single();

  if (error) throw new Error(`createRebalancingEvent: ${error.message}`);
  return mapEvent(data as Record<string, unknown>);
}

// ── applyRebalancing ──────────────────────────────────────────────────────────

export async function applyRebalancing(
  locationId: string,
  eventId: string,
  appliedByUserId: string,
  notes?: string,
): Promise<RebalancingEvent> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('zone_rebalancing_events')
    .select('*')
    .eq('id', eventId)
    .eq('location_id', locationId)
    .single();

  if (!existing) throw new Error('Rebalancing event not found');
  const ev = mapEvent(existing as Record<string, unknown>);
  if (ev.status !== 'suggested') throw new Error('Event is not in suggested state');

  // Update driver zones
  if (ev.driverIds.length > 0) {
    await supabase
      .from('mise_drivers')
      .update({ current_zone: ev.toZone })
      .in('id', ev.driverIds)
      .eq('location_id', locationId);
  }

  // Snapshot after state
  const afterLoad = await analyzeZoneCapacity(locationId);

  const { data, error } = await supabase
    .from('zone_rebalancing_events')
    .update({
      status: 'applied',
      applied_by: appliedByUserId,
      applied_at: new Date().toISOString(),
      notes: notes ?? null,
      snapshot_after: afterLoad,
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw new Error(`applyRebalancing: ${error.message}`);
  return mapEvent(data as Record<string, unknown>);
}

// ── dismissRebalancing ────────────────────────────────────────────────────────

export async function dismissRebalancing(
  locationId: string,
  eventId: string,
  notes?: string,
): Promise<{ ok: boolean }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('zone_rebalancing_events')
    .update({ status: 'dismissed', notes: notes ?? null })
    .eq('id', eventId)
    .eq('location_id', locationId)
    .eq('status', 'suggested');

  if (error) throw new Error(`dismissRebalancing: ${error.message}`);
  return { ok: true };
}

// ── getRebalancingHistory ─────────────────────────────────────────────────────

export async function getRebalancingHistory(
  locationId: string,
  limit = 30,
): Promise<RebalancingEvent[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('zone_rebalancing_events')
    .select('*')
    .eq('location_id', locationId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRebalancingHistory: ${error.message}`);
  return (data ?? []).map((r) => mapEvent(r as Record<string, unknown>));
}

// ── getDashboard ──────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<ZoneRebalancingDashboard> {
  const supabase = createServiceClient();

  const [currentLoad, eventsRes] = await Promise.all([
    analyzeZoneCapacity(locationId),
    supabase
      .from('zone_rebalancing_events')
      .select('*')
      .eq('location_id', locationId)
      .order('triggered_at', { ascending: false })
      .limit(50),
  ]);

  const allEvents = (eventsRes.data ?? []).map((r) => mapEvent(r as Record<string, unknown>));
  const pendingEvents = allEvents.filter((e) => e.status === 'suggested');
  const recentHistory = allEvents.filter((e) => e.status !== 'suggested').slice(0, 20);

  return {
    currentLoad,
    pendingEvents,
    recentHistory,
    summary: {
      totalSuggested: allEvents.filter((e) => e.status === 'suggested').length,
      totalApplied: allEvents.filter((e) => e.status === 'applied').length,
      totalDismissed: allEvents.filter((e) => e.status === 'dismissed').length,
      overloadedZones: currentLoad.filter((z) => z.loadLevel === 'overloaded').length,
      lowLoadZones: currentLoad.filter((z) => z.loadLevel === 'low').length,
    },
  };
}

// ── snapshotZoneCapacityAllLocations ──────────────────────────────────────────

export async function snapshotZoneCapacityAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const supabase = createServiceClient();
  const { data: locations } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (!locations || locations.length === 0) return { locations: 0, snapshots: 0, errors: 0 };

  let snapshots = 0;
  let errors = 0;

  await Promise.all(
    (locations as Array<{ id: string }>).map(async ({ id }) => {
      try {
        const zoneStates = await analyzeZoneCapacity(id);
        const now = new Date().toISOString();

        const rows = zoneStates.map((z) => ({
          location_id: id,
          zone_name: z.zoneName,
          snapshotted_at: now,
          active_drivers: z.activeDrivers,
          pending_orders: z.pendingOrders,
          active_tours: z.activeTours,
          avg_wait_min: z.avgWaitMin,
          utilization_pct: z.utilizationPct,
          load_level: z.loadLevel,
        }));

        const { error } = await supabase
          .from('zone_capacity_snapshots')
          .insert(rows);

        if (error) {
          errors++;
        } else {
          snapshots += rows.length;
        }
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locations.length, snapshots, errors };
}

// ── rebalanceAllLocations ─────────────────────────────────────────────────────

export async function rebalanceAllLocations(): Promise<{
  locations: number;
  suggested: number;
  errors: number;
}> {
  const supabase = createServiceClient();
  const { data: locations } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (!locations || locations.length === 0) return { locations: 0, suggested: 0, errors: 0 };

  let suggested = 0;
  let errors = 0;

  await Promise.all(
    (locations as Array<{ id: string }>).map(async ({ id }) => {
      try {
        // Don't create new suggestions if there are already pending ones
        const { data: pending } = await supabase
          .from('zone_rebalancing_events')
          .select('id')
          .eq('location_id', id)
          .eq('status', 'suggested')
          .limit(1);

        if (pending && pending.length > 0) return;

        const suggestion = await suggestRebalancing(id);
        if (!suggestion) return;

        const currentLoad = await analyzeZoneCapacity(id);
        await createRebalancingEvent(id, suggestion, currentLoad);
        suggested++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locations.length, suggested, errors };
}

// ── pruneOldSnapshots ─────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 30): Promise<{ pruned: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('prune_old_zone_snapshots', {
    days_to_keep: daysToKeep,
  });
  if (error) throw new Error(`pruneOldSnapshots: ${error.message}`);
  return { pruned: (data as number) ?? 0 };
}
