/**
 * lib/delivery/emergency-capacity.ts — Phase 404
 *
 * Emergency Capacity Engine — Notfall-Disposition bei Fahrer-Engpässen.
 *
 * Wenn aktive Fahrer < benötigte Kapazität, wird ein Notfall-Event erzeugt.
 * Bereitschaftsfahrer (Standby-Pool) werden per Eintrag benachrichtigt.
 * Dispatcher sehen offene Ereignisse + Pool-Status im Dashboard.
 *
 * Kapazitätsformel: 1 Fahrer pro 4 offene Lieferaufträge, mind. 1.
 * Schweregrad: critical wenn gap ≥ 3, sonst warning.
 *
 * Public API:
 *   detectCapacityEmergency(locationId)     — Engpass erkennen / Auto-Auflösen
 *   detectEmergencyAllLocations()           — Cron-Batch
 *   registerForStandby(params)              — Fahrer als Bereitschaft eintragen
 *   removeFromStandby(driverId, locationId) — Fahrer aus Pool entfernen
 *   notifyStandbyDrivers(eventId, locationId) — Response-Log-Einträge anlegen
 *   recordDriverResponse(eventId, driverId, response) — Antwort erfassen
 *   resolveEmergency(eventId, locationId, type) — Notfall schließen
 *   getEmergencyDashboard(locationId)       — Admin-Übersicht
 *   pruneOldEmergencyEvents(daysToKeep)     — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type EmergencySeverity  = 'warning' | 'critical';
export type EmergencyResolution =
  | 'drivers_arrived'
  | 'demand_dropped'
  | 'manual'
  | 'auto_resolved';
export type DriverResponse = 'accepted' | 'declined' | 'no_response';

export interface StandbyDriver {
  id:              string;
  locationId:      string;
  driverId:        string;
  driverName:      string | null;
  vehicle:         string | null;
  availableFrom:   string;
  availableUntil:  string;
  avgResponseMin:  number;
  responseRatePct: number;
  isActive:        boolean;
  notes:           string | null;
}

export interface EmergencyEvent {
  id:               string;
  locationId:       string;
  detectedAt:       string;
  severity:         EmergencySeverity;
  activeDrivers:    number;
  requiredDrivers:  number;
  capacityGap:      number;
  pendingOrders:    number;
  standbyNotified:  number;
  standbyResponded: number;
  standbyActivated: number;
  resolvedAt:       string | null;
  resolutionType:   EmergencyResolution | null;
  autoResolved:     boolean;
}

export interface CapacityStatus {
  activeDrivers:   number;
  requiredDrivers: number;
  capacityGap:     number;
  severity:        EmergencySeverity | null;
}

export interface EmergencyDashboard {
  openEmergencies:    EmergencyEvent[];
  standbyPool:        StandbyDriver[];
  standbyPoolSize:    number;
  currentCapacity:    CapacityStatus;
  last7DaysSummary: {
    totalEvents:     number;
    avgActivated:    number;
    resolutionRate:  number;
  };
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function requiredDriversFor(pendingOrders: number): number {
  return Math.max(1, Math.ceil(pendingOrders / 4));
}

function mapEvent(e: Record<string, unknown>): EmergencyEvent {
  return {
    id:               e.id              as string,
    locationId:       e.location_id     as string,
    detectedAt:       e.detected_at     as string,
    severity:         e.severity        as EmergencySeverity,
    activeDrivers:    e.active_drivers  as number,
    requiredDrivers:  e.required_drivers as number,
    capacityGap:      e.capacity_gap    as number,
    pendingOrders:    e.pending_orders  as number,
    standbyNotified:  e.standby_notified  as number,
    standbyResponded: e.standby_responded as number,
    standbyActivated: e.standby_activated as number,
    resolvedAt:       e.resolved_at     as string | null,
    resolutionType:   e.resolution_type as EmergencyResolution | null,
    autoResolved:     e.auto_resolved   as boolean,
  };
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Prüft ob ein Kapazitätsengpass vorliegt.
 * - Wenn Engpass besteht und noch kein offenes Event → neues Event erstellen.
 * - Wenn Engpass behoben und offenes Event vorhanden → Auto-Auflösen.
 * - Bereits offenes Event ohne Änderung → nichts tun.
 */
