/**
 * lib/delivery/franchise.ts
 *
 * Franchise Real-Time Command Center — Phase 32
 *
 * Aggregiert Live-Daten über alle Locations eines Tenants.
 * Ergänzt die historischen Perioden-Reports (Phase 26) um Echtzeit-KPIs.
 *
 * Funktionen:
 *  getTenantLocations()      — alle Locations eines Tenants
 *  getFranchiseRealtime()    — Echtzeit-Dashboard: Queue/Touren/Küche/Alerts je Location
 *  getTenantDriverStatus()   — Fahrer-Verteilung über alle Locations
 *  getFranchiseAlerts()      — alle offenen Alarme über alle Locations
 *  getFranchiseSummary()     — kombiniertes Dashboard (1 Call)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface TenantLocation {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
  stadt: string | null;
}

export interface LocationRealtimeStatus {
  location_id: string;
  location_name: string;
  /** Unassigned delivery orders waiting for a driver */
  queue_depth: number;
  /** Active tours (not completed/cancelled) */
  active_tours: number;
  /** Orders currently being cooked */
  cooking_now: number;
  /** Age of oldest unassigned order in minutes; null = queue empty */
  oldest_queued_min: number | null;
  /** Orders completed (delivered/picked up) since UTC midnight */
  completed_today: number;
  /** Unresolved operational alerts */
  active_alerts: number;
  /** Critical-severity unresolved alerts */
  critical_alerts: number;
  /** Derived operational health: 'ok' | 'warning' | 'critical' */
  health: 'ok' | 'warning' | 'critical';
}

export interface TenantDriverStatus {
  drivers_online: number;
  drivers_idle: number;
  drivers_busy: number;
}

export interface FranchiseAlert {
  id: string;
  location_id: string;
  location_name: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  created_at: string;
}

export interface FranchiseSummary {
  tenant_id: string;
  locations: LocationRealtimeStatus[];
  drivers: TenantDriverStatus;
  alerts: FranchiseAlert[];
  totals: {
    queue_depth: number;
    active_tours: number;
    cooking_now: number;
    completed_today: number;
    active_alerts: number;
    critical_alerts: number;
  };
  generated_at: string;
  /** True when v_location_realtime_status view is not yet available (Migration 028 pending) */
  _fallback?: true;
}

// ============================================================
// getTenantLocations
// ============================================================

/** Returns all active locations belonging to a tenant, ordered by name. */
export async function getTenantLocations(tenantId: string): Promise<TenantLocation[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('locations')
    .select('id, name, lat, lng, adresse, stadt')
    .eq('tenant_id', tenantId)
    .order('name');

  return (data ?? []).map((row) => ({
    id:      String(row.id),
    name:    String(row.name),
    lat:     row.lat   != null ? Number(row.lat)   : null,
    lng:     row.lng   != null ? Number(row.lng)   : null,
    adresse: row.adresse != null ? String(row.adresse) : null,
    stadt:   row.stadt   != null ? String(row.stadt)   : null,
  }));
}

// ============================================================
// getFranchiseRealtime
// ============================================================

/** Computes health signal from raw KPIs. */
function deriveHealth(row: Omit<LocationRealtimeStatus, 'health'>): LocationRealtimeStatus['health'] {
  if (row.critical_alerts > 0) return 'critical';
  if (row.active_alerts > 0)   return 'warning';
  if (row.queue_depth >= 5)    return 'warning';
  if ((row.oldest_queued_min ?? 0) >= 15) return 'warning';
  if (row.queue_depth >= 10 || (row.oldest_queued_min ?? 0) >= 30) return 'critical';
  return 'ok';
}

/**
 * Real-time operational snapshot for every location of a tenant.
 * Uses v_location_realtime_status (Migration 028).
 * Falls back to empty when the view is not yet available.
 */
