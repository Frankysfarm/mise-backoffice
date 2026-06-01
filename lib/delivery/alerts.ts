/**
 * lib/delivery/alerts.ts
 *
 * Operational Alerts Engine — Phase 20
 *
 * Evaluiert in jedem Cron-Tick konfigurierbare Schwellenwerte
 * und erstellt / löst Betriebsalarme automatisch auf.
 *
 * Alert-Typen:
 *  - dispatch_queue_high    — >N Lieferbestellungen seit >W Min ohne Fahrer
 *  - no_drivers_online      — Null aktive Fahrer im System
 *  - kitchen_overload       — >N Bestellungen gleichzeitig in Zubereitung
 *  - stale_orders_critical  — >N Bestellungen seit >W Min nicht zugewiesen
 *  - eta_accuracy_low       — On-Time-Rate < N% (letzten 50 Lieferungen)
 *
 * Funktionen:
 *  - getAlertRules()             — Regeln laden (mit Default-Seed)
 *  - upsertAlertRule()           — Regel speichern / überschreiben
 *  - getActiveAlerts()           — Aktive (unaufgelöste) Alarme
 *  - getAlertHistory()           — Alarm-Verlauf (alle)
 *  - resolveAlert()              — Alarm manuell auflösen
 *  - evaluateAlerts()            — Alle Regeln einer Location prüfen
 *  - evaluateAlertsAllLocations() — Cron-Helfer: alle aktiven Locations
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export type AlertType =
  | 'dispatch_queue_high'
  | 'no_drivers_online'
  | 'kitchen_overload'
  | 'stale_orders_critical'
  | 'eta_accuracy_low';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  location_id: string;
  alert_type: AlertType;
  threshold_value: number;
  window_minutes: number;
  severity: AlertSeverity;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAlert {
  id: string;
  location_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown> | null;
  auto_resolve: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface AlertEvalResult {
  location_id: string;
  created: number;
  resolved: number;
}

// ============================================================
// Default-Regeln (werden beim ersten Aufruf pro Location geseedet)
// ============================================================

const DEFAULT_RULES: Array<Omit<AlertRule, 'id' | 'location_id' | 'created_at' | 'updated_at'>> = [
  { alert_type: 'dispatch_queue_high',   threshold_value: 5,  window_minutes: 5,  severity: 'warning',  enabled: true },
  { alert_type: 'no_drivers_online',     threshold_value: 0,  window_minutes: 0,  severity: 'critical', enabled: true },
  { alert_type: 'kitchen_overload',      threshold_value: 10, window_minutes: 5,  severity: 'warning',  enabled: true },
  { alert_type: 'stale_orders_critical', threshold_value: 3,  window_minutes: 15, severity: 'critical', enabled: true },
  { alert_type: 'eta_accuracy_low',      threshold_value: 70, window_minutes: 0,  severity: 'warning',  enabled: true },
];

// ============================================================
// CRUD
// ============================================================

/**
 * Lädt Alert-Regeln für eine Location.
 * Seeded Default-Regeln wenn noch keine vorhanden.
 */
export async function getAlertRules(locationId: string): Promise<AlertRule[]> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('delivery_alert_rules')
    .select('*')
    .eq('location_id', locationId)
    .order('alert_type');

  if (existing?.length) return existing as AlertRule[];

  const rows = DEFAULT_RULES.map((r) => ({ ...r, location_id: locationId }));
  const { data: inserted } = await sb
    .from('delivery_alert_rules')
    .insert(rows)
    .select();

  return (inserted ?? []) as AlertRule[];
}

/**
 * Speichert oder überschreibt eine Alert-Regel (UPSERT).
 */
