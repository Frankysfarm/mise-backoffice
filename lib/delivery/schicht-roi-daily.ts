/**
 * lib/delivery/schicht-roi-daily.ts — Phase 377
 *
 * Schicht-ROI Tages-Snapshots: Umsatz, Kosten, Marge je Standort und Tag.
 *
 * Datenquellen:
 *  - customer_orders (bestellart=lieferung, geliefert/abgeschlossen) → Umsatz
 *  - driver_shifts (planned_start/end, base_wage_eur) → Kosten
 *
 * Public API:
 *  snapshotSchichtRoiDaily(locationId, date?)       — Tages-Snapshot berechnen + upserten
 *  snapshotSchichtRoiDailyAllLocations(date?)       — Cron-Batch für alle aktiven Standorte
 *  getSchichtRoiHistory(locationId, days)           — Trend-Daten für LineChart
 *  pruneSchichtRoiDaily(daysToKeep)                 — Cleanup alter Snapshots
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface SchichtRoiDailyRow {
  snapshotDate:          string;   // YYYY-MM-DD
  revenueEur:            number;
  deliveryFeeEur:        number;
  deliveryCount:         number;
  avgOrderValueEur:      number | null;
  activeDriverCount:     number;
  activeDriverHours:     number;
  estimatedCostEur:      number;
  revenuePerDriverHour:  number | null;
  costPerDelivery:       number | null;
  netMarginEur:          number | null;
  netMarginPct:          number | null;
  peakHour:              number | null;
}

export interface SnapshotResult {
  locationId: string;
  snapshotDate: string;
  saved: boolean;
  deliveryCount: number;
  revenueEur: number;
  netMarginEur: number | null;
}

export interface AllLocationsResult {
  locations: number;
  saved: number;
  errors: number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function toLocalDate(utcDate: Date, offsetH = 2): string {
  const local = new Date(utcDate.getTime() + offsetH * 3_600_000);
  return local.toISOString().slice(0, 10);
}

function dateRangeUtc(berlinDate: string): { from: string; to: string } {
  // Berlin = UTC+1 (Winter) / UTC+2 (Sommer). Approximation: UTC+1 für Sicherheitsspanne
  const from = new Date(`${berlinDate}T00:00:00+01:00`);
  const to   = new Date(`${berlinDate}T23:59:59+02:00`);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Kern-Snapshot ──────────────────────────────────────────────────────────────

export async function snapshotSchichtRoiDaily(
  locationId: string,
  date?: string,
): Promise<SnapshotResult> {
  const svc = createServiceClient();
  const snapshotDate = date ?? toLocalDate(new Date());
  const { from, to } = dateRangeUtc(snapshotDate);

  // ── 1. Lieferumsatz laden ────────────────────────────────────────────────────
  const { data: orders } = await svc
    .from('customer_orders')
    .select('gesamtbetrag, liefergebuehr, bestellt_am')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .gte('bestellt_am', from)
    .lte('bestellt_am', to);

  const rows = (orders ?? []) as {
    gesamtbetrag: number | null;
    liefergebuehr: number | null;
    bestellt_am: string | null;
  }[];

  const deliveryCount    = rows.length;
  const revenueEur       = rows.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);
  const deliveryFeeEur   = rows.reduce((s, r) => s + (r.liefergebuehr ?? 0), 0);
  const avgOrderValueEur = deliveryCount > 0 ? revenueEur / deliveryCount : null;

  // Peak-Stunde (Berliner Stunde mit den meisten Bestellungen)
  const hourCounts: Record<number, number> = {};
  for (const r of rows) {
    if (!r.bestellt_am) continue;
    const d = new Date(r.bestellt_am);
    const berlinH = (d.getUTCHours() + 2) % 24;
    hourCounts[berlinH] = (hourCounts[berlinH] ?? 0) + 1;
  }
  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [h, c] of Object.entries(hourCounts)) {
    if (c > peakCount) { peakCount = c; peakHour = Number(h); }
  }

  // ── 2. Fahrerschichten laden ─────────────────────────────────────────────────
  const { data: shifts } = await svc
    .from('driver_shifts')
    .select('planned_start, planned_end, base_wage_eur')
    .eq('location_id', locationId)
    .gte('planned_start', from)
    .lte('planned_start', to);

  const shiftRows = (shifts ?? []) as {
    planned_start: string | null;
    planned_end: string | null;
    base_wage_eur: number | null;
  }[];

  let activeDriverHours = 0;
  let estimatedCostEur  = 0;
  const activeDriverCount = shiftRows.length;

  for (const s of shiftRows) {
    if (!s.planned_start || !s.planned_end) continue;
    const durationH = (new Date(s.planned_end).getTime() - new Date(s.planned_start).getTime()) / 3_600_000;
    const clampedH  = Math.max(0, Math.min(durationH, 16)); // max 16h Schutz
    activeDriverHours += clampedH;
    estimatedCostEur  += clampedH * (s.base_wage_eur ?? 12); // Fallback: 12€/h
  }

  // ── 3. KPIs berechnen ───────────────────────────────────────────────────────
  const revenuePerDriverHour = activeDriverHours > 0
    ? Math.round((revenueEur / activeDriverHours) * 100) / 100
    : null;

  const costPerDelivery = deliveryCount > 0
    ? Math.round((estimatedCostEur / deliveryCount) * 100) / 100
    : null;

  const netMarginEur = revenueEur - estimatedCostEur;

  const netMarginPct = revenueEur > 0
    ? Math.round((netMarginEur / revenueEur) * 10_000) / 100
    : null;

  // ── 4. Upsert ───────────────────────────────────────────────────────────────
  const { error } = await svc.from('schicht_roi_daily').upsert(
    {
      location_id:             locationId,
      snapshot_date:           snapshotDate,
      revenue_eur:             Math.round(revenueEur * 100) / 100,
      delivery_fee_eur:        Math.round(deliveryFeeEur * 100) / 100,
      delivery_count:          deliveryCount,
      avg_order_value_eur:     avgOrderValueEur !== null ? Math.round(avgOrderValueEur * 100) / 100 : null,
      active_driver_count:     activeDriverCount,
      active_driver_hours:     Math.round(activeDriverHours * 100) / 100,
      estimated_cost_eur:      Math.round(estimatedCostEur * 100) / 100,
      revenue_per_driver_hour: revenuePerDriverHour,
      cost_per_delivery:       costPerDelivery,
      net_margin_eur:          Math.round(netMarginEur * 100) / 100,
      net_margin_pct:          netMarginPct,
      peak_hour:               peakHour,
    },
    { onConflict: 'location_id,snapshot_date' },
  );

  return {
    locationId,
    snapshotDate,
    saved: !error,
    deliveryCount,
    revenueEur: Math.round(revenueEur * 100) / 100,
    netMarginEur: Math.round(netMarginEur * 100) / 100,
  };
}

// ── Cron-Batch ─────────────────────────────────────────────────────────────────

export async function snapshotSchichtRoiDailyAllLocations(date?: string): Promise<AllLocationsResult> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true)
    .limit(50);

  const results = await Promise.allSettled(
    (locs ?? []).map((l) => snapshotSchichtRoiDaily((l as { id: string }).id, date)),
  );

  let saved = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.saved) saved++;
    else errors++;
  }
  return { locations: (locs ?? []).length, saved, errors };
}

// ── History (Trend-Chart) ──────────────────────────────────────────────────────

export async function getSchichtRoiHistory(
  locationId: string,
  days = 30,
): Promise<SchichtRoiDailyRow[]> {
  const svc = createServiceClient();
  const limitDays = Math.min(90, Math.max(7, days));

  const { data, error } = await svc
    .from('schicht_roi_daily')
    .select([
      'snapshot_date',
      'revenue_eur',
      'delivery_fee_eur',
      'delivery_count',
      'avg_order_value_eur',
      'active_driver_count',
      'active_driver_hours',
      'estimated_cost_eur',
      'revenue_per_driver_hour',
      'cost_per_delivery',
      'net_margin_eur',
      'net_margin_pct',
      'peak_hour',
    ].join(','))
    .eq('location_id', locationId)
    .gte('snapshot_date', new Date(Date.now() - limitDays * 86_400_000).toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];

  return (data as unknown as Record<string, unknown>[]).map((r) => ({
    snapshotDate:          r.snapshot_date as string,
    revenueEur:            Number(r.revenue_eur ?? 0),
    deliveryFeeEur:        Number(r.delivery_fee_eur ?? 0),
    deliveryCount:         Number(r.delivery_count ?? 0),
    avgOrderValueEur:      r.avg_order_value_eur != null ? Number(r.avg_order_value_eur) : null,
    activeDriverCount:     Number(r.active_driver_count ?? 0),
    activeDriverHours:     Number(r.active_driver_hours ?? 0),
    estimatedCostEur:      Number(r.estimated_cost_eur ?? 0),
    revenuePerDriverHour:  r.revenue_per_driver_hour != null ? Number(r.revenue_per_driver_hour) : null,
    costPerDelivery:       r.cost_per_delivery != null ? Number(r.cost_per_delivery) : null,
    netMarginEur:          r.net_margin_eur != null ? Number(r.net_margin_eur) : null,
    netMarginPct:          r.net_margin_pct != null ? Number(r.net_margin_pct) : null,
    peakHour:              r.peak_hour != null ? Number(r.peak_hour) : null,
  }));
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export async function pruneSchichtRoiDaily(daysToKeep = 180): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_schicht_roi_daily', { days_to_keep: daysToKeep });
  if (error) return { pruned: 0 };
  return { pruned: (data as number | null) ?? 0 };
}

// ── Gap-Fill Hardening (Phase 396) ────────────────────────────────────────────

export interface GapFillResult {
  locationId:  string;
  daysChecked: number;
  gapsFilled:  number;
  errors:      number;
}

export interface GapFillAllLocationsResult {
  locations:  number;
  gapsFilled: number;
  errors:     number;
}

/**
 * Prüft die letzten `daysBack` Tage für einen Standort.
 * Fehlt ein Snapshot, wird er berechnet und in schicht_roi_daily gespeichert.
 * Jeder Catch-up wird in schicht_roi_gap_fill_log protokolliert.
 */
