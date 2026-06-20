/**
 * lib/delivery/driver-lending.ts
 *
 * Phase 348 — Smart Cross-Location Driver Lending Engine
 *
 * Erkennt Fahrer-Ungleichgewichte zwischen Standorten desselben Tenants
 * und schlägt Cross-Location-Lending vor: Standorte mit Überschuss-Fahrern
 * können idle Fahrer temporär an Standorte mit Engpässen ausleihen.
 *
 * Algorithmus:
 *  1. Lade alle aktiven Standorte des Tenants (mit lat/lng)
 *  2. Berechne Fahrer-Status + offene Bestellungen je Standort
 *  3. Vergleiche: Standort A hat ≥ min_idle_to_lend idle Fahrer
 *               + Standort B hat ≥ min_pending_to_request offene Bestellungen
 *               + Abstand A↔B ≤ max_distance_km
 *  4. Urgency-Score aus pendingOrders / activeDrivers-Ratio
 *
 * Funktionen:
 *  getConfig(tenantId)                      — Konfiguration (mit Defaults)
 *  upsertConfig(tenantId, update)           — Partial-Update
 *  detectCandidates(tenantId)               — Lending-Kandidaten berechnen
 *  createLendingRequest(...)                — Neue Lending-Anfrage anlegen
 *  updateLendingStatus(id, tenantId, status)— Status ändern + Timestamps setzen
 *  getDashboard(tenantId)                   — KPIs + Kandidaten + Anfragen
 *  pruneOldRequests(daysToKeep)             — via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LendingConfig {
  tenantId: string;
  isEnabled: boolean;
  maxDistanceKm: number;
  minIdleToLend: number;
  minPendingToRequest: number;
  autoSuggest: boolean;
  hourlyCompensationEur: number;
}

export interface DriverOption {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  state: string;
}

export type LendingStatus = 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'cancelled';
export type LendingUrgency = 'low' | 'medium' | 'high';

export interface LendingCandidate {
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  distanceKm: number;
  availableDrivers: DriverOption[];
  pendingOrdersTo: number;
  activeDriversTo: number;
  urgency: LendingUrgency;
}

export interface LendingRequest {
  id: string;
  tenantId: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  driverId: string;
  driverName: string | null;
  status: LendingStatus;
  requestedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  hoursWorked: number | null;
  compensationEur: number | null;
  notes: string | null;
}

export interface LendingDashboard {
  config: LendingConfig;
  activeLendings: LendingRequest[];
  pendingRequests: LendingRequest[];
  todaySummary: {
    totalRequests: number;
    acceptedCount: number;
    rejectedCount: number;
    completedHours: number;
    compensationEur: number;
  };
  candidates: LendingCandidate[];
  recentHistory: LendingRequest[];
}

// ── Haversine ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Config ───────────────────────────────────────────────────────────────────

export async function getConfig(tenantId: string): Promise<LendingConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_lending_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return {
    tenantId,
    isEnabled: data?.is_enabled ?? false,
    maxDistanceKm: Number(data?.max_distance_km ?? 25),
    minIdleToLend: data?.min_idle_to_lend ?? 2,
    minPendingToRequest: data?.min_pending_to_request ?? 3,
    autoSuggest: data?.auto_suggest ?? true,
    hourlyCompensationEur: Number(data?.hourly_compensation_eur ?? 0),
  };
}

export async function upsertConfig(
  tenantId: string,
  update: Partial<Omit<LendingConfig, 'tenantId'>>,
): Promise<LendingConfig> {
  const sb = createServiceClient();
  await sb.from('driver_lending_config').upsert(
    {
      tenant_id: tenantId,
      ...(update.isEnabled !== undefined ? { is_enabled: update.isEnabled } : {}),
      ...(update.maxDistanceKm !== undefined ? { max_distance_km: update.maxDistanceKm } : {}),
      ...(update.minIdleToLend !== undefined ? { min_idle_to_lend: update.minIdleToLend } : {}),
      ...(update.minPendingToRequest !== undefined ? { min_pending_to_request: update.minPendingToRequest } : {}),
      ...(update.autoSuggest !== undefined ? { auto_suggest: update.autoSuggest } : {}),
      ...(update.hourlyCompensationEur !== undefined
        ? { hourly_compensation_eur: update.hourlyCompensationEur }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );
  return getConfig(tenantId);
}

// ── Candidate Detection ───────────────────────────────────────────────────────

export async function detectCandidates(tenantId: string): Promise<LendingCandidate[]> {
  const config = await getConfig(tenantId);
  if (!config.isEnabled || !config.autoSuggest) return [];

  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id, name, lat, lng')
    .eq('tenant_id', tenantId)
    .eq('aktiv', true);

  if (!locations || locations.length < 2) return [];

  const locationIds = locations.map((l) => l.id as string);

  // Load driver states (active drivers in tenant locations)
  const { data: employees } = await sb
    .from('employees')
    .select('id, location_id')
    .in('location_id', locationIds);

  const empToLocation = new Map<string, string>();
  for (const e of employees ?? []) {
    empToLocation.set(e.id as string, e.location_id as string);
  }

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, state, employee_id')
    .eq('active', true);

  const driverToLocation = new Map<string, string>();
  for (const d of drivers ?? []) {
    const locId = empToLocation.get(d.employee_id as string);
    if (locId && locationIds.includes(locId)) {
      driverToLocation.set(d.id as string, locId);
    }
  }

  // Load open orders per location
  const { data: orders } = await sb
    .from('customer_orders')
    .select('location_id, status')
    .in('location_id', locationIds)
    .in('status', ['bestellt', 'in_zubereitung', 'fertig', 'dispatched']);

  // Build location stats
  interface LocStats {
    idleDrivers: DriverOption[];
    activeDrivers: number;
    pendingOrders: number;
  }
  const stats = new Map<string, LocStats>();
  for (const loc of locations) {
    stats.set(loc.id as string, { idleDrivers: [], activeDrivers: 0, pendingOrders: 0 });
  }

  for (const d of drivers ?? []) {
    const locId = driverToLocation.get(d.id as string);
    if (!locId) continue;
    const s = stats.get(locId);
    if (!s) continue;
    if (d.state === 'idle') {
      s.idleDrivers.push({
        driverId: d.id as string,
        driverName: d.name as string | null,
        vehicle: d.vehicle as string | null,
        state: 'idle',
      });
    } else {
      s.activeDrivers++;
    }
  }

  for (const o of orders ?? []) {
    const s = stats.get(o.location_id as string);
    if (s) s.pendingOrders++;
  }

  const candidates: LendingCandidate[] = [];

  for (const fromLoc of locations) {
    const fromStats = stats.get(fromLoc.id as string);
    if (!fromStats || fromStats.idleDrivers.length < config.minIdleToLend) continue;

    for (const toLoc of locations) {
      if (toLoc.id === fromLoc.id) continue;
      const toStats = stats.get(toLoc.id as string);
      if (!toStats || toStats.pendingOrders < config.minPendingToRequest) continue;

      if (
        fromLoc.lat == null ||
        fromLoc.lng == null ||
        toLoc.lat == null ||
        toLoc.lng == null
      )
        continue;

      const distKm = haversineKm(
        Number(fromLoc.lat),
        Number(fromLoc.lng),
        Number(toLoc.lat),
        Number(toLoc.lng),
      );
      if (distKm > config.maxDistanceKm) continue;

      const ratio = toStats.activeDrivers > 0
        ? toStats.pendingOrders / toStats.activeDrivers
        : toStats.pendingOrders;
      const urgency: LendingUrgency =
        ratio >= 5 ? 'high' : ratio >= 3 ? 'medium' : 'low';

      candidates.push({
        fromLocationId: fromLoc.id as string,
        fromLocationName: fromLoc.name as string,
        toLocationId: toLoc.id as string,
        toLocationName: toLoc.name as string,
        distanceKm: Math.round(distKm * 10) / 10,
        availableDrivers: fromStats.idleDrivers,
        pendingOrdersTo: toStats.pendingOrders,
        activeDriversTo: toStats.activeDrivers,
        urgency,
      });
    }
  }

  const urgencyOrder: Record<LendingUrgency, number> = { high: 0, medium: 1, low: 2 };
  return candidates.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ── Request Lifecycle ─────────────────────────────────────────────────────────

export async function createLendingRequest(
  tenantId: string,
  fromLocationId: string,
  toLocationId: string,
  driverId: string,
  requestedByEmployeeId: string | null,
  notes?: string,
): Promise<LendingRequest> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_lending_requests')
    .insert({
      tenant_id: tenantId,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      driver_id: driverId,
      requested_by_employee_id: requestedByEmployeeId ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Konnte Lending-Anfrage nicht anlegen');
  return fetchRequest(data.id as string, tenantId);
}

export async function updateLendingStatus(
  requestId: string,
  tenantId: string,
  status: LendingStatus,
): Promise<LendingRequest> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };

  if (status === 'accepted') patch.accepted_at = now;
  if (status === 'active') patch.started_at = now;
  if (status === 'completed' || status === 'cancelled') {
    patch.ended_at = now;
    const { data: req } = await sb
      .from('driver_lending_requests')
      .select('started_at, tenant_id')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (req?.started_at) {
      const hoursWorked =
        (Date.now() - new Date(req.started_at as string).getTime()) / 3_600_000;
      patch.hours_worked = Math.round(hoursWorked * 100) / 100;
    }
  }

  await sb
    .from('driver_lending_requests')
    .update(patch)
    .eq('id', requestId)
    .eq('tenant_id', tenantId);

  return fetchRequest(requestId, tenantId);
}

async function fetchRequest(requestId: string, tenantId: string): Promise<LendingRequest> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_lending_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .single();
  if (!data) throw new Error('Lending-Anfrage nicht gefunden');

  // Enrich with names
  const [fromLoc, toLoc, driver] = await Promise.all([
    sb.from('locations').select('name').eq('id', data.from_location_id as string).maybeSingle(),
    sb.from('locations').select('name').eq('id', data.to_location_id as string).maybeSingle(),
    sb.from('mise_drivers').select('name').eq('id', data.driver_id as string).maybeSingle(),
  ]);

  return mapRow(data, fromLoc?.data?.name ?? null, toLoc?.data?.name ?? null, driver?.data?.name ?? null);
}

function mapRow(
  row: Record<string, unknown>,
  fromLocationName: string | null,
  toLocationName: string | null,
  driverName: string | null,
): LendingRequest {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    fromLocationId: row.from_location_id as string,
    fromLocationName: fromLocationName ?? '',
    toLocationId: row.to_location_id as string,
    toLocationName: toLocationName ?? '',
    driverId: row.driver_id as string,
    driverName,
    status: row.status as LendingStatus,
    requestedAt: row.requested_at as string,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    hoursWorked: row.hours_worked != null ? Number(row.hours_worked) : null,
    compensationEur: row.compensation_eur != null ? Number(row.compensation_eur) : null,
    notes: (row.notes as string | null) ?? null,
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(tenantId: string): Promise<LendingDashboard> {
  const [config, candidates] = await Promise.all([
    getConfig(tenantId),
    detectCandidates(tenantId),
  ]);

  const sb = createServiceClient();
  const { data: rows } = await sb
    .from('driver_lending_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(60);

  const allRows = rows ?? [];

  // Enrich names in a single batch
  const locationIds = [
    ...new Set(allRows.flatMap((r) => [r.from_location_id as string, r.to_location_id as string])),
  ];
  const driverIds = [...new Set(allRows.map((r) => r.driver_id as string))];

  const [locsResult, driversResult] = await Promise.all([
    locationIds.length > 0
      ? sb.from('locations').select('id, name').in('id', locationIds)
      : { data: [] },
    driverIds.length > 0
      ? sb.from('mise_drivers').select('id, name').in('id', driverIds)
      : { data: [] },
  ]);

  const locNameMap = new Map<string, string>();
  for (const l of locsResult.data ?? []) locNameMap.set(l.id as string, l.name as string);
  const driverNameMap = new Map<string, string | null>();
  for (const d of driversResult.data ?? []) driverNameMap.set(d.id as string, d.name as string | null);

  const requests: LendingRequest[] = allRows.map((row) =>
    mapRow(
      row as Record<string, unknown>,
      locNameMap.get(row.from_location_id as string) ?? null,
      locNameMap.get(row.to_location_id as string) ?? null,
      driverNameMap.get(row.driver_id as string) ?? null,
    ),
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayReqs = requests.filter((r) => r.requestedAt.startsWith(today));

  return {
    config,
    activeLendings: requests.filter((r) => r.status === 'active'),
    pendingRequests: requests.filter((r) => r.status === 'pending'),
    todaySummary: {
      totalRequests: todayReqs.length,
      acceptedCount: todayReqs.filter((r) =>
        ['accepted', 'active', 'completed'].includes(r.status),
      ).length,
      rejectedCount: todayReqs.filter((r) => r.status === 'rejected').length,
      completedHours: todayReqs.reduce((sum, r) => sum + (r.hoursWorked ?? 0), 0),
      compensationEur: todayReqs.reduce((sum, r) => sum + (r.compensationEur ?? 0), 0),
    },
    candidates,
    recentHistory: requests
      .filter((r) => ['completed', 'cancelled', 'rejected'].includes(r.status))
      .slice(0, 20),
  };
}

// ── Prune ─────────────────────────────────────────────────────────────────────

export async function pruneOldRequests(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_driver_lending_requests', { days_old: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