export async function detectCapacityEmergency(
  locationId: string,
): Promise<EmergencyEvent | null> {
  const sb = createServiceClient();

  const [{ data: driverRows }, { data: pendingRows }, { data: openEvents }] =
    await Promise.all([
      sb.from('mise_drivers')
        .select('id, is_available')
        .eq('location_id', locationId),
      sb.from('customer_orders')
        .select('id')
        .eq('location_id', locationId)
        .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
        .eq('order_type', 'delivery'),
      sb.from('emergency_capacity_events')
        .select('id')
        .eq('location_id', locationId)
        .is('resolved_at', null)
        .limit(1),
    ]);

  const activeDrivers = (driverRows ?? []).filter((d) => d.is_available === true).length;
  const pendingOrders = pendingRows?.length ?? 0;
  const required      = requiredDriversFor(pendingOrders);
  const gap           = required - activeDrivers;

  // Engpass behoben → offenes Event automatisch schließen
  if (gap <= 0 && (openEvents ?? []).length > 0) {
    await sb.from('emergency_capacity_events')
      .update({
        resolved_at:     new Date().toISOString(),
        resolution_type: 'auto_resolved',
        auto_resolved:   true,
      })
      .eq('location_id', locationId)
      .is('resolved_at', null);
    return null;
  }

  if (gap <= 0)                     return null;  // kein Engpass
  if ((openEvents ?? []).length > 0) return null;  // Event bereits offen

  const severity: EmergencySeverity = gap >= 3 ? 'critical' : 'warning';

  const { data: newEvent } = await sb.from('emergency_capacity_events')
    .insert({
      location_id:      locationId,
      severity,
      active_drivers:   activeDrivers,
      required_drivers: required,
      capacity_gap:     gap,
      pending_orders:   pendingOrders,
    })
    .select()
    .single();

  return newEvent ? mapEvent(newEvent as Record<string, unknown>) : null;
}

export async function detectEmergencyAllLocations(): Promise<{
  locations: number;
  emergencies: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locations?.length) return { locations: 0, emergencies: 0 };

  const results = await Promise.allSettled(
    locations.map((l) => detectCapacityEmergency(l.id as string)),
  );

  const emergencies = results.filter(
    (r) => r.status === 'fulfilled' && r.value !== null,
  ).length;

  return { locations: locations.length, emergencies };
}

// ── Standby-Pool ──────────────────────────────────────────────────────────────

export async function registerForStandby(params: {
  driverId:       string;
  locationId:     string;
  availableFrom?: string;
  availableUntil: string;
  notes?:         string;
}): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { error } = await sb.from('driver_standby_pool').upsert(
    {
      driver_id:      params.driverId,
      location_id:    params.locationId,
      available_from: params.availableFrom ?? new Date().toISOString(),
      available_until: params.availableUntil,
      notes:          params.notes ?? null,
      is_active:      true,
    },
    { onConflict: 'driver_id,location_id' },
  );
  return { ok: !error };
}

export async function removeFromStandby(
  driverId:   string,
  locationId: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { error } = await sb.from('driver_standby_pool')
    .update({ is_active: false })
    .eq('driver_id', driverId)
    .eq('location_id', locationId);
  return { ok: !error };
}

// ── Benachrichtigung & Antwort ────────────────────────────────────────────────

/**
 * Legt Response-Log-Einträge für alle noch nicht benachrichtigten Standby-Fahrer an.
 * (Tatsächlicher Push erfolgt extern — z.B. per push-notify oder WhatsApp.)
 */
export async function notifyStandbyDrivers(
  eventId:    string,
  locationId: string,
): Promise<{ notified: number }> {
  const sb = createServiceClient();

  const [{ data: pool }, { data: existing }] = await Promise.all([
    sb.from('driver_standby_pool')
      .select('driver_id')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .gt('available_until', new Date().toISOString()),
    sb.from('emergency_response_log')
      .select('driver_id')
      .eq('event_id', eventId),
  ]);

  const alreadySet = new Set((existing ?? []).map((r) => r.driver_id as string));
  const toNotify   = (pool ?? []).filter((d) => !alreadySet.has(d.driver_id as string));

  if (!toNotify.length) return { notified: 0 };

  await sb.from('emergency_response_log').insert(
    toNotify.map((d) => ({
      event_id:    eventId,
      driver_id:   d.driver_id,
      location_id: locationId,
    })),
  );

  const totalNotified = (existing?.length ?? 0) + toNotify.length;
  await sb.from('emergency_capacity_events')
    .update({ standby_notified: totalNotified })
    .eq('id', eventId);

  return { notified: toNotify.length };
}

