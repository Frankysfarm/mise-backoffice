/**
 * lib/delivery/surge.ts
 *
 * Surge Pricing + Driver Incentive Engine — Phase 38
 *
 * Erkennt automatisch Nachfragespitzen und aktiviert dynamischen Aufpreis
 * auf die Liefergebühr sowie Bonus-Zahlungen an Fahrer.
 *
 * Ablauf im Cron-Tick:
 *  1. checkSurgeConditions()   — Triggers evaluieren
 *  2. activateSurge() /
 *     deactivateSurge()         — Surge-Event öffnen/schließen
 *  3. recordDriverBonus()       — Nach jeder Lieferung: Bonus schreiben
 *
 * Funktionen (public API):
 *  - evaluateSurge()           — Cron-Helfer: alle aktiven Locations prüfen
 *  - getCurrentSurge()         — Laufendes Event + Multiplikator (null = kein Surge)
 *  - getSurgeMultiplier()      — Effektiver Multiplikator (1.0 = kein Surge)
 *  - recordDriverSurgeBonus()  — Bonus nach Lieferung während Surge schreiben
 *  - getSurgeSummary()         — Admin-Dashboard: Status + Verlauf + Fahrer-Boni
 *  - configureSurgeRule()      — Regel anlegen / aktualisieren
 *  - listSurgeRules()          — Alle Regeln einer Location
 *  - manuallyActivateSurge()   — Admin: Surge manuell starten
 *  - manuallyDeactivateSurge() — Admin: Surge manuell beenden
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ──────────────────────────────────────────────────────────────────────────────
// Typen
// ──────────────────────────────────────────────────────────────────────────────

export interface SurgeRule {
  id: string;
  location_id: string;
  name: string;
  is_active: boolean;
  min_queue_depth: number;
  min_orders_per_hour: number;
  min_driver_utilization_pct: number;
  multiplier: number;
  driver_bonus_eur: number;
  active_from_utc: number;
  active_until_utc: number;
  active_weekdays: number[] | null;
  auto_stop_after_min: number;
  created_at: string;
  updated_at: string;
}

export interface SurgeEvent {
  id: string;
  location_id: string;
  rule_id: string | null;
  started_at: string;
  ended_at: string | null;
  trigger_queue_depth: number | null;
  trigger_orders_per_hour: number | null;
  trigger_utilization_pct: number | null;
  effective_multiplier: number;
  driver_bonus_eur: number;
  deliveries_during: number;
  total_bonus_paid_eur: number;
}

export interface SurgeStatus {
  isActive: boolean;
  multiplier: number;
  driverBonusEur: number;
  activeEventId: string | null;
  surgeStartedAt: string | null;
  currentQueueDepth: number;
  ordersPerHourEst: number;
  driverUtilizationPct: number;
  conditionsMet: boolean;
  inTimeWindow: boolean;
  ruleName: string | null;
}

export interface DriverSurgeBonus {
  id: string;
  driver_id: string;
  location_id: string;
  batch_id: string | null;
  order_id: string | null;
  surge_event_id: string | null;
  bonus_eur: number;
  multiplier: number | null;
  created_at: string;
}

export interface SurgeSummary {
  locationId: string;
  status: SurgeStatus;
  todayEvents: SurgeEvent[];
  topDriverBonuses: Array<{
    driver_id: string;
    driver_name: string;
    vehicle: string;
    total_bonus_today_eur: number;
    bonus_deliveries: number;
  }>;
  todayTotalBonusPaidEur: number;
  todayDeliveriesDuringSurge: number;
  surgeActivationsToday: number;
  generated_at: string;
}

export interface SurgeRuleInput {
  name?: string;
  is_active?: boolean;
  min_queue_depth?: number;
  min_orders_per_hour?: number;
  min_driver_utilization_pct?: number;
  multiplier?: number;
  driver_bonus_eur?: number;
  active_from_utc?: number;
  active_until_utc?: number;
  active_weekdays?: number[] | null;
  auto_stop_after_min?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Interner Service-Client (Singleton-Muster wie payout.ts / gps-tracker.ts)
// ──────────────────────────────────────────────────────────────────────────────

function getSb() {
  return createServiceClient();
}

// ──────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Lädt alle Surge-Regeln einer Location.
 */
export async function listSurgeRules(locationId: string): Promise<SurgeRule[]> {
  const sb = getSb();
  const { data, error } = await sb
    .from('delivery_surge_rules')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];   // Migration noch nicht ausgeführt
    throw error;
  }
  return (data ?? []) as SurgeRule[];
}

