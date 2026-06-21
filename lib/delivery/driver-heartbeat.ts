/**
 * lib/delivery/driver-heartbeat.ts — Phase 394
 *
 * Driver App Heartbeat + Connectivity Monitor
 *
 * Tracks per-minute pings from driver devices, detects silent disconnects
 * (app crash / signal loss), and alerts dispatch when an on-tour driver goes dark.
 *
 * Public API:
 *   recordHeartbeat(params)                 — record one ping from driver app
 *   detectLostConnections(locationId)       — find drivers silent > 5 min, raise events
 *   detectLostConnectionsAllLocations()     — cron batch
 *   resolveReconnection(driverId, locationId) — mark disconnect resolved
 *   getConnectivityDashboard(locationId)    — admin overview
 *   getDriverHeartbeatHistory(driverId, hours) — raw timeline
 *   pruneOldHeartbeats(daysToKeep?)         — cleanup via RPC
 *   pruneOldConnectivityEvents(daysToKeep?) — cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordHeartbeatParams {
  driverId: string;
  locationId: string;
  batteryPct?: number | null;
  appVersion?: string | null;
  lat?: number | null;
  lng?: number | null;
  signalQuality?: number | null;
}

export type ConnectivityStatus = 'connected' | 'degraded' | 'offline' | 'unknown';

export interface DriverConnectivityState {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  isOnline: boolean;
  lastHeartbeatAt: string | null;
  minutesSinceHeartbeat: number | null;
  batteryPct: number | null;
  connectivityStatus: ConnectivityStatus;
  hasActiveTour: boolean;
}

export interface ConnectivityEvent {
  id: string;
  driverId: string;
  driverName: string | null;
  locationId: string;
  eventType: 'disconnect' | 'reconnect';
  detectedAt: string;
  gapMinutes: number | null;
  hadActiveTour: boolean;
  resolvedAt: string | null;
}

export interface ConnectivityDashboard {
  summary: {
    totalOnline: number;
    connected: number;
    degraded: number;
    offline: number;
    unknown: number;
    criticalDisconnects: number;   // offline + had active tour
  };
  drivers: DriverConnectivityState[];
  recentEvents: ConnectivityEvent[];
  computedAt: string;
}

export interface HeartbeatRow {
  id: string;
  recordedAt: string;
  batteryPct: number | null;
  lat: number | null;
  lng: number | null;
  signalQuality: number | null;
  appVersion: string | null;
}

export interface DetectResult {
  locationId: string;
  disconnectsDetected: number;
  reconnectsResolved: number;
}

export interface BatchDetectResult {
  locations: number;
  disconnects: number;
  reconnects: number;
  errors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISCONNECT_THRESHOLD_MIN = 5;   // no heartbeat for 5+ min = disconnect
const DEGRADED_THRESHOLD_MIN   = 2;   // 2–5 min = degraded

function minutesSince(isoTs: string): number {
  return (Date.now() - new Date(isoTs).getTime()) / 60_000;
}

function toStatus(minSince: number | null): ConnectivityStatus {
  if (minSince === null) return 'unknown';
  if (minSince < DEGRADED_THRESHOLD_MIN) return 'connected';
  if (minSince < DISCONNECT_THRESHOLD_MIN) return 'degraded';
  return 'offline';
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function recordHeartbeat(params: RecordHeartbeatParams): Promise<void> {
  const sb = createServiceClient();

  // Verify driver belongs to this location
  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('id', params.driverId)
    .eq('location_id', params.locationId)
    .eq('active', true)
    .maybeSingle();

  if (!driver) return;

  await sb.from('driver_app_heartbeats').insert({
    driver_id:      params.driverId,
    location_id:    params.locationId,
    battery_pct:    params.batteryPct ?? null,
    app_version:    params.appVersion ?? null,
    lat:            params.lat ?? null,
    lng:            params.lng ?? null,
    signal_quality: params.signalQuality ?? null,
  });

  // Resolve any open disconnect event for this driver
  await resolveReconnection(params.driverId, params.locationId);
}

export async function resolveReconnection(driverId: string, locationId: string): Promise<void> {
  const sb = createServiceClient();

  const { data: openEvent } = await sb
    .from('driver_connectivity_events')
    .select('id')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('event_type', 'disconnect')
    .is('resolved_at', null)
    .maybeSingle();

  if (!openEvent) return;

  // Mark disconnect resolved + insert reconnect event
  await Promise.all([
    sb
      .from('driver_connectivity_events')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', openEvent.id),
    sb.from('driver_connectivity_events').insert({
      driver_id:      driverId,
      location_id:    locationId,
      event_type:     'reconnect',
      had_active_tour: false,    // conservative default
    }),
  ]);
}

export async function detectLostConnections(locationId: string): Promise<DetectResult> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - DISCONNECT_THRESHOLD_MIN * 60_000).toISOString();

  // All online (is_online=true) drivers for this location
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('active', true)
    .eq('is_online', true);

  if (!drivers || drivers.length === 0) {
    return { locationId, disconnectsDetected: 0, reconnectsResolved: 0 };
  }

  // Latest heartbeat per driver
  const driverIds = drivers.map((d) => d.id);
  const { data: latest } = await sb
    .from('driver_app_heartbeats')
    .select('driver_id, recorded_at')
    .in('driver_id', driverIds)
    .eq('location_id', locationId)
    .gte('recorded_at', new Date(Date.now() - 60 * 60_000).toISOString())  // last hour
    .order('recorded_at', { ascending: false });

  // Build last-ping map
  const lastPingMap = new Map<string, string>();
  for (const row of latest ?? []) {
    if (!lastPingMap.has(row.driver_id)) {
      lastPingMap.set(row.driver_id, row.recorded_at);
    }
  }

  // Existing open disconnect events for this location (to avoid duplicates)
  const { data: openEvents } = await sb
    .from('driver_connectivity_events')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('event_type', 'disconnect')
    .is('resolved_at', null);

  const alreadyOpen = new Set((openEvents ?? []).map((e) => e.driver_id));

  // Active batches to detect on-tour status
  const { data: activeBatches } = await sb
    .from('mise_delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .in('status', ['assigned', 'at_restaurant', 'on_route', 'en_route', 'active']);

  const driversWithActiveTour = new Set((activeBatches ?? []).map((b) => b.driver_id));

  let disconnectsDetected = 0;

  const inserts: Array<{
    driver_id: string;
    location_id: string;
    event_type: string;
    gap_minutes: number | null;
    had_active_tour: boolean;
  }> = [];

  for (const driver of drivers) {
    const lastPing = lastPingMap.get(driver.id);

    // No heartbeat ever, OR last heartbeat older than threshold
    const isLost = !lastPing || lastPing < cutoff;
    if (!isLost) continue;
    if (alreadyOpen.has(driver.id)) continue;

    const gapMin = lastPing ? Math.round(minutesSince(lastPing)) : null;

    inserts.push({
      driver_id:       driver.id,
      location_id:     locationId,
      event_type:      'disconnect',
      gap_minutes:     gapMin,
      had_active_tour: driversWithActiveTour.has(driver.id),
    });
    disconnectsDetected++;
  }

  if (inserts.length > 0) {
    await sb.from('driver_connectivity_events').insert(inserts);
  }

  return { locationId, disconnectsDetected, reconnectsResolved: 0 };
}

export async function detectLostConnectionsAllLocations(): Promise<BatchDetectResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locations || locations.length === 0) {
    return { locations: 0, disconnects: 0, reconnects: 0, errors: 0 };
  }

  const results = await Promise.allSettled(
    locations.map((l) => detectLostConnections(l.id)),
  );

  let disconnects = 0;
  let reconnects = 0;
  let errors = 0;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      disconnects += r.value.disconnectsDetected;
      reconnects  += r.value.reconnectsResolved;
    } else {
      errors++;
    }
  }

  return { locations: locations.length, disconnects, reconnects, errors };
}

export async function getConnectivityDashboard(locationId: string): Promise<ConnectivityDashboard> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();

  // All online drivers for this location
  const [{ data: drivers }, { data: heartbeatRows }, { data: recentEventsRaw }] =
    await Promise.all([
      sb
        .from('mise_drivers')
        .select('id, name, vehicle_type, is_online')
        .eq('location_id', locationId)
        .eq('active', true)
        .eq('is_online', true),

      // Latest heartbeat per driver in last hour
      sb
        .from('driver_app_heartbeats')
        .select('driver_id, recorded_at, battery_pct')
        .eq('location_id', locationId)
        .gte('recorded_at', oneHourAgo)
        .order('recorded_at', { ascending: false }),

      // Last 20 connectivity events
      sb
        .from('driver_connectivity_events')
        .select('id, driver_id, event_type, detected_at, gap_minutes, had_active_tour, resolved_at')
        .eq('location_id', locationId)
        .order('detected_at', { ascending: false })
        .limit(20),
    ]);

  // Enrich with driver names
  const { data: allDriversMeta } = await sb
    .from('mise_drivers')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('active', true);

  const driverNameMap = new Map<string, string>(
    (allDriversMeta ?? []).map((d) => [d.id, d.name ?? 'Fahrer']),
  );

  // Last heartbeat per driver
  type HbRow = { driver_id: string; recorded_at: string; battery_pct: number | null };
  const lastHbMap = new Map<string, HbRow>();
  for (const row of (heartbeatRows ?? []) as HbRow[]) {
    if (!lastHbMap.has(row.driver_id)) lastHbMap.set(row.driver_id, row);
  }

  // Active tour detection
  const { data: activeBatches } = await sb
    .from('mise_delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .in('status', ['assigned', 'at_restaurant', 'on_route', 'en_route', 'active']);
  const driversOnTour = new Set((activeBatches ?? []).map((b) => b.driver_id));

  type DriverRow = { id: string; name: string | null; vehicle_type: string | null; is_online: boolean | null };

  const driverStates: DriverConnectivityState[] = ((drivers ?? []) as DriverRow[]).map((d) => {
    const hb = lastHbMap.get(d.id);
    const minSince = hb ? minutesSince(hb.recorded_at) : null;
    return {
      driverId:             d.id,
      driverName:           d.name,
      vehicle:              d.vehicle_type,
      isOnline:             d.is_online ?? false,
      lastHeartbeatAt:      hb?.recorded_at ?? null,
      minutesSinceHeartbeat: minSince !== null ? Math.round(minSince * 10) / 10 : null,
      batteryPct:           hb?.battery_pct ?? null,
      connectivityStatus:   toStatus(minSince),
      hasActiveTour:        driversOnTour.has(d.id),
    };
  });

  type EventRow = {
    id: string; driver_id: string; event_type: string;
    detected_at: string; gap_minutes: number | null;
    had_active_tour: boolean; resolved_at: string | null;
  };

  const recentEvents: ConnectivityEvent[] = ((recentEventsRaw ?? []) as EventRow[]).map((e) => ({
    id:            e.id,
    driverId:      e.driver_id,
    driverName:    driverNameMap.get(e.driver_id) ?? null,
    locationId,
    eventType:     e.event_type as 'disconnect' | 'reconnect',
    detectedAt:    e.detected_at,
    gapMinutes:    e.gap_minutes,
    hadActiveTour: e.had_active_tour,
    resolvedAt:    e.resolved_at,
  }));

  const connected = driverStates.filter((d) => d.connectivityStatus === 'connected').length;
  const degraded  = driverStates.filter((d) => d.connectivityStatus === 'degraded').length;
  const offline   = driverStates.filter((d) => d.connectivityStatus === 'offline').length;
  const unknown   = driverStates.filter((d) => d.connectivityStatus === 'unknown').length;
  const critical  = driverStates.filter((d) => d.connectivityStatus === 'offline' && d.hasActiveTour).length;

  return {
    summary: {
      totalOnline:        driverStates.length,
      connected,
      degraded,
      offline,
      unknown,
      criticalDisconnects: critical,
    },
    drivers: driverStates.sort((a, b) => {
      // Sort: critical first, then degraded, then connected
      const order: Record<ConnectivityStatus, number> = { offline: 0, degraded: 1, unknown: 2, connected: 3 };
      return order[a.connectivityStatus] - order[b.connectivityStatus];
    }),
    recentEvents,
    computedAt: now,
  };
}

export async function getDriverHeartbeatHistory(
  driverId: string,
  hours: number = 4,
): Promise<HeartbeatRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data } = await sb
    .from('driver_app_heartbeats')
    .select('id, recorded_at, battery_pct, lat, lng, signal_quality, app_version')
    .eq('driver_id', driverId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(500);

  type RawHb = {
    id: string; recorded_at: string; battery_pct: number | null;
    lat: number | null; lng: number | null; signal_quality: number | null;
    app_version: string | null;
  };

  return ((data ?? []) as RawHb[]).map((r) => ({
    id:            r.id,
    recordedAt:    r.recorded_at,
    batteryPct:    r.battery_pct,
    lat:           r.lat,
    lng:           r.lng,
    signalQuality: r.signal_quality,
    appVersion:    r.app_version,
  }));
}

export async function pruneOldHeartbeats(daysToKeep: number = 3): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_driver_heartbeats', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}

export async function pruneOldConnectivityEvents(daysToKeep: number = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_driver_connectivity_events', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
