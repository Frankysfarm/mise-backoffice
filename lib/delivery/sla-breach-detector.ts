/**
 * lib/delivery/sla-breach-detector.ts
 *
 * SLA Breach Detector — Phase 256
 *
 * Erkennt Bestellungen, bei denen die zugesagte Lieferzeit (eta_latest)
 * um mehr als BREACH_THRESHOLD_MIN (10 Min) überschritten wurde.
 *
 * Schweregrade:
 *  warning  — 10–24 Min zu spät
 *  critical — ≥ 25 Min zu spät
 *
 * Läuft jeden Cron-Tick via detectSlaBreachesAllLocations().
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Konstanten ────────────────────────────────────────────────────────────────

const BREACH_THRESHOLD_MIN = 10;
const CRITICAL_THRESHOLD_MIN = 25;
const TERMINAL_STATUSES = ['geliefert', 'abgeschlossen', 'storniert', 'cancelled'];

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface SlaBreachRecord {
  id: string;
  locationId: string;
  orderId: string;
  driverId: string | null;
  batchId: string | null;
  bestellnummer: string | null;
  severity: 'warning' | 'critical';
  delayMin: number;
  etaLatestAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DetectResult {
  locationId: string;
  detected: number;
  resolved: number;
  errors: number;
}

export interface DetectAllResult {
  locations: number;
  totalDetected: number;
  totalResolved: number;
  errors: number;
}

export interface SlaBreachDashboard {
  activeBreaches: SlaBreachRecord[];
  totalActive: number;
  criticalCount: number;
  warningCount: number;
  oldestBreachMinutes: number | null;
}

// ── Kern-Detektion ───────────────────────────────────────────────────────────

/**
 * Scannt alle aktiven Lieferungen einer Location.
 * Erstellt neue Breach-Records für Bestellungen die ETA+10min überschritten.
 * Löst bestehende Breaches auf wenn die Bestellung geliefert/storniert wurde.
 */
export async function detectSlaBreachesForLocation(locationId: string): Promise<DetectResult> {
  const sb = createServiceClient();
  let detected = 0;
  let resolved = 0;
  let errors = 0;

  const nowMs = Date.now();
  const breachCutoff = new Date(nowMs - BREACH_THRESHOLD_MIN * 60_000).toISOString();

  // 1. Aktive Bestellungen mit überschrittener ETA (noch nicht geliefert)
  const { data: overdueOrders, error: fetchErr } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, eta_latest, mise_driver_id, mise_batch_id, status')
    .eq('typ', 'lieferung')
    .eq('location_id', locationId)
    .not('eta_latest', 'is', null)
    .lt('eta_latest', breachCutoff)
    .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .limit(50);

  if (fetchErr) {
    // Graceful: Fallback falls location_id Spalte noch anders heißt
    errors++;
  } else {
    for (const order of overdueOrders ?? []) {
      const delayMin = Math.round(
        (nowMs - new Date(order.eta_latest as string).getTime()) / 60_000,
      );
      const severity: 'warning' | 'critical' =
        delayMin >= CRITICAL_THRESHOLD_MIN ? 'critical' : 'warning';

      const { error: upsertErr } = await sb.from('sla_breaches').upsert(
        {
          location_id:    locationId,
          order_id:       order.id,
          driver_id:      order.mise_driver_id ?? null,
          batch_id:       order.mise_batch_id ?? null,
          bestellnummer:  order.bestellnummer ?? null,
          severity,
          delay_min:      delayMin,
          eta_latest_at:  order.eta_latest,
          escalated_at:   null,
          resolved_at:    null,
        },
        {
          onConflict: 'order_id',
          ignoreDuplicates: false,
        },
      );

      if (upsertErr) {
        errors++;
      } else {
        detected++;
      }
    }
  }

  // 2. Bestehende offene Breaches auflösen, wenn Bestellung jetzt terminal ist
  const { data: openBreaches, error: openErr } = await sb
    .from('sla_breaches')
    .select('id, order_id')
    .eq('location_id', locationId)
    .is('resolved_at', null)
    .limit(100);

  if (!openErr && openBreaches && openBreaches.length > 0) {
    const orderIds = openBreaches.map((b) => b.order_id as string);

    const { data: terminalOrders } = await sb
      .from('customer_orders')
      .select('id, status')
      .in('id', orderIds)
      .in('status', TERMINAL_STATUSES);

    const terminalSet = new Set((terminalOrders ?? []).map((o) => o.id as string));

    const toResolve = openBreaches
      .filter((b) => terminalSet.has(b.order_id as string))
      .map((b) => b.id as string);

    if (toResolve.length > 0) {
      const { error: resolveErr } = await sb
        .from('sla_breaches')
        .update({ resolved_at: new Date().toISOString() })
        .in('id', toResolve);

      if (!resolveErr) resolved += toResolve.length;
    }
  }

  return { locationId, detected, resolved, errors };
}