/**
 * Legt eine Surge-Regel an oder aktualisiert eine bestehende (upsert nach Name).
 */
export async function configureSurgeRule(
  locationId: string,
  input: SurgeRuleInput,
): Promise<SurgeRule> {
  const sb = getSb();

  // Validierung
  if (input.multiplier !== undefined && (input.multiplier < 1.0 || input.multiplier > 3.0)) {
    throw new Error('multiplier muss zwischen 1.0 und 3.0 liegen');
  }
  if (input.min_driver_utilization_pct !== undefined &&
      (input.min_driver_utilization_pct < 0 || input.min_driver_utilization_pct > 100)) {
    throw new Error('min_driver_utilization_pct muss zwischen 0 und 100 liegen');
  }

  const payload = {
    location_id: locationId,
    name: input.name ?? 'Standard Surge',
    is_active: input.is_active ?? true,
    min_queue_depth: input.min_queue_depth ?? 5,
    min_orders_per_hour: input.min_orders_per_hour ?? 8,
    min_driver_utilization_pct: input.min_driver_utilization_pct ?? 70,
    multiplier: input.multiplier ?? 1.25,
    driver_bonus_eur: input.driver_bonus_eur ?? 0.50,
    active_from_utc: input.active_from_utc ?? 0,
    active_until_utc: input.active_until_utc ?? 23,
    active_weekdays: input.active_weekdays ?? null,
    auto_stop_after_min: input.auto_stop_after_min ?? 30,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from('delivery_surge_rules')
    .upsert(payload, { onConflict: 'location_id,name' })
    .select()
    .single();

  if (error) throw error;
  return data as SurgeRule;
}

/**
 * Gibt den aktuellen Surge-Status einer Location zurück.
 * Graceful Fallback wenn Migration 032 fehlt.
 */
export async function getCurrentSurge(locationId: string): Promise<SurgeStatus> {
  const sb = getSb();

  const noSurge: SurgeStatus = {
    isActive: false,
    multiplier: 1.0,
    driverBonusEur: 0,
    activeEventId: null,
    surgeStartedAt: null,
    currentQueueDepth: 0,
    ordersPerHourEst: 0,
    driverUtilizationPct: 0,
    conditionsMet: false,
    inTimeWindow: false,
    ruleName: null,
  };

  try {
    const { data, error } = await sb
      .from('v_surge_status')
      .select('*')
      .eq('location_id', locationId)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) return noSurge;
      throw error;
    }

    if (!data) return noSurge;

    const row = data as Record<string, unknown>;
    const isActive = !!row['active_event_id'];

    return {
      isActive,
      multiplier: isActive
        ? (row['active_multiplier'] as number | null) ?? (row['multiplier'] as number ?? 1.0)
        : 1.0,
      driverBonusEur: (row['driver_bonus_eur'] as number | null) ?? 0,
      activeEventId: (row['active_event_id'] as string | null) ?? null,
      surgeStartedAt: (row['surge_started_at'] as string | null) ?? null,
      currentQueueDepth: (row['current_queue_depth'] as number | null) ?? 0,
      ordersPerHourEst: Number((row['orders_per_hour_est'] as number | null) ?? 0),
      driverUtilizationPct: (row['driver_utilization_pct'] as number | null) ?? 0,
      conditionsMet: !!(row['conditions_met']),
      inTimeWindow: !!(row['in_time_window']),
      ruleName: (row['name'] as string | null) ?? null,
    };
  } catch {
    return noSurge;
  }
}

/**
 * Gibt den effektiven Surge-Multiplikator zurück (1.0 = kein Surge).
 */
export async function getSurgeMultiplier(locationId: string): Promise<number> {
  const status = await getCurrentSurge(locationId);
  return status.multiplier;
}

/**
 * Aktiviert Surge für eine Location (öffnet ein Surge-Event).
 * Idempotent: wenn bereits ein Event offen ist, wird es zurückgegeben.
 */