export async function recordDriverResponse(
  eventId:  string,
  driverId: string,
  response: DriverResponse,
): Promise<{ ok: boolean }> {
  const sb  = createServiceClient();
  const now = new Date().toISOString();

  const updates: Record<string, string | null | boolean> = {
    response,
    responded_at: response !== 'no_response' ? now : null,
    activated_at: response === 'accepted'    ? now : null,
  };

  const { error } = await sb.from('emergency_response_log')
    .update(updates)
    .eq('event_id', eventId)
    .eq('driver_id', driverId);

  if (!error) {
    const { data: allResponses } = await sb.from('emergency_response_log')
      .select('response')
      .eq('event_id', eventId);

    const responded = (allResponses ?? []).filter((r) => r.response !== 'no_response').length;
    const activated = (allResponses ?? []).filter((r) => r.response === 'accepted').length;

    await sb.from('emergency_capacity_events').update({
      standby_responded: responded,
      standby_activated: activated,
    }).eq('id', eventId);
  }

  return { ok: !error };
}

export async function resolveEmergency(
  eventId:        string,
  locationId:     string,
  resolutionType: EmergencyResolution = 'manual',
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { error } = await sb.from('emergency_capacity_events')
    .update({
      resolved_at:     new Date().toISOString(),
      resolution_type: resolutionType,
    })
    .eq('id', eventId)
    .eq('location_id', locationId)
    .is('resolved_at', null);
  return { ok: !error };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getEmergencyDashboard(
  locationId: string,
): Promise<EmergencyDashboard> {
  const sb          = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: openEvents },
    { data: poolRows },
    { data: last7Days },
    { data: driverRows },
    { data: pendingRows },
  ] = await Promise.all([
    sb.from('emergency_capacity_events')
      .select('*')
      .eq('location_id', locationId)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false }),
    sb.from('driver_standby_pool')
      .select('*, mise_drivers!driver_id(name, vehicle)')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .gt('available_until', new Date().toISOString())
      .order('avg_response_min', { ascending: true }),
    sb.from('emergency_capacity_events')
      .select('standby_activated, resolved_at')
      .eq('location_id', locationId)
      .gte('detected_at', sevenDaysAgo),
    sb.from('mise_drivers')
      .select('id, is_available')
      .eq('location_id', locationId),
    sb.from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
      .eq('order_type', 'delivery'),
  ]);

  const activeDrivers = (driverRows ?? []).filter((d) => d.is_available === true).length;
  const pendingOrders = pendingRows?.length ?? 0;
  const required      = requiredDriversFor(pendingOrders);
  const gap           = required - activeDrivers;

  const totalEvents   = last7Days?.length ?? 0;
  const avgActivated  = totalEvents
    ? (last7Days ?? []).reduce((s, e) => s + ((e.standby_activated as number) ?? 0), 0) / totalEvents
    : 0;
  const resolutionRate = totalEvents
    ? Math.round(
        (last7Days ?? []).filter((e) => e.resolved_at !== null).length / totalEvents * 100,
      )
    : 0;

  const standbyPool: StandbyDriver[] = (poolRows ?? []).map((s) => {
    const drv = s['mise_drivers'] as unknown as { name: string | null; vehicle: string | null } | null;
    return {
      id:              s.id             as string,
      locationId:      s.location_id    as string,
      driverId:        s.driver_id      as string,
      driverName:      drv?.name        ?? null,
      vehicle:         drv?.vehicle     ?? null,
      availableFrom:   s.available_from  as string,
      availableUntil:  s.available_until as string,
      avgResponseMin:  s.avg_response_min  as number,
      responseRatePct: s.response_rate_pct as number,
      isActive:        s.is_active       as boolean,
      notes:           s.notes           as string | null,
    };
  });

  return {
    openEmergencies: (openEvents ?? []).map((e) => mapEvent(e as Record<string, unknown>)),
    standbyPool,
    standbyPoolSize: standbyPool.length,
    currentCapacity: {
      activeDrivers,
      requiredDrivers: required,
      capacityGap:     Math.max(0, gap),
      severity:        gap >= 3 ? 'critical' : gap > 0 ? 'warning' : null,
    },
    last7DaysSummary: {
      totalEvents,
      avgActivated:   Math.round(avgActivated * 10) / 10,
      resolutionRate,
    },
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldEmergencyEvents(
  daysToKeep = 90,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_emergency_capacity_events', {
    days_to_keep: daysToKeep,
  });
  return { pruned: (data as number | null) ?? 0 };
}
