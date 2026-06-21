/**
 * lib/delivery/driver-capacity-signal.ts — Phase 381
 *
 * Driver Capacity Signal Engine
 *
 * Berechnet und persistiert den aktuellen Kapazitäts-Status je Standort.
 * Schreibt in `driver_capacity_snapshots` (Supabase Realtime-fähig).
 * Das Frontend kann via postgres_changes statt 60s-Polling subscriben.
 *
 * Public API:
 *  snapshotCapacity(locationId)           — Snapshot berechnen + upserten
 *  snapshotCapacityAllLocations()         — Cron-Batch aller aktiven Standorte
 *  getCapacitySnapshot(locationId)        — aktuellen Snapshot lesen
 *  getCapacityTrend(locationId, hours?)   — stündliche Trendhistorie
 *  pruneCapacityEvents(daysToKeep?)       — Cleanup via RPC
 *
 * Kapazitäts-Status-Logik:
 *  free       — online_drivers > 0, pending_orders = 0, load_pct < 20
 *  normal     — load_pct < 60
 *  busy       — load_pct < 85
 *  overloaded — load_pct >= 85 oder pending_orders > online_drivers × 3
 *  unknown    — keine Fahrer online (kein Dienst aktiv)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CapacityStatus = 'free' | 'normal' | 'busy' | 'overloaded' | 'unknown';

export interface CapacitySnapshot {
  locationId:       string;
  onlineDrivers:    number;
  totalDrivers:     number;
  busyDrivers:      number;
  pendingOrders:    number;
  activeBatches:    number;
  loadPct:          number | null;
  ordersPerDriver:  number | null;
  capacityStatus:   CapacityStatus;
  snapshotAt:       string;
}

export interface CapacityTrendPoint {
  eventDate:       string;
  eventHour:       number;
  avgOnlineDrivers: number | null;
  avgPendingOrders: number | null;
  avgLoadPct:      number | null;
  dominantStatus:  string | null;
  sampleCount:     number;
}

export interface SnapshotResult {
  locationId:     string;
  capacityStatus: CapacityStatus;
  onlineDrivers:  number;
  pendingOrders:  number;
  saved:          boolean;
}

export interface AllLocationsResult {
  locations: number;
  saved:     number;
  errors:    number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVE_BATCH_STATUSES = ['assigned', 'on_route', 'en_route', 'unterwegs', 'active'] as const;
const PENDING_ORDER_STATUSES = ['pending', 'confirmed', 'in_zubereitung'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyCapacity(
  onlineDrivers:  number,
  busyDrivers:    number,
  pendingOrders:  number,
  activeBatches:  number,
): { status: CapacityStatus; loadPct: number | null; ordersPerDriver: number | null } {
  if (onlineDrivers === 0) {
    return { status: 'unknown', loadPct: null, ordersPerDriver: null };
  }

  const loadPct        = Math.round((busyDrivers / onlineDrivers) * 100 * 100) / 100;
  const ordersPerDriver = Math.round((pendingOrders / onlineDrivers) * 100) / 100;

  let status: CapacityStatus;
  if (loadPct >= 85 || pendingOrders > onlineDrivers * 3) {
    status = 'overloaded';
  } else if (loadPct >= 60) {
    status = 'busy';
  } else if (pendingOrders === 0 && loadPct < 20) {
    status = 'free';
  } else {
    status = 'normal';
  }

  return { status, loadPct, ordersPerDriver };
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Berechnet den aktuellen Kapazitäts-Status für einen Standort und
 * persistiert ihn in driver_capacity_snapshots (upsert via location_id).
 */