export async function getFranchiseRealtime(
  tenantId: string,
): Promise<{ locations: LocationRealtimeStatus[]; _fallback?: true }> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_location_realtime_status')
    .select(
      'location_id, location_name, queue_depth, active_tours, cooking_now, ' +
      'oldest_queued_min, completed_today, active_alerts, critical_alerts',
    )
    .eq('tenant_id', tenantId)
    .order('location_name');

  if (error) {
    // Migration 028 not yet applied — return empty with fallback flag
    return { locations: [], _fallback: true };
  }

  const locations: LocationRealtimeStatus[] = (data ?? []).map((rawRow) => {
    const row = rawRow as unknown as Record<string, unknown>;
    const base: Omit<LocationRealtimeStatus, 'health'> = {
      location_id:       String(row.location_id),
      location_name:     String(row.location_name),
      queue_depth:       Number(row.queue_depth   ?? 0),
      active_tours:      Number(row.active_tours  ?? 0),
      cooking_now:       Number(row.cooking_now   ?? 0),
      oldest_queued_min: row.oldest_queued_min != null ? Number(row.oldest_queued_min) : null,
      completed_today:   Number(row.completed_today ?? 0),
      active_alerts:     Number(row.active_alerts  ?? 0),
      critical_alerts:   Number(row.critical_alerts ?? 0),
    };
    return { ...base, health: deriveHealth(base) };
  });

  return { locations };
}

// ============================================================
// getTenantDriverStatus
// ============================================================

/**
 * Tenant-wide driver headcount (online / idle / busy).
 * Uses v_tenant_driver_summary (Migration 028).
 */
export async function getTenantDriverStatus(tenantId: string): Promise<TenantDriverStatus> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_tenant_driver_summary')
    .select('drivers_online, drivers_idle, drivers_busy')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const row = (data as unknown as Record<string, unknown>) ?? {};
  return {
    drivers_online: Number(row.drivers_online ?? 0),
    drivers_idle:   Number(row.drivers_idle   ?? 0),
    drivers_busy:   Number(row.drivers_busy   ?? 0),
  };
}

// ============================================================
// getFranchiseAlerts
// ============================================================

/**
 * All unresolved operational alerts across all locations of a tenant,
 * newest first, capped at 50.
 */
export async function getFranchiseAlerts(tenantId: string): Promise<FranchiseAlert[]> {
  const sb = createServiceClient();

  // Get location IDs for this tenant
  const { data: locs } = await sb
    .from('locations')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (!locs || locs.length === 0) return [];

  const locationIdStrings = locs.map((l) => String(l.id));
  const nameMap = new Map(locs.map((l) => [String(l.id), String(l.name)]));

  const { data: alerts } = await sb
    .from('delivery_alerts')
    .select('id, location_id, alert_type, severity, message, created_at')
    .in('location_id', locationIdStrings)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (alerts ?? []).map((a) => ({
    id:            String(a.id),
    location_id:   String(a.location_id),
    location_name: nameMap.get(String(a.location_id)) ?? String(a.location_id),
    alert_type:    String(a.alert_type),
    severity:      (a.severity as FranchiseAlert['severity']) ?? 'info',
    message:       String(a.message),
    created_at:    String(a.created_at),
  }));
}

// ============================================================
// getFranchiseSummary
// ============================================================

/**
 * Combined franchise dashboard: locations + drivers + alerts in one call.
 * Suitable for polling every 30–60 seconds.
 */
export async function getFranchiseSummary(tenantId: string): Promise<FranchiseSummary> {
  const [realtimeResult, drivers, alerts] = await Promise.all([
    getFranchiseRealtime(tenantId),
    getTenantDriverStatus(tenantId).catch((): TenantDriverStatus => ({
      drivers_online: 0,
      drivers_idle:   0,
      drivers_busy:   0,
    })),
    getFranchiseAlerts(tenantId).catch((): FranchiseAlert[] => []),
  ]);

  const { locations, _fallback } = realtimeResult;

  const totals = locations.reduce(
    (acc, loc) => ({
      queue_depth:    acc.queue_depth    + loc.queue_depth,
      active_tours:   acc.active_tours   + loc.active_tours,
      cooking_now:    acc.cooking_now    + loc.cooking_now,
      completed_today: acc.completed_today + loc.completed_today,
      active_alerts:  acc.active_alerts  + loc.active_alerts,
      critical_alerts: acc.critical_alerts + loc.critical_alerts,
    }),
    { queue_depth: 0, active_tours: 0, cooking_now: 0, completed_today: 0, active_alerts: 0, critical_alerts: 0 },
  );

  return {
    tenant_id:    tenantId,
    locations,
    drivers,
    alerts,
    totals,
    generated_at: new Date().toISOString(),
    ...(_fallback ? { _fallback: true as const } : {}),
  };
}