export async function catchupSchichtRoiDaily(
  locationId: string,
  daysBack = 3,
  triggeredBy = 'cron',
): Promise<GapFillResult> {
  const svc = createServiceClient();
  const today = toLocalDate(new Date());

  // Bestehende Snapshots der letzten N Tage laden
  const dates: string[] = [];
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const { data: existing } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date')
    .eq('location_id', locationId)
    .in('snapshot_date', dates);

  const existingSet = new Set((existing ?? []).map((r: { snapshot_date: string }) => r.snapshot_date));
  const missing = dates.filter(d => !existingSet.has(d) && d < today);

  if (missing.length === 0) return { locationId, daysChecked: daysBack, gapsFilled: 0, errors: 0 };

  let gapsFilled = 0;
  let errors = 0;

  for (const missingDate of missing) {
    try {
      const result = await snapshotSchichtRoiDaily(locationId, missingDate);
      if (result.saved) {
        gapsFilled++;
        // Gap-Fill-Log (idempotent via UNIQUE constraint)
        await svc.from('schicht_roi_gap_fill_log').upsert(
          { location_id: locationId, fill_date: missingDate, triggered_by: triggeredBy },
          { onConflict: 'location_id,fill_date,triggered_by', ignoreDuplicates: true },
        );
      }
    } catch {
      errors++;
    }
  }

  return { locationId, daysChecked: daysBack, gapsFilled, errors };
}

/**
 * Catch-up für alle aktiven Standorte — Cron-Batch.
 */
export async function catchupSchichtRoiDailyAllLocations(
  daysBack = 3,
): Promise<GapFillAllLocationsResult> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, gapsFilled: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map(l => catchupSchichtRoiDaily(l.id, daysBack)),
  );

  const gapsFilled = results
    .filter((r): r is PromiseFulfilledResult<GapFillResult> => r.status === 'fulfilled')
    .reduce((s, r) => s + r.value.gapsFilled, 0);

  const errors = results.filter(r => r.status === 'rejected').length;
  return { locations: locs.length, gapsFilled, errors };
}