export async function snapshotCapacity(locationId: string): Promise<SnapshotResult> {
  const sb = createServiceClient();

  // Fahrer: online = in aktiver Schicht ohne Ende
  const { data: driverRows } = await sb
    .from('mise_drivers')
    .select('id, is_available')
    .eq('location_id', locationId);

  const totalDrivers  = driverRows?.length ?? 0;
  const onlineDrivers = driverRows?.filter((d) => d.is_available === true).length ?? 0;

  // Aktive Batches (Fahrer unterwegs)
  const { count: activeBatches } = await sb
    .from('mise_delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ACTIVE_BATCH_STATUSES as unknown as string[]);

  const busyDrivers = Math.min(activeBatches ?? 0, onlineDrivers);

  // Offene Bestellungen (noch nicht verteilt)
  const { count: pendingOrders } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .in('status', PENDING_ORDER_STATUSES as unknown as string[])
    .is('batch_id', null);

  const { status, loadPct, ordersPerDriver } = classifyCapacity(
    onlineDrivers,
    busyDrivers,
    pendingOrders ?? 0,
    activeBatches ?? 0,
  );

  const nowUtc = new Date().toISOString();

  // Upsert Snapshot
  const { error: upsertErr } = await sb
    .from('driver_capacity_snapshots')
    .upsert(
      {
        location_id:      locationId,
        online_drivers:   onlineDrivers,
        total_drivers:    totalDrivers,
        busy_drivers:     busyDrivers,
        pending_orders:   pendingOrders ?? 0,
        active_batches:   activeBatches ?? 0,
        load_pct:         loadPct,
        orders_per_driver: ordersPerDriver,
        capacity_status:  status,
        snapshot_at:      nowUtc,
      },
      { onConflict: 'location_id' },
    );

  if (upsertErr) {
    console.error('[capacity-signal] upsert error', locationId, upsertErr.message);
    return { locationId, capacityStatus: status, onlineDrivers, pendingOrders: pendingOrders ?? 0, saved: false };
  }

  // Event-Log für Trendhistorie (einmal pro Stunde, per hour-boundary)
  const nowDate  = new Date();
  const eventHour = nowDate.getUTCHours();
  const eventDate = nowDate.toISOString().slice(0, 10);

  await sb.from('driver_capacity_events').insert({
    location_id:     locationId,
    online_drivers:  onlineDrivers,
    pending_orders:  pendingOrders ?? 0,
    active_batches:  activeBatches ?? 0,
    load_pct:        loadPct,
    capacity_status: status,
    event_hour:      eventHour,
    event_date:      eventDate,
  });

  return { locationId, capacityStatus: status, onlineDrivers, pendingOrders: pendingOrders ?? 0, saved: true };
}

/**
 * Cron-Batch: Snapshot für alle aktiven Standorte.
 */
export async function snapshotCapacityAllLocations(): Promise<AllLocationsResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locations?.length) return { locations: 0, saved: 0, errors: 0 };

  let saved  = 0;
  let errors = 0;

  await Promise.allSettled(
    locations.map(async (loc) => {
      try {
        const result = await snapshotCapacity(loc.id);
        if (result.saved) saved++;
        else errors++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locations.length, saved, errors };
}

/**
 * Liest den aktuellen Snapshot für einen Standort.
 */
export async function getCapacitySnapshot(locationId: string): Promise<CapacitySnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_capacity_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;

  return {
    locationId:      data.location_id as string,
    onlineDrivers:   data.online_drivers as number,
    totalDrivers:    data.total_drivers as number,
    busyDrivers:     data.busy_drivers as number,
    pendingOrders:   data.pending_orders as number,
    activeBatches:   data.active_batches as number,
    loadPct:         data.load_pct as number | null,
    ordersPerDriver: data.orders_per_driver as number | null,
    capacityStatus:  data.capacity_status as CapacityStatus,
    snapshotAt:      data.snapshot_at as string,
  };
}

/**
 * Stündliche Trendhistorie für einen Standort (letzte N Stunden).
 * Nutzt die View v_capacity_trend_48h für schnelle Aggregation.
 */
export async function getCapacityTrend(
  locationId: string,
  hours = 24,
): Promise<CapacityTrendPoint[]> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data } = await sb
    .from('driver_capacity_events')
    .select('event_date, event_hour, online_drivers, pending_orders, load_pct, capacity_status')
    .eq('location_id', locationId)
    .gte('recorded_at', since)
    .order('event_date', { ascending: true })
    .order('event_hour', { ascending: true });

  if (!data?.length) return [];

  // Aggregiere pro Stunde (Durchschnittswerte)
  const byHour = new Map<string, {
    onlineSum: number; pendingSum: number; loadSum: number;
    count: number; statuses: string[];
  }>();

  for (const row of data) {
    const key = `${row.event_date}T${String(row.event_hour).padStart(2, '0')}`;
    const existing = byHour.get(key) ?? { onlineSum: 0, pendingSum: 0, loadSum: 0, count: 0, statuses: [] };
    existing.onlineSum  += row.online_drivers ?? 0;
    existing.pendingSum += row.pending_orders ?? 0;
    if (row.load_pct != null) existing.loadSum += row.load_pct;
    existing.count++;
    if (row.capacity_status) existing.statuses.push(row.capacity_status as string);
    byHour.set(key, existing);
  }

  return Array.from(byHour.entries()).map(([key, v]) => {
    const [datePart, hourStr] = key.split('T');
    const statusCounts = v.statuses.reduce<Record<string, number>>((acc, s) => {
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    const dominantStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      eventDate:        datePart ?? '',
      eventHour:        parseInt(hourStr ?? '0', 10),
      avgOnlineDrivers: v.count > 0 ? Math.round((v.onlineSum / v.count) * 10) / 10 : null,
      avgPendingOrders: v.count > 0 ? Math.round((v.pendingSum / v.count) * 10) / 10 : null,
      avgLoadPct:       v.count > 0 ? Math.round((v.loadSum / v.count) * 100) / 100 : null,
      dominantStatus,
      sampleCount:      v.count,
    };
  });
}

/**
 * Cleanup alter Ereignisse.
 */
export async function pruneCapacityEvents(daysToKeep = 14): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_driver_capacity_events', { days_to_keep: daysToKeep });
  return { pruned: (data as number) ?? 0 };
}
