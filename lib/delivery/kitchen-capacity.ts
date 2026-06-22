/**
 * lib/delivery/kitchen-capacity.ts — Phase 407
 *
 * Kitchen Capacity Intelligence Engine — Echtzeit-Küchen-Kapazitäts-Monitor.
 *
 * Snapshots alle 2 Minuten:
 *  - Aktive Bestellungen (bestätigt + in_zubereitung) — Küche beschäftigt
 *  - Fertige Bestellungen (fertig) — wartet auf Abholung durch Fahrer
 *  - Bestelleingang letzte 60 Min
 *  - Durchschnittliche Prep-Zeit (aus kitchen_timings, letzte Stunde)
 *
 * Überlas-Score (0–100):
 *  A. Küchen-Last          (0–40): active_orders × avg_prep_min / 60 (% Stunden-Kapazität)
 *  B. Stau-Indikator       (0–25): ready_orders ohne Abholung > 5 Min
 *  C. Eingangsrate         (0–20): orders_last_hour vs. historischer Schnitt
 *  D. Prep-Überziehung     (0–15): % Bestellungen > 1.5× Ø Prep-Zeit
 *
 * Status-Schwellen:
 *  0–29   optimal   — Küche läuft problemlos
 *  30–59  busy      — erhöhte Last, kein Alarm
 *  60–79  overloaded — Überlast, Alert empfohlen
 *  80–100 circuit_open — Circuit-Breaker aktiv (manuell oder auto)
 *
 * Circuit-Breaker:
 *  - Auto-Aktivierung: overload_score ≥ 80 für 3 aufeinanderfolgende Ticks
 *  - Auto-Deaktivierung: nach durationMin (Standard 15 Min) oder manuell
 *  - Zweck: Dispatcher wissen, dass Küche am Limit ist → keine neuen Touren freigeben
 *
 * Public API:
 *   snapshotKitchenCapacity(locationId)   — Snapshot + Circuit-Breaker-Prüfung
 *   snapshotAllLocations()                — Cron-Batch
 *   getKitchenCapacityDashboard(locationId)   — Admin-Dashboard
 *   getKitchenCapacityTrend(locationId, hours?) — Stundenmittel 48h
 *   getCircuitBreakerState(locationId)    — Aktueller Circuit-Breaker-Zustand
 *   activateCircuitBreaker(params)        — Manuell aktivieren
 *   deactivateCircuitBreaker(locationId, reason) — Manuell deaktivieren
 *   pruneOldSnapshots(daysToKeep?)        — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Schwellwerte ──────────────────────────────────────────────────────────────

const OVERLOAD_CIRCUIT_OPEN       = 80;
const OVERLOAD_STATUS_OVERLOADED  = 60;
const OVERLOAD_STATUS_BUSY        = 30;
const AUTO_CIRCUIT_TRIGGER_TICKS  = 3;   // Ticks mit score ≥ 80 bevor auto-aktiviert
const DEFAULT_CIRCUIT_DURATION_MIN = 15; // Auto-Deaktivierung nach N Minuten
const DEFAULT_PREP_MIN_FALLBACK    = 18; // Fallback wenn keine Prep-Daten vorhanden
const STAU_THRESHOLD_MIN           = 5;  // Fertige Bestellungen > N Min → Stau

// ── Typen ─────────────────────────────────────────────────────────────────────

export type KitchenStatus = 'optimal' | 'busy' | 'overloaded' | 'circuit_open';

export interface KitchenCapacitySnapshot {
  id:                  string;
  locationId:          string;
  capturedAt:          string;
  activeOrders:        number;
  readyOrders:         number;
  ordersLastHour:      number;
  avgPrepMin:          number | null;
  maxPrepMin:          number | null;
  prepOverrunCount:    number;
  capacityPct:         number;
  overloadScore:       number;
  status:              KitchenStatus;
  circuitActive:       boolean;
}

export interface CircuitBreakerState {
  locationId:               string;
  isActive:                 boolean;
  activatedAt:              string | null;
  activatedBy:              string | null;
  autoDeactivateAt:         string | null;
  deactivatedAt:            string | null;
  deactivationReason:       string | null;
  reason:                   string | null;
  consecutiveOverloadTicks: number;
  totalActivations:         number;
  updatedAt:                string;
}

export interface KitchenCapacityDashboard {
  locationId:         string;
  generatedAt:        string;
  currentSnapshot:    KitchenCapacitySnapshot | null;
  circuitBreaker:     CircuitBreakerState | null;
  // Letzter Stunden-Rückblick
  last1h: {
    avgOverloadScore:  number;
    maxOverloadScore:  number;
    avgCapacityPct:    number;
    overloadedTicks:   number;
    snapshotCount:     number;
  } | null;
  // Prüfsumme Status-Häufigkeiten letzte 2h
  statusBreakdown: {
    optimal:     number;
    busy:        number;
    overloaded:  number;
    circuitOpen: number;
  };
}

export interface KitchenCapacityTrendRow {
  hourBucket:       string;  // ISO-Stunde
  avgActiveOrders:  number;
  avgReadyOrders:   number;
  avgCapacityPct:   number;
  avgOverloadScore: number;
  maxOverloadScore: number;
  snapshotCount:    number;
  overloadedTicks:  number;
  circuitActiveTicks: number;
}

export interface KitchenCapacityAllLocationsResult {
  locations:  number;
  saved:      number;
  errors:     number;
  circuitActivated: number;
  circuitDeactivated: number;
}

// ── Interne Hilfen ────────────────────────────────────────────────────────────

function classifyStatus(score: number, circuitActive: boolean): KitchenStatus {
  if (circuitActive) return 'circuit_open';
  if (score >= OVERLOAD_STATUS_OVERLOADED) return 'overloaded';
  if (score >= OVERLOAD_STATUS_BUSY)       return 'busy';
  return 'optimal';
}

function parseSnapshot(row: Record<string, unknown>): KitchenCapacitySnapshot {
  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    capturedAt:       row.captured_at as string,
    activeOrders:     (row.active_orders as number) ?? 0,
    readyOrders:      (row.ready_orders as number) ?? 0,
    ordersLastHour:   (row.orders_last_hour as number) ?? 0,
    avgPrepMin:       row.avg_prep_min != null ? Number(row.avg_prep_min) : null,
    maxPrepMin:       row.max_prep_min != null ? Number(row.max_prep_min) : null,
    prepOverrunCount: (row.prep_overrun_count as number) ?? 0,
    capacityPct:      Number(row.capacity_pct) ?? 0,
    overloadScore:    Number(row.overload_score) ?? 0,
    status:           (row.status as KitchenStatus) ?? 'optimal',
    circuitActive:    (row.circuit_active as boolean) ?? false,
  };
}

function parseCircuitBreaker(row: Record<string, unknown>): CircuitBreakerState {
  return {
    locationId:               row.location_id as string,
    isActive:                 (row.is_active as boolean) ?? false,
    activatedAt:              (row.activated_at as string | null) ?? null,
    activatedBy:              (row.activated_by as string | null) ?? null,
    autoDeactivateAt:         (row.auto_deactivate_at as string | null) ?? null,
    deactivatedAt:            (row.deactivated_at as string | null) ?? null,
    deactivationReason:       (row.deactivation_reason as string | null) ?? null,
    reason:                   (row.reason as string | null) ?? null,
    consecutiveOverloadTicks: (row.consecutive_overload_ticks as number) ?? 0,
    totalActivations:         (row.total_activations as number) ?? 0,
    updatedAt:                row.updated_at as string,
  };
}

// ── 1. Snapshot ───────────────────────────────────────────────────────────────

export async function snapshotKitchenCapacity(locationId: string): Promise<{
  snapshot: KitchenCapacitySnapshot;
  circuitActivated:   boolean;
  circuitDeactivated: boolean;
}> {
  const sb  = createServiceClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60_000).toISOString();
  const stauThreshold = new Date(now.getTime() - STAU_THRESHOLD_MIN * 60_000).toISOString();

  // Parallel: aktive + fertige Bestellungen + letzte Stunde + Prep-Zeiten + Circuit-Breaker
  const [
    activeRes,
    readyRes,
    lastHourRes,
    prepTimingRes,
    circuitRes,
    readyStauRes,
  ] = await Promise.all([
    // Aktive Bestellungen in Küche
    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung'])
      .eq('typ', 'lieferung'),

    // Fertige Bestellungen (Stau-Kandidaten)
    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('status', 'fertig')
      .eq('typ', 'lieferung'),

    // Eingangsrate letzte Stunde
    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', oneHourAgo),

    // Prep-Zeiten aus kitchen_timings (notified_at → ready_at, letzte Stunde)
    sb.from('kitchen_timings')
      .select('prep_min, ready_target, notified_at')
      .eq('location_id', locationId)
      .eq('status', 'ready')
      .gte('notified_at', oneHourAgo)
      .limit(100),

    // Aktueller Circuit-Breaker-Zustand
    sb.from('mise_kitchen_circuit_breaker')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    // Fertige Bestellungen, die schon länger als STAU_THRESHOLD_MIN warten
    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('status', 'fertig')
      .eq('typ', 'lieferung')
      .lte('fertig_am', stauThreshold),
  ]);

  const activeOrders   = activeRes.count ?? 0;
  const readyOrders    = readyRes.count  ?? 0;
  const ordersLastHour = lastHourRes.count ?? 0;

  // Prep-Zeit-Statistiken
  const prepRows = (prepTimingRes.data ?? []) as { prep_min: number | null }[];
  const prepMins = prepRows
    .map((r) => Number(r.prep_min ?? 0))
    .filter((m) => m > 0);

  const avgPrepMin  = prepMins.length > 0
    ? prepMins.reduce((s, m) => s + m, 0) / prepMins.length
    : null;
  const maxPrepMin  = prepMins.length > 0 ? Math.max(...prepMins) : null;
  const effAvgPrep  = avgPrepMin ?? DEFAULT_PREP_MIN_FALLBACK;
  const overrunCount = prepMins.filter((m) => m > effAvgPrep * 1.5).length;

  // ── Überlas-Score-Berechnung ──────────────────────────────────────────────

  // A. Küchen-Last (0–40): (activeOrders × avgPrepMin / 60) × 100 → clamp 0–40
  const loadFraction  = (activeOrders * effAvgPrep) / 60;
  const scoreA        = Math.min(40, Math.round(loadFraction * 40));

  // B. Stau-Indikator (0–25): fertige Bestellungen > STAU_THRESHOLD_MIN warten
  const stauOrders    = readyStauRes.count ?? 0;
  const scoreB        = Math.min(25, stauOrders * 5);

  // C. Eingangsrate (0–20): orders_last_hour > 12 (1 alle 5 Min) = max
  const scoreC        = Math.min(20, Math.round((ordersLastHour / 12) * 20));

  // D. Prep-Überziehung (0–15): % Bestellungen > 1.5× Ø
  const overrunPct    = prepMins.length > 0 ? overrunCount / prepMins.length : 0;
  const scoreD        = Math.min(15, Math.round(overrunPct * 15));

  const overloadScore = scoreA + scoreB + scoreC + scoreD;
  const capacityPct   = Math.min(100, Math.round(loadFraction * 100));

  // ── Circuit-Breaker-Logik ─────────────────────────────────────────────────

  let circuitActivated   = false;
  let circuitDeactivated = false;

  const cbRow       = circuitRes.data as Record<string, unknown> | null;
  const isCircuitOn = (cbRow?.is_active as boolean) ?? false;
  let   finalCircuitActive = isCircuitOn;

  const autoDeactivateAt = cbRow?.auto_deactivate_at as string | null;
  const consecutiveTicks = (cbRow?.consecutive_overload_ticks as number) ?? 0;

  // Auto-Deaktivierung wenn Ablaufzeit überschritten
  if (isCircuitOn && autoDeactivateAt && now.toISOString() > autoDeactivateAt) {
    await sb.from('mise_kitchen_circuit_breaker')
      .update({
        is_active:            false,
        deactivated_at:       now.toISOString(),
        deactivation_reason:  'auto_expired',
        consecutive_overload_ticks: 0,
        updated_at:           now.toISOString(),
      })
      .eq('location_id', locationId);
    finalCircuitActive  = false;
    circuitDeactivated  = true;
  }
  // Auto-Deaktivierung wenn Überlast verschwunden + Circuit aktiv (score < 60)
  else if (isCircuitOn && overloadScore < OVERLOAD_STATUS_OVERLOADED) {
    // Küche hat sich erholt → auto-deaktivieren
    await sb.from('mise_kitchen_circuit_breaker')
      .update({
        is_active:            false,
        deactivated_at:       now.toISOString(),
        deactivation_reason:  'auto_recovered',
        consecutive_overload_ticks: 0,
        updated_at:           now.toISOString(),
      })
      .eq('location_id', locationId);
    finalCircuitActive  = false;
    circuitDeactivated  = true;
  }
  // Tick-Counter aktualisieren + ggf. auto-aktivieren
  else if (!isCircuitOn) {
    const newTicks = overloadScore >= OVERLOAD_CIRCUIT_OPEN
      ? consecutiveTicks + 1
      : 0;

    if (newTicks >= AUTO_CIRCUIT_TRIGGER_TICKS) {
      // Auto-Aktivierung
      const deactivateAt = new Date(now.getTime() + DEFAULT_CIRCUIT_DURATION_MIN * 60_000);
      await sb.from('mise_kitchen_circuit_breaker').upsert({
        location_id:              locationId,
        is_active:                true,
        activated_at:             now.toISOString(),
        activated_by:             'auto',
        auto_deactivate_at:       deactivateAt.toISOString(),
        reason:                   `Überlas-Score ${overloadScore} für ${newTicks} Ticks ≥ ${OVERLOAD_CIRCUIT_OPEN}`,
        consecutive_overload_ticks: newTicks,
        total_activations:        ((cbRow?.total_activations as number) ?? 0) + 1,
        updated_at:               now.toISOString(),
      }, { onConflict: 'location_id' });
      finalCircuitActive = true;
      circuitActivated   = true;
    } else {
      // Nur Tick-Counter updaten
      await sb.from('mise_kitchen_circuit_breaker').upsert({
        location_id:              locationId,
        is_active:                false,
        consecutive_overload_ticks: newTicks,
        updated_at:               now.toISOString(),
      }, { onConflict: 'location_id' });
    }
  }

  const status = classifyStatus(overloadScore, finalCircuitActive);

  // ── Snapshot speichern ────────────────────────────────────────────────────

  const { data: saved, error } = await sb
    .from('mise_kitchen_capacity_snapshots')
    .insert({
      location_id:      locationId,
      captured_at:      now.toISOString(),
      active_orders:    activeOrders,
      ready_orders:     readyOrders,
      orders_last_hour: ordersLastHour,
      avg_prep_min:     avgPrepMin != null ? Math.round(avgPrepMin * 10) / 10 : null,
      max_prep_min:     maxPrepMin != null ? Math.round((maxPrepMin) * 10) / 10 : null,
      prep_overrun_count: overrunCount,
      capacity_pct:     capacityPct,
      overload_score:   overloadScore,
      status,
      circuit_active:   finalCircuitActive,
    })
    .select()
    .single();

  if (error || !saved) {
    throw new Error(`[kitchen-capacity] snapshotKitchenCapacity: ${error?.message ?? 'no data'}`);
  }

  return {
    snapshot:           parseSnapshot(saved as Record<string, unknown>),
    circuitActivated,
    circuitDeactivated,
  };
}

// ── 2. Alle Locations ─────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<KitchenCapacityAllLocationsResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('mise_locations')
    .select('id')
    .eq('is_active', true)
    .limit(200);

  const rows = (locs ?? []) as { id: string }[];
  let saved = 0, errors = 0, circuitActivated = 0, circuitDeactivated = 0;

  await Promise.allSettled(
    rows.map(async ({ id }) => {
      try {
        const res = await snapshotKitchenCapacity(id);
        saved++;
        if (res.circuitActivated)   circuitActivated++;
        if (res.circuitDeactivated) circuitDeactivated++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: rows.length, saved, errors, circuitActivated, circuitDeactivated };
}

// ── 3. Dashboard ──────────────────────────────────────────────────────────────

export async function getKitchenCapacityDashboard(locationId: string): Promise<KitchenCapacityDashboard> {
  const sb  = createServiceClient();
  const now = new Date();
  const oneHourAgo  = new Date(now.getTime() - 60 * 60_000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000).toISOString();

  const [latestRes, last1hRes, last2hRes, cbRes] = await Promise.all([
    // Aktuellster Snapshot
    sb.from('mise_kitchen_capacity_snapshots')
      .select('*')
      .eq('location_id', locationId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Aggregat letzte Stunde
    sb.from('mise_kitchen_capacity_snapshots')
      .select('overload_score, capacity_pct, status')
      .eq('location_id', locationId)
      .gte('captured_at', oneHourAgo),

    // Letzte 2 Stunden für Status-Breakdown
    sb.from('mise_kitchen_capacity_snapshots')
      .select('status')
      .eq('location_id', locationId)
      .gte('captured_at', twoHoursAgo),

    // Circuit-Breaker
    sb.from('mise_kitchen_circuit_breaker')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  const currentSnapshot = latestRes.data
    ? parseSnapshot(latestRes.data as Record<string, unknown>)
    : null;

  type Last1hRow = { overload_score: number | null; capacity_pct: number | null; status: string | null };
  type StatusRow  = { status: string | null };

  const last1hRows = (last1hRes.data ?? []) as Last1hRow[];
  const last1h = last1hRows.length > 0
    ? {
        avgOverloadScore:  Math.round(
          last1hRows.reduce((s: number, r: Last1hRow) => s + Number(r.overload_score ?? 0), 0) / last1hRows.length,
        ),
        maxOverloadScore:  Math.max(...last1hRows.map((r: Last1hRow) => Number(r.overload_score ?? 0))),
        avgCapacityPct:    Math.round(
          last1hRows.reduce((s: number, r: Last1hRow) => s + Number(r.capacity_pct ?? 0), 0) / last1hRows.length,
        ),
        overloadedTicks:   last1hRows.filter((r: Last1hRow) => r.status === 'overloaded' || r.status === 'circuit_open').length,
        snapshotCount:     last1hRows.length,
      }
    : null;

  const last2hRows = (last2hRes.data ?? []) as StatusRow[];
  const statusBreakdown = {
    optimal:     last2hRows.filter((r: StatusRow) => r.status === 'optimal').length,
    busy:        last2hRows.filter((r: StatusRow) => r.status === 'busy').length,
    overloaded:  last2hRows.filter((r: StatusRow) => r.status === 'overloaded').length,
    circuitOpen: last2hRows.filter((r: StatusRow) => r.status === 'circuit_open').length,
  };

  const circuitBreaker = cbRes.data
    ? parseCircuitBreaker(cbRes.data as Record<string, unknown>)
    : null;

  return {
    locationId,
    generatedAt:  now.toISOString(),
    currentSnapshot,
    circuitBreaker,
    last1h,
    statusBreakdown,
  };
}

// ── 4. Trend-Chart ────────────────────────────────────────────────────────────

export async function getKitchenCapacityTrend(
  locationId: string,
  hours: number = 24,
): Promise<KitchenCapacityTrendRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

  const { data } = await sb
    .from('v_kitchen_capacity_hourly')
    .select('*')
    .eq('location_id', locationId)
    .gte('hour_bucket', since)
    .order('hour_bucket', { ascending: false })
    .limit(hours + 2);

  type TrendRow = Record<string, unknown>;
  return ((data ?? []) as TrendRow[]).map((r) => ({
    hourBucket:         r.hour_bucket as string,
    avgActiveOrders:    Number(r.avg_active_orders ?? 0),
    avgReadyOrders:     Number(r.avg_ready_orders ?? 0),
    avgCapacityPct:     Number(r.avg_capacity_pct ?? 0),
    avgOverloadScore:   Number(r.avg_overload_score ?? 0),
    maxOverloadScore:   Number(r.max_overload_score ?? 0),
    snapshotCount:      Number(r.snapshot_count ?? 0),
    overloadedTicks:    Number(r.overloaded_ticks ?? 0),
    circuitActiveTicks: Number(r.circuit_active_ticks ?? 0),
  }));
}

// ── 5. Circuit-Breaker: aktueller Zustand ────────────────────────────────────

export async function getCircuitBreakerState(locationId: string): Promise<CircuitBreakerState | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('mise_kitchen_circuit_breaker')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  return data ? parseCircuitBreaker(data as Record<string, unknown>) : null;
}

// ── 6. Circuit-Breaker: Aktivieren ───────────────────────────────────────────

export async function activateCircuitBreaker(params: {
  locationId:  string;
  reason:      string;
  activatedBy: string;
  durationMin?: number;
}): Promise<CircuitBreakerState> {
  const sb = createServiceClient();
  const { locationId, reason, activatedBy, durationMin = DEFAULT_CIRCUIT_DURATION_MIN } = params;
  const now = new Date();
  const deactivateAt = new Date(now.getTime() + durationMin * 60_000);

  const { data, error } = await sb
    .from('mise_kitchen_circuit_breaker')
    .upsert(
      {
        location_id:              locationId,
        is_active:                true,
        activated_at:             now.toISOString(),
        activated_by:             activatedBy,
        auto_deactivate_at:       deactivateAt.toISOString(),
        reason,
        consecutive_overload_ticks: 0,
        deactivated_at:           null,
        deactivation_reason:      null,
        updated_at:               now.toISOString(),
      },
      { onConflict: 'location_id' },
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[kitchen-capacity] activateCircuitBreaker: ${error?.message ?? 'no data'}`);
  }

  // Snapshot erzeugen damit der Status sofort sichtbar ist
  await snapshotKitchenCapacity(locationId).catch(() => null);

  return parseCircuitBreaker(data as Record<string, unknown>);
}

// ── 7. Circuit-Breaker: Deaktivieren ─────────────────────────────────────────

export async function deactivateCircuitBreaker(
  locationId: string,
  reason: string,
): Promise<CircuitBreakerState> {
  const sb = createServiceClient();
  const now = new Date();

  const { data, error } = await sb
    .from('mise_kitchen_circuit_breaker')
    .upsert(
      {
        location_id:              locationId,
        is_active:                false,
        deactivated_at:           now.toISOString(),
        deactivation_reason:      reason,
        auto_deactivate_at:       null,
        consecutive_overload_ticks: 0,
        updated_at:               now.toISOString(),
      },
      { onConflict: 'location_id' },
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[kitchen-capacity] deactivateCircuitBreaker: ${error?.message ?? 'no data'}`);
  }

  // Snapshot erzeugen damit der Status sofort sichtbar ist
  await snapshotKitchenCapacity(locationId).catch(() => null);

  return parseCircuitBreaker(data as Record<string, unknown>);
}

// ── 8. Prune ──────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(
  daysToKeep: number = 7,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_kitchen_capacity_snapshots', {
    days_old: daysToKeep,
  });
  if (error) throw new Error(`[kitchen-capacity] pruneOldSnapshots: ${error.message}`);
  return { pruned: (data as number | null) ?? 0 };
}

// ── 9. Multi-Location Vergleich ───────────────────────────────────────────────

export interface LocationCapacityCard {
  locationId:    string;
  locationName:  string | null;
  overloadScore: number;
  status:        KitchenStatus;
  circuitActive: boolean;
  activeOrders:  number;
  readyOrders:   number;
  snapshotAge:   number; // Sekunden seit letztem Snapshot
}

export async function getMultiLocationCapacityComparison(): Promise<LocationCapacityCard[]> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('mise_locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(50);

  const locations = (locs ?? []) as { id: string; name: string | null }[];

  const cards = await Promise.all(
    locations.map(async ({ id, name }): Promise<LocationCapacityCard> => {
      const { data: snap } = await sb
        .from('mise_kitchen_capacity_snapshots')
        .select('overload_score, status, circuit_active, active_orders, ready_orders, captured_at')
        .eq('location_id', id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = Date.now();
      const age = snap?.captured_at
        ? Math.floor((now - new Date(snap.captured_at as string).getTime()) / 1000)
        : 9999;

      return {
        locationId:    id,
        locationName:  name,
        overloadScore: snap ? Number(snap.overload_score ?? 0) : 0,
        status:        (snap?.status as KitchenStatus | undefined) ?? 'optimal',
        circuitActive: (snap?.circuit_active as boolean | undefined) ?? false,
        activeOrders:  snap ? Number(snap.active_orders ?? 0) : 0,
        readyOrders:   snap ? Number(snap.ready_orders ?? 0) : 0,
        snapshotAge:   age,
      };
    }),
  );

  // Sortierung: circuit_open zuerst, dann nach overloadScore desc
  return cards.sort((a, b) => {
    if (a.circuitActive && !b.circuitActive) return -1;
    if (!a.circuitActive && b.circuitActive) return 1;
    return b.overloadScore - a.overloadScore;
  });
}

// ── 10. ML Feature Export ─────────────────────────────────────────────────────

export interface MLFeatureRow {
  capturedAt:         string;
  hourOfDay:          number;
  dayOfWeek:          number;
  activeOrders:       number;
  readyOrders:        number;
  ordersLastHour:     number;
  avgPrepMin:         number;
  maxPrepMin:         number;
  prepOverrunCount:   number;
  capacityPct:        number;
  overloadScore:      number;
  // Labels (what we want to predict in future)
  statusLabel:        string; // optimal/busy/overloaded/circuit_open
  circuitActive:      boolean;
}

export async function exportMLFeatures(
  locationId: string,
  hours: number = 168, // 7 Tage default
): Promise<MLFeatureRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

  const { data } = await sb
    .from('mise_kitchen_capacity_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })
    .limit(5000);

  type SnapRow = Record<string, unknown>;
  return ((data ?? []) as SnapRow[]).map((r) => {
    const ts = new Date(r.captured_at as string);
    return {
      capturedAt:       r.captured_at as string,
      hourOfDay:        ts.getUTCHours(),
      dayOfWeek:        ts.getUTCDay(),
      activeOrders:     Number(r.active_orders ?? 0),
      readyOrders:      Number(r.ready_orders ?? 0),
      ordersLastHour:   Number(r.orders_last_hour ?? 0),
      avgPrepMin:       Number(r.avg_prep_min ?? 18),
      maxPrepMin:       Number(r.max_prep_min ?? 18),
      prepOverrunCount: Number(r.prep_overrun_count ?? 0),
      capacityPct:      Number(r.capacity_pct ?? 0),
      overloadScore:    Number(r.overload_score ?? 0),
      statusLabel:      (r.status as string | null) ?? 'optimal',
      circuitActive:    (r.circuit_active as boolean | null) ?? false,
    };
  });
}