async function activateSurge(
  locationId: string,
  ruleId: string,
  status: SurgeStatus,
  rule: SurgeRule,
): Promise<string> {
  const sb = getSb();

  // Bereits aktiv? Event-ID zurückgeben
  if (status.activeEventId) return status.activeEventId;

  const { data, error } = await sb
    .from('delivery_surge_events')
    .insert({
      location_id: locationId,
      rule_id: ruleId,
      effective_multiplier: rule.multiplier,
      driver_bonus_eur: rule.driver_bonus_eur,
      trigger_queue_depth: status.currentQueueDepth,
      trigger_orders_per_hour: status.ordersPerHourEst,
      trigger_utilization_pct: status.driverUtilizationPct,
    })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Beendet ein laufendes Surge-Event und aggregiert Ergebnisse.
 */
async function deactivateSurge(eventId: string): Promise<void> {
  const sb = getSb();

  // Aggregiere Boni + Lieferungen während des Events
  const { data: bonuses } = await sb
    .from('driver_surge_bonuses')
    .select('bonus_eur')
    .eq('surge_event_id', eventId);

  const totalBonus = (bonuses ?? []).reduce(
    (sum, b) => sum + Number((b as { bonus_eur: number }).bonus_eur),
    0,
  );
  const deliveries = (bonuses ?? []).length;

  await sb
    .from('delivery_surge_events')
    .update({
      ended_at: new Date().toISOString(),
      deliveries_during: deliveries,
      total_bonus_paid_eur: Math.round(totalBonus * 100) / 100,
    })
    .eq('id', eventId);
}

/**
 * Cron-Helfer: wertet Surge-Bedingungen für eine Location aus.
 * Aktiviert / deaktiviert Surge-Events automatisch.
 */
export async function evaluateSurgeForLocation(locationId: string): Promise<{
  wasActive: boolean;
  nowActive: boolean;
  multiplier: number;
  action: 'activated' | 'deactivated' | 'unchanged' | 'skipped';
}> {
  const result = { wasActive: false, nowActive: false, multiplier: 1.0, action: 'skipped' as const };

  try {
    const sb = getSb();

    // Regeln laden
    const rules = await listSurgeRules(locationId);
    const activeRules = rules.filter(r => r.is_active);
    if (activeRules.length === 0) return result;

    const status = await getCurrentSurge(locationId);
    result.wasActive = status.isActive;

    // Beste passende Regel finden (höchster Multiplikator bei erfüllten Bedingungen)
    const triggeredRule = activeRules
      .filter(() => status.conditionsMet && status.inTimeWindow)
      .sort((a, b) => b.multiplier - a.multiplier)[0] ?? null;

    // Auto-Deaktivierung: Surge aktiv aber Bedingungen nicht mehr erfüllt
    // + auto_stop_after_min überschritten
    if (status.isActive && !status.conditionsMet && status.activeEventId) {
      const surgeStartMs = status.surgeStartedAt
        ? new Date(status.surgeStartedAt).getTime()
        : 0;
      const activeSince = (Date.now() - surgeStartMs) / 60_000;

      // Lade Regel um auto_stop_after_min zu lesen
      const activeRule = activeRules[0];
      if (activeSince >= (activeRule?.auto_stop_after_min ?? 30)) {
        await deactivateSurge(status.activeEventId);
        return { wasActive: true, nowActive: false, multiplier: 1.0, action: 'deactivated' };
      }
      // Innerhalb Cooldown: Surge bleibt aktiv
      return { wasActive: true, nowActive: true, multiplier: status.multiplier, action: 'unchanged' };
    }

    // Surge aktivieren
    if (!status.isActive && triggeredRule) {
      await activateSurge(locationId, triggeredRule.id, status, triggeredRule);

      // Surge-Start ins Betriebslog schreiben
      try {
        await sb.from('delivery_operational_alerts').insert({
          location_id: locationId,
          alert_type: 'dispatch_queue_high',
          severity: 'info',
          message: `Surge aktiviert: ${triggeredRule.name} (×${triggeredRule.multiplier})`,
          details: {
            queue_depth: status.currentQueueDepth,
            orders_per_hour: Math.round(status.ordersPerHourEst),
            driver_utilization: status.driverUtilizationPct,
            multiplier: triggeredRule.multiplier,
          },
          auto_resolve: true,
        });
      } catch { /* Alert-Tabelle optional */ }

      return {
        wasActive: false,
        nowActive: true,
        multiplier: triggeredRule.multiplier,
        action: 'activated',
      };
    }

    // Keine Änderung
    return {
      wasActive: status.isActive,
      nowActive: status.isActive,
      multiplier: status.multiplier,
      action: 'unchanged',
    };
  } catch {
    return result;
  }
}

/**
 * Cron-Helfer: wertet Surge für alle aktiven Locations aus.
 */
export async function evaluateSurgeAllLocations(): Promise<{
  locations: number;
  activated: number;
  deactivated: number;
  active: number;
}> {
  const sb = getSb();
  const summary = { locations: 0, activated: 0, deactivated: 0, active: 0 };

  try {
    const { data: locs } = await sb
      .from('locations')
      .select('id')
      .eq('active', true)
      .limit(50);

    for (const loc of locs ?? []) {
      try {
        const r = await evaluateSurgeForLocation(loc.id as string);
        summary.locations++;
        if (r.action === 'activated') summary.activated++;
        if (r.action === 'deactivated') summary.deactivated++;
        if (r.nowActive) summary.active++;
      } catch { /* Isolation pro Location */ }
    }
  } catch { /* Graceful Fallback */ }

  return summary;
}

/**
 * Schreibt einen Fahrer-Surge-Bonus nach einer Lieferung.
 * Nur wenn ein aktives Surge-Event für die Location existiert.
 * Fire-and-forget geeignet.
 */
export async function recordDriverSurgeBonus(params: {
  driverId: string;
  locationId: string;
  batchId?: string;
  orderId?: string;
}): Promise<number> {
  const { driverId, locationId, batchId, orderId } = params;
  const sb = getSb();

  try {
    const status = await getCurrentSurge(locationId);
    if (!status.isActive || !status.activeEventId || status.driverBonusEur <= 0) return 0;

    const { error } = await sb.from('driver_surge_bonuses').insert({
      driver_id: driverId,
      location_id: locationId,
      batch_id: batchId ?? null,
      order_id: orderId ?? null,
      surge_event_id: status.activeEventId,
      bonus_eur: status.driverBonusEur,
      multiplier: status.multiplier,
    });

    if (error) return 0;
    return status.driverBonusEur;
  } catch {
    return 0;
  }
}

/**
 * Admin: Surge manuell aktivieren (übersteuert Regeln).
 */
export async function manuallyActivateSurge(
  locationId: string,
  multiplier: number,
  driverBonusEur: number,
): Promise<SurgeEvent> {
  const sb = getSb();

  if (multiplier < 1.0 || multiplier > 3.0) {
    throw new Error('multiplier muss zwischen 1.0 und 3.0 liegen');
  }

  // Bestehendes Event beenden
  const status = await getCurrentSurge(locationId);
  if (status.activeEventId) {
    await deactivateSurge(status.activeEventId);
  }

  const { data, error } = await sb
    .from('delivery_surge_events')
    .insert({
      location_id: locationId,
      rule_id: null,
      effective_multiplier: multiplier,
      driver_bonus_eur: driverBonusEur,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SurgeEvent;
}

/**
 * Admin: Aktiven Surge manuell beenden.
 */
export async function manuallyDeactivateSurge(locationId: string): Promise<boolean> {
  const status = await getCurrentSurge(locationId);
  if (!status.isActive || !status.activeEventId) return false;
  await deactivateSurge(status.activeEventId);
  return true;
}

/**
 * Admin-Dashboard: Surge-Status + Verlauf + Fahrer-Boni.
 * Graceful Fallback wenn Migration 032 fehlt.
 */
export async function getSurgeSummary(locationId: string): Promise<SurgeSummary> {
  const sb = getSb();

  const [status, eventsResult, driversResult] = await Promise.all([
    getCurrentSurge(locationId),
    sb
      .from('delivery_surge_events')
      .select('*')
      .eq('location_id', locationId)
      .gte('started_at',
        new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())
      .order('started_at', { ascending: false })
      .limit(20),
    sb
      .from('v_driver_surge_earnings')
      .select('*')
      .eq('location_id', locationId)
      .order('total_bonus_today_eur', { ascending: false })
      .limit(10),
  ]);

  const events = (eventsResult.data ?? []) as SurgeEvent[];
  const driverBonuses = (driversResult.data ?? []) as Array<{
    driver_id: string;
    driver_name: string;
    vehicle: string;
    total_bonus_today_eur: number;
    bonus_deliveries: number;
  }>;

  const todayTotalBonus = events.reduce(
    (sum, e) => sum + Number(e.total_bonus_paid_eur ?? 0), 0,
  );
  const todayDeliveries = events.reduce(
    (sum, e) => sum + Number(e.deliveries_during ?? 0), 0,
  );

  return {
    locationId,
    status,
    todayEvents: events,
    topDriverBonuses: driverBonuses,
    todayTotalBonusPaidEur: Math.round(todayTotalBonus * 100) / 100,
    todayDeliveriesDuringSurge: todayDeliveries,
    surgeActivationsToday: events.length,
    generated_at: new Date().toISOString(),
  };
}
