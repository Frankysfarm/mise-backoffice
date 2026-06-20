/**
 * lib/delivery/geofence-auto-hours.ts
 *
 * Phase 338 — Geofence Auto-Hours Engine
 *
 * Öffnet und schließt Lieferdienst-Touren automatisch basierend auf der
 * Anzahl verfügbarer Fahrer. Nutzt den Kapazitäts-Signal-Mechanismus
 * (queue_signals: normal ↔ paused) statt direkter Tenanten-Einstellungen.
 *
 * Public API:
 *   checkAndToggleLocation(locationId)       — Core-Logik (Cron-Tick)
 *   getAutoHoursConfig(locationId)           — Konfiguration laden
 *   upsertAutoHoursConfig(locationId, cfg)   — Konfiguration speichern
 *   getAutoHoursDashboard(locationId)        — Admin-Dashboard
 *   checkAllLocations()                      — Cron-Batch
 *   pruneOldLogs(days)                       — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getCurrentQueueSignal,
  setQueueSignal,
} from './capacity';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface AutoHoursConfig {
  id?: string;
  locationId: string;
  isEnabled: boolean;
  minDriversToOpen: number;
  autoOpenEnabled: boolean;
  autoCloseEnabled: boolean;
  gracePeriodMin: number;
  openMessageDe: string;
  closeMessageDe: string;
}

export interface AutoHoursCheckResult {
  locationId: string;
  action: 'opened' | 'closed' | 'no_change';
  driversOnline: number;
  previousSignal: string;
  newSignal: string;
  reason: string;
}

export interface AutoHoursLogRow {
  id: string;
  locationId: string;
  action: 'opened' | 'closed' | 'no_change';
  driversOnline: number;
  triggeredBy: string;
  reason: string | null;
  createdAt: string;
}

export interface AutoHoursDashboard {
  config: AutoHoursConfig;
  currentSignal: string;
  driversOnline: number;
  stats: {
    openEvents7d: number;
    closeEvents7d: number;
    totalEvents7d: number;
  };
  recentEvents: AutoHoursLogRow[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AutoHoursConfig = {
  locationId: '',
  isEnabled: false,
  minDriversToOpen: 2,
  autoOpenEnabled: true,
  autoCloseEnabled: true,
  gracePeriodMin: 5,
  openMessageDe: 'Lieferung wieder verfügbar',
  closeMessageDe: 'Lieferung kurz pausiert – bald wieder verfügbar',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToConfig(r: Record<string, unknown>): AutoHoursConfig {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    isEnabled: r.is_enabled as boolean,
    minDriversToOpen: Number(r.min_drivers_to_open),
    autoOpenEnabled: r.auto_open_enabled as boolean,
    autoCloseEnabled: r.auto_close_enabled as boolean,
    gracePeriodMin: Number(r.grace_period_min),
    openMessageDe: (r.open_message_de as string | null) ?? DEFAULT_CONFIG.openMessageDe,
    closeMessageDe: (r.close_message_de as string | null) ?? DEFAULT_CONFIG.closeMessageDe,
  };
}

async function countActiveDrivers(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId);
  if (!drivers || drivers.length === 0) return 0;

  const driverIds = drivers.map((d) => d.id as string);
  const { count } = await sb
    .from('driver_status')
    .select('driver_id', { count: 'exact', head: true })
    .in('driver_id', driverIds)
    .eq('online', true);
  return count ?? 0;
}

// ── 1. Konfiguration ──────────────────────────────────────────────────────────

export async function getAutoHoursConfig(locationId: string): Promise<AutoHoursConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('geofence_auto_hours_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_CONFIG, locationId };
  return rowToConfig(data as Record<string, unknown>);
}

export async function upsertAutoHoursConfig(
  locationId: string,
  cfg: Partial<Omit<AutoHoursConfig, 'locationId' | 'id'>>,
): Promise<AutoHoursConfig> {
  const sb = createServiceClient();
  const payload = {
    location_id: locationId,
    is_enabled: cfg.isEnabled,
    min_drivers_to_open: cfg.minDriversToOpen,
    auto_open_enabled: cfg.autoOpenEnabled,
    auto_close_enabled: cfg.autoCloseEnabled,
    grace_period_min: cfg.gracePeriodMin,
    open_message_de: cfg.openMessageDe,
    close_message_de: cfg.closeMessageDe,
    updated_at: new Date().toISOString(),
  };
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
  const { data, error } = await sb
    .from('geofence_auto_hours_config')
    .upsert(clean, { onConflict: 'location_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToConfig(data as Record<string, unknown>);
}

// ── 2. Core-Logik ─────────────────────────────────────────────────────────────

export async function checkAndToggleLocation(
  locationId: string,
): Promise<AutoHoursCheckResult> {
  const sb = createServiceClient();
  const [cfg, driversOnline, currentSignal] = await Promise.all([
    getAutoHoursConfig(locationId),
    countActiveDrivers(locationId),
    getCurrentQueueSignal(locationId),
  ]);

  const previousSignal = currentSignal.signalType;
  let action: 'opened' | 'closed' | 'no_change' = 'no_change';
  let reason = 'Keine Änderung erforderlich';
  let newSignal = previousSignal;

  if (!cfg.isEnabled) {
    return { locationId, action, driversOnline, previousSignal, newSignal, reason };
  }

  const isPaused = previousSignal === 'paused' && currentSignal.triggerSource === 'auto_hours';

  if (
    cfg.autoOpenEnabled &&
    driversOnline >= cfg.minDriversToOpen &&
    isPaused
  ) {
    await setQueueSignal(locationId, {
      signalType: 'normal',
      etaExtensionMin: 0,
      messageDe: cfg.openMessageDe,
    }, true, 'auto_hours');
    action = 'opened';
    newSignal = 'normal';
    reason = `${driversOnline} Fahrer online (min: ${cfg.minDriversToOpen}) → Lieferung geöffnet`;
  } else if (
    cfg.autoCloseEnabled &&
    driversOnline < cfg.minDriversToOpen &&
    previousSignal !== 'paused'
  ) {
    await setQueueSignal(locationId, {
      signalType: 'paused',
      etaExtensionMin: 0,
      messageDe: cfg.closeMessageDe,
    }, true, 'auto_hours');
    action = 'closed';
    newSignal = 'paused';
    reason = `Nur ${driversOnline}/${cfg.minDriversToOpen} Fahrer online → Lieferung pausiert`;
  }

  await sb.from('geofence_auto_hours_log').insert({
    location_id: locationId,
    action,
    drivers_online: driversOnline,
    triggered_by: 'cron',
    reason,
  });

  return { locationId, action, driversOnline, previousSignal, newSignal, reason };
}

// ── 3. Dashboard ──────────────────────────────────────────────────────────────

export async function getAutoHoursDashboard(locationId: string): Promise<AutoHoursDashboard> {
  const sb = createServiceClient();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [config, driversOnline, currentSignal, { data: logs7d }, { data: recentLogs }] =
    await Promise.all([
      getAutoHoursConfig(locationId),
      countActiveDrivers(locationId),
      getCurrentQueueSignal(locationId),
      sb
        .from('geofence_auto_hours_log')
        .select('action')
        .eq('location_id', locationId)
        .gte('created_at', since7d),
      sb
        .from('geofence_auto_hours_log')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

  const all7d = (logs7d ?? []).filter((r) => r.action !== 'no_change');
  const openEvents7d = all7d.filter((r) => r.action === 'opened').length;
  const closeEvents7d = all7d.filter((r) => r.action === 'closed').length;

  const recentEvents = (recentLogs ?? []).map(
    (r) =>
      ({
        id: r.id as string,
        locationId: r.location_id as string,
        action: r.action as 'opened' | 'closed' | 'no_change',
        driversOnline: Number(r.drivers_online),
        triggeredBy: (r.triggered_by as string | null) ?? 'cron',
        reason: (r.reason as string | null) ?? null,
        createdAt: r.created_at as string,
      }) satisfies AutoHoursLogRow,
  );

  return {
    config,
    currentSignal: currentSignal.signalType,
    driversOnline,
    stats: {
      openEvents7d,
      closeEvents7d,
      totalEvents7d: openEvents7d + closeEvents7d,
    },
    recentEvents,
  };
}

// ── 4. Cron-Batch ─────────────────────────────────────────────────────────────

export async function checkAllLocations(): Promise<{
  locations: number;
  opened: number;
  closed: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: configs } = await sb
    .from('geofence_auto_hours_config')
    .select('location_id')
    .eq('is_enabled', true);

  const locationIds = (configs ?? []).map((r) => r.location_id as string);
  let opened = 0;
  let closed = 0;
  let errors = 0;

  await Promise.all(
    locationIds.map(async (locationId) => {
      try {
        const result = await checkAndToggleLocation(locationId);
        if (result.action === 'opened') opened++;
        if (result.action === 'closed') closed++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locationIds.length, opened, closed, errors };
}

// ── 5. Prune ──────────────────────────────────────────────────────────────────

export async function pruneOldLogs(days = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_geofence_auto_hours_log', { older_than_days: days });
  return (data as number | null) ?? 0;
}