export async function upsertAlertRule(
  rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>,
): Promise<AlertRule> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_alert_rules')
    .upsert(
      { ...rule, updated_at: new Date().toISOString() },
      { onConflict: 'location_id,alert_type' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AlertRule;
}

/**
 * Aktive (nicht aufgelöste) Alarme einer Location.
 */
export async function getActiveAlerts(locationId: string): Promise<DeliveryAlert[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_alerts')
    .select('*')
    .eq('location_id', locationId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  return (data ?? []) as DeliveryAlert[];
}

/**
 * Alarm-Verlauf (aktive + aufgelöste), neueste zuerst.
 */
export async function getAlertHistory(
  locationId: string,
  limit = 50,
): Promise<DeliveryAlert[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_alerts')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as DeliveryAlert[];
}

/**
 * Alarm manuell auflösen.
 */
export async function resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('delivery_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', alertId)
    .is('resolved_at', null);
}

// ============================================================
// Interne Helfer
// ============================================================

type SB = ReturnType<typeof createServiceClient>;

/**
 * Neuen Alarm anlegen — dedupliziert (nur einer pro Typ gleichzeitig aktiv).
 * Gibt true zurück wenn ein neuer Alarm erstellt wurde.
 */
async function fireAlert(
  sb: SB,
  locationId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  message: string,
  details: Record<string, unknown>,
): Promise<boolean> {
  const { count } = await sb
    .from('delivery_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('alert_type', alertType)
    .is('resolved_at', null);

  if ((count ?? 0) > 0) return false; // already active

  const { error } = await sb.from('delivery_alerts').insert({
    location_id:  locationId,
    alert_type:   alertType,
    severity,
    message,
    details,
    auto_resolve: true,
  });

  return !error;
}

/**
 * Alarm automatisch auflösen wenn die Bedingung nicht mehr zutrifft.
 * Gibt true zurück wenn mindestens ein Alarm aufgelöst wurde.
 */
async function autoResolve(
  sb: SB,
  locationId: string,
  alertType: AlertType,
  conditionActive: boolean,
): Promise<boolean> {
  if (conditionActive) return false;

  const { data } = await sb
    .from('delivery_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: 'auto' })
    .eq('location_id', locationId)
    .eq('alert_type', alertType)
    .is('resolved_at', null)
    .select('id');

  return (data?.length ?? 0) > 0;
}

// ============================================================
// Condition Checkers
// ============================================================

async function checkDispatchQueueHigh(
  sb: SB,
  locationId: string,
  rule: AlertRule,
): Promise<{ fired: boolean; resolved: boolean }> {
  const windowAgo = new Date(Date.now() - rule.window_minutes * 60_000).toISOString();

  const { count } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .not('status', 'in', '(storniert,abgeschlossen,geliefert)')
    .lte('created_at', windowAgo);

  const pending = count ?? 0;
  const isActive = pending >= rule.threshold_value;

  const resolved = await autoResolve(sb, locationId, 'dispatch_queue_high', isActive);
  if (!isActive) return { fired: false, resolved };

  const fired = await fireAlert(
    sb, locationId, 'dispatch_queue_high', rule.severity,
    `${pending} Lieferbestellungen seit >${rule.window_minutes} Min ohne Fahrer`,
    { pending_count: pending, threshold: rule.threshold_value, window_minutes: rule.window_minutes },
  );
  return { fired, resolved };
}

async function checkNoDriversOnline(
  sb: SB,
  locationId: string,
  rule: AlertRule,
): Promise<{ fired: boolean; resolved: boolean }> {
  const { count } = await sb
    .from('mise_drivers')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']);

  const onlineCount = count ?? 0;
  const isActive = onlineCount === 0;

  const resolved = await autoResolve(sb, locationId, 'no_drivers_online', isActive);
  if (!isActive) return { fired: false, resolved };

  const fired = await fireAlert(
    sb, locationId, 'no_drivers_online', rule.severity,
    'Keine aktiven Fahrer online',
    { online_count: 0 },
  );
  return { fired, resolved };
}

async function checkKitchenOverload(
  sb: SB,
  locationId: string,
  rule: AlertRule,
): Promise<{ fired: boolean; resolved: boolean }> {
  const windowAgo = new Date(Date.now() - rule.window_minutes * 60_000).toISOString();

  const { count } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'in_zubereitung')
    .lte('created_at', windowAgo);

  const inPrep = count ?? 0;
  const isActive = inPrep >= rule.threshold_value;

  const resolved = await autoResolve(sb, locationId, 'kitchen_overload', isActive);
  if (!isActive) return { fired: false, resolved };

  const fired = await fireAlert(
    sb, locationId, 'kitchen_overload', rule.severity,
    `${inPrep} Bestellungen seit >${rule.window_minutes} Min in Zubereitung (Schwelle: ${rule.threshold_value})`,
    { in_prep_count: inPrep, threshold: rule.threshold_value, window_minutes: rule.window_minutes },
  );
  return { fired, resolved };
}

async function checkStaleOrdersCritical(
  sb: SB,
  locationId: string,
  rule: AlertRule,
): Promise<{ fired: boolean; resolved: boolean }> {
  const staleThreshold = new Date(Date.now() - rule.window_minutes * 60_000).toISOString();

  const { count } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .not('status', 'in', '(storniert,abgeschlossen,geliefert)')
    .lte('created_at', staleThreshold);

  const stale = count ?? 0;
  const isActive = stale >= rule.threshold_value;

  const resolved = await autoResolve(sb, locationId, 'stale_orders_critical', isActive);
  if (!isActive) return { fired: false, resolved };

  const fired = await fireAlert(
    sb, locationId, 'stale_orders_critical', rule.severity,
    `${stale} Bestellungen seit >${rule.window_minutes} Min ohne Zuweisung`,
    { stale_count: stale, threshold: rule.threshold_value, window_minutes: rule.window_minutes },
  );
  return { fired, resolved };
}

async function checkEtaAccuracyLow(
  sb: SB,
  locationId: string,
  rule: AlertRule,
): Promise<{ fired: boolean; resolved: boolean }> {
  const { data } = await sb
    .from('delivery_performance')
    .select('on_time')
    .eq('location_id', locationId)
    .order('recorded_at', { ascending: false })
    .limit(50);

  // Mindestens 10 Datenpunkte für verlässliche Aussage
  if (!data?.length || data.length < 10) return { fired: false, resolved: false };

  const onTimeRate = (data.filter((r) => r.on_time).length / data.length) * 100;
  const isActive = onTimeRate < rule.threshold_value;

  const resolved = await autoResolve(sb, locationId, 'eta_accuracy_low', isActive);
  if (!isActive) return { fired: false, resolved };

  const fired = await fireAlert(
    sb, locationId, 'eta_accuracy_low', rule.severity,
    `ETA-Genauigkeit bei ${Math.round(onTimeRate)}% — unter Schwelle ${rule.threshold_value}%`,
    {
      on_time_rate: Math.round(onTimeRate * 10) / 10,
      threshold: rule.threshold_value,
      sample_size: data.length,
    },
  );
  return { fired, resolved };
}

// ============================================================
// Haupt-Evaluator
// ============================================================

/**
 * Prüft alle aktiven Alert-Regeln einer Location.
 * Erstellt neue Alarme und löst behobene automatisch auf.
 */
export async function evaluateAlerts(locationId: string): Promise<AlertEvalResult> {
  const sb = createServiceClient();
  const rules = await getAlertRules(locationId);
  const enabled = rules.filter((r) => r.enabled);

  let created = 0;
  let resolved = 0;

  for (const rule of enabled) {
    try {
      let result = { fired: false, resolved: false };

      switch (rule.alert_type) {
        case 'dispatch_queue_high':
          result = await checkDispatchQueueHigh(sb, locationId, rule); break;
        case 'no_drivers_online':
          result = await checkNoDriversOnline(sb, locationId, rule); break;
        case 'kitchen_overload':
          result = await checkKitchenOverload(sb, locationId, rule); break;
        case 'stale_orders_critical':
          result = await checkStaleOrdersCritical(sb, locationId, rule); break;
        case 'eta_accuracy_low':
          result = await checkEtaAccuracyLow(sb, locationId, rule); break;
      }

      if (result.fired) created++;
      if (result.resolved) resolved++;
    } catch {
      // Einzelregel-Fehler blockieren die anderen Regeln nicht
    }
  }

  return { location_id: locationId, created, resolved };
}

/**
 * Alert-Evaluation für alle aktiven Locations (Cron-Helfer, fire-and-forget).
 */
export async function evaluateAlertsAllLocations(): Promise<{
  locations: number;
  created: number;
  resolved: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb.from('locations').select('id').eq('active', true);
  if (!locations?.length) return { locations: 0, created: 0, resolved: 0 };

  const results = await Promise.allSettled(
    locations.map((loc) => evaluateAlerts(loc.id)),
  );

  let totalCreated = 0;
  let totalResolved = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalCreated += r.value.created;
      totalResolved += r.value.resolved;
    }
  }

  return { locations: locations.length, created: totalCreated, resolved: totalResolved };
}