/** Läuft alle aktiven Locations durch. */
export async function detectSlaBreachesAllLocations(): Promise<DetectAllResult> {
  const sb = createServiceClient();

  const { data: locations, error } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (error || !locations) {
    return { locations: 0, totalDetected: 0, totalResolved: 0, errors: 1 };
  }

  const results = await Promise.allSettled(
    locations.map((loc) => detectSlaBreachesForLocation(loc.id as string)),
  );

  let totalDetected = 0;
  let totalResolved = 0;
  let errors = 0;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalDetected += r.value.detected;
      totalResolved += r.value.resolved;
      errors += r.value.errors;
    } else {
      errors++;
    }
  }

  return { locations: locations.length, totalDetected, totalResolved, errors };
}

// ── Dashboard-Abfrage ─────────────────────────────────────────────────────────

export async function getSlaBreachDashboard(locationId: string): Promise<SlaBreachDashboard> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('sla_breaches')
    .select('*')
    .eq('location_id', locationId)
    .is('resolved_at', null)
    .order('delay_min', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const activeBreaches: SlaBreachRecord[] = rows.map((r) => ({
    id:            r.id as string,
    locationId:    r.location_id as string,
    orderId:       r.order_id as string,
    driverId:      (r.driver_id as string | null) ?? null,
    batchId:       (r.batch_id as string | null) ?? null,
    bestellnummer: (r.bestellnummer as string | null) ?? null,
    severity:      r.severity as 'warning' | 'critical',
    delayMin:      r.delay_min as number,
    etaLatestAt:   (r.eta_latest_at as string | null) ?? null,
    escalatedAt:   (r.escalated_at as string | null) ?? null,
    resolvedAt:    (r.resolved_at as string | null) ?? null,
    createdAt:     r.created_at as string,
  }));

  const criticalCount = activeBreaches.filter((b) => b.severity === 'critical').length;
  const warningCount  = activeBreaches.filter((b) => b.severity === 'warning').length;
  const oldest        = activeBreaches.length > 0
    ? Math.max(...activeBreaches.map((b) => b.delayMin))
    : null;

  return {
    activeBreaches,
    totalActive:         activeBreaches.length,
    criticalCount,
    warningCount,
    oldestBreachMinutes: oldest,
  };
}

// ── Mutation ──────────────────────────────────────────────────────────────────

export async function resolveSlaBreach(
  breachId: string,
  locationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('sla_breaches')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', breachId)
    .eq('location_id', locationId)
    .is('resolved_at', null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Wartung ───────────────────────────────────────────────────────────────────

/** Entfernt aufgelöste Breaches die älter als `days` Tage sind. */
export async function pruneOldSlaBreaches(days = 30): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('sla_breaches')
    .delete()
    .not('resolved_at', 'is', null)
    .lt('resolved_at', cutoff)
    .select('id');

  return { pruned: (data ?? []).length };
}
