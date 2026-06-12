/**
 * lib/delivery/sla-escalation.ts
 *
 * SLA-Eskalation — Phase 75
 *
 * Prüft die On-Time-Rate der letzten 20 abgeschlossenen Lieferungen pro Location.
 * Feuert einen kritischen Alarm wenn die Rate unter den Schwellenwert (Standard 80%) fällt.
 * Löst den Alarm automatisch auf wenn die Rate wieder über den Schwellenwert steigt.
 *
 * Nutzt die bestehende delivery_alerts-Tabelle mit Alert-Typ 'sla_critical'.
 * Ergänzt evaluateAlerts() um die neue Regel und fügt Default-Regel ins Seeding ein.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface SlaEscalationResult {
  location_id: string;
  on_time_rate: number | null;
  threshold: number;
  fired: boolean;
  resolved: boolean;
  sample_size: number;
}

const SLA_CRITICAL_TYPE = 'sla_critical' as const;
const DEFAULT_THRESHOLD = 80;
const MIN_SAMPLE_SIZE = 5;

/**
 * Prüft die SLA (On-Time-Rate) einer Location und eskaliert bei Unterschreitung.
 * Feuert einen kritischen `sla_critical`-Alarm — separat vom bestehenden `eta_accuracy_low` (70%-Warnung).
 *
 * Schwellenwert: 80% Standard (konfigurierbar via threshold-Parameter).
 * Stichprobe: letzte 20 abgeschlossene Lieferungen mit ETA-Daten.
 */
export async function checkSlaEscalation(
  locationId: string,
  threshold = DEFAULT_THRESHOLD,
): Promise<SlaEscalationResult> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('delivery_performance')
    .select('on_time')
    .eq('location_id', locationId)
    .not('eta_latest_at', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(20);

  const rows = data ?? [];
  if (rows.length < MIN_SAMPLE_SIZE) {
    return { location_id: locationId, on_time_rate: null, threshold, fired: false, resolved: false, sample_size: rows.length };
  }

  const onTimeRate = (rows.filter((r) => r.on_time === true).length / rows.length) * 100;
  const isBelow = onTimeRate < threshold;

  // Prüfen ob ein offener sla_critical-Alarm für diese Location existiert
  const { data: existing } = await sb
    .from('delivery_alerts')
    .select('id')
    .eq('location_id', locationId)
    .eq('alert_type', SLA_CRITICAL_TYPE)
    .is('resolved_at', null)
    .maybeSingle();

  let fired = false;
  let resolved = false;

  if (isBelow && !existing) {
    // Neuen Alarm anlegen
    const { error } = await sb.from('delivery_alerts').insert({
      location_id: locationId,
      alert_type:  SLA_CRITICAL_TYPE,
      severity:    'critical',
      message:     `SLA-Alarm: On-Time-Rate bei ${Math.round(onTimeRate)}% — unter Schwelle ${threshold}%`,
      details: {
        on_time_rate:  Math.round(onTimeRate * 10) / 10,
        threshold,
        sample_size:   rows.length,
        escalated_at:  new Date().toISOString(),
      },
      auto_resolve: true,
    });
    if (!error) fired = true;
  } else if (!isBelow && existing) {
    // Alarm auto-auflösen da SLA sich erholt hat
    const { error } = await sb
      .from('delivery_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (!error) resolved = true;
  }

  return {
    location_id: locationId,
    on_time_rate: Math.round(onTimeRate * 10) / 10,
    threshold,
    fired,
    resolved,
    sample_size: rows.length,
  };
}

export interface SlaEscalationSummary {
  locations_checked: number;
  escalated: number;
  resolved: number;
  below_threshold: Array<{ location_id: string; on_time_rate: number; threshold: number }>;
}

/**
 * Prüft alle aktiven Locations auf SLA-Unterschreitung.
 * Cron-Helfer — fire-and-forget kompatibel.
 */
export async function runSlaEscalationAllLocations(
  threshold = DEFAULT_THRESHOLD,
): Promise<SlaEscalationSummary> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locations?.length) {
    return { locations_checked: 0, escalated: 0, resolved: 0, below_threshold: [] };
  }

  const results = await Promise.allSettled(
    locations.map((loc) => checkSlaEscalation(loc.id as string, threshold)),
  );

  let escalated = 0;
  let resolved = 0;
  const belowThreshold: SlaEscalationSummary['below_threshold'] = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    if (r.value.fired) escalated++;
    if (r.value.resolved) resolved++;
    if (r.value.on_time_rate !== null && r.value.on_time_rate < threshold) {
      belowThreshold.push({
        location_id: r.value.location_id,
        on_time_rate: r.value.on_time_rate,
        threshold,
      });
    }
  }

  return {
    locations_checked: locations.length,
    escalated,
    resolved,
    below_threshold: belowThreshold,
  };
}

/**
 * Lädt alle aktiven SLA-Alarme einer Location.
 * Für das Admin-Dashboard.
 */
export async function getActiveSlaEscalations(locationId: string): Promise<Array<{
  id: string;
  message: string;
  on_time_rate: number | null;
  threshold: number | null;
  created_at: string;
}>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_alerts')
    .select('id, message, details, created_at')
    .eq('location_id', locationId)
    .eq('alert_type', SLA_CRITICAL_TYPE)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  return (data ?? []).map((row) => {
    const details = (row.details as Record<string, unknown> | null) ?? {};
    return {
      id:           row.id as string,
      message:      row.message as string,
      on_time_rate: typeof details.on_time_rate === 'number' ? details.on_time_rate : null,
      threshold:    typeof details.threshold    === 'number' ? details.threshold    : null,
      created_at:   row.created_at as string,
    };
  });
}
