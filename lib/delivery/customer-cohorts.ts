/**
 * lib/delivery/customer-cohorts.ts
 *
 * Phase 227: Smart Customer Cohort Revenue Analysis Engine
 *
 * Groups customers by first-order month (acquisition cohort) and tracks
 * how many return in subsequent months and how much revenue they generate.
 *
 * Public API:
 *   buildCohortsForLocation(locationId)  — compute last 12 cohort months
 *   buildAllLocations()                  — cron batch
 *   getCohortDashboard(locationId)       — KPIs + retention matrix + best cohorts
 *   pruneOldSnapshots(daysToKeep)        — cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CohortSnapshot {
  locationId:        string;
  cohortMonth:       string;
  snapshotMonth:     string;
  monthsSinceCohort: number;
  cohortSize:        number;
  activeCustomers:   number;
  retentionRate:     number | null;
  revenueEur:        number;
  avgOrderValueEur:  number | null;
  ordersCount:       number;
}

export interface CohortRow {
  cohortMonth:      string;
  cohortSize:       number;
  retentionM0:      number | null;
  retentionM1:      number | null;
  retentionM3:      number | null;
  retentionM6:      number | null;
  totalRevenueEur:  number;
  ltvEur:           number | null;
  monthsTracked:    number;
}

export interface CohortMatrixCell {
  monthsSinceCohort: number;
  activeCustomers:   number;
  retentionRate:     number | null;
  revenueEur:        number;
}

export interface CohortMatrix {
  cohortMonth:  string;
  cohortSize:   number;
  cells:        CohortMatrixCell[];
}

export interface CohortDashboard {
  totalCohorts:        number;
  avgRetentionM1:      number | null;
  avgRetentionM3:      number | null;
  avgLtvEur:           number | null;
  newCustomersThisMonth: number;
  bestCohort:          CohortRow | null;
  cohortSummaries:     CohortRow[];
  retentionMatrix:     CohortMatrix[];
  computedAt:          string;
}

export interface BuildResult {
  locationId:      string;
  cohortsBuilt:    number;
  snapshotsUpserted: number;
  errors:          number;
}

export interface BatchResult {
  locations:        number;
  cohortsBuilt:     number;
  snapshotsUpserted: number;
  errors:           number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYYYYMM(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return toYYYYMM(d);
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// ── Core computation ──────────────────────────────────────────────────────────

interface RawOrder {
  kunde_telefon: string;
  gesamtbetrag:  number | null;
  created_at:    string;
}

export async function buildCohortsForLocation(locationId: string): Promise<BuildResult> {
  const sb = createServiceClient();
  const result: BuildResult = { locationId, cohortsBuilt: 0, snapshotsUpserted: 0, errors: 0 };

  // Load last 24 months of delivered orders
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);

  const { data: orders, error } = await sb
    .from('customer_orders')
    .select('kunde_telefon, gesamtbetrag, created_at')
    .eq('location_id', locationId)
    .not('kunde_telefon', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .in('order_status', ['delivered', 'completed', 'bezahlt'])
    .order('created_at', { ascending: true })
    .limit(50000) as { data: RawOrder[] | null; error: unknown };

  if (error || !orders?.length) return result;

  // Build per-customer first-order month (acquisition cohort)
  const firstOrderMonth = new Map<string, string>();
  for (const o of orders) {
    const phone = (o.kunde_telefon as string)?.trim();
    if (!phone) continue;
    const month = toYYYYMM(new Date(o.created_at));
    if (!firstOrderMonth.has(phone)) firstOrderMonth.set(phone, month);
  }

  // Determine all cohort months present (last 12 months max)
  const nowMonth = toYYYYMM(new Date());
  const twelveAgo = addMonths(nowMonth, -12);
  const cohortMonths = new Set<string>();
  for (const m of firstOrderMonth.values()) {
    if (m >= twelveAgo) cohortMonths.add(m);
  }

  if (cohortMonths.size === 0) return result;
  result.cohortsBuilt = cohortMonths.size;

  // For each cohort month, compute retention for each subsequent snapshot month
  const snapshotsToUpsert: Array<Record<string, unknown>> = [];

  for (const cohortMonth of cohortMonths) {
    // All phones in this cohort
    const cohortPhones = new Set<string>();
    for (const [phone, m] of firstOrderMonth.entries()) {
      if (m === cohortMonth) cohortPhones.add(phone);
    }
    const cohortSize = cohortPhones.size;
    if (cohortSize === 0) continue;

    // For each snapshot month from cohortMonth to nowMonth (max 12 months out)
    const maxMonths = Math.min(12, monthDiff(cohortMonth, nowMonth));
    for (let offset = 0; offset <= maxMonths; offset++) {
      const snapshotMonth = addMonths(cohortMonth, offset);
      if (snapshotMonth > nowMonth) break;

      // Collect orders from cohort members in this snapshot month
      const monthOrders = orders.filter((o) => {
        const phone = (o.kunde_telefon as string)?.trim();
        if (!cohortPhones.has(phone)) return false;
        return toYYYYMM(new Date(o.created_at)) === snapshotMonth;
      });

      const activePhones = new Set(monthOrders.map((o) => (o.kunde_telefon as string).trim()));
      const activeCustomers = activePhones.size;
      const revenue = monthOrders.reduce((s, o) => s + ((o.gesamtbetrag as number) ?? 0), 0);
      const orders_count = monthOrders.length;
      const retentionRate = cohortSize > 0 ? activeCustomers / cohortSize : null;
      const avgOrderValue = activeCustomers > 0 ? revenue / orders_count : null;

      snapshotsToUpsert.push({
        location_id:         locationId,
        cohort_month:        cohortMonth,
        snapshot_month:      snapshotMonth,
        months_since_cohort: offset,
        cohort_size:         cohortSize,
        active_customers:    activeCustomers,
        retention_rate:      retentionRate,
        revenue_eur:         Math.round(revenue * 100) / 100,
        avg_order_value_eur: avgOrderValue !== null ? Math.round(avgOrderValue * 100) / 100 : null,
        orders_count,
        computed_at:         new Date().toISOString(),
      });
    }
  }

  // Batch upsert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < snapshotsToUpsert.length; i += CHUNK) {
    const chunk = snapshotsToUpsert.slice(i, i + CHUNK);
    const { error: upsertErr } = await sb
      .from('customer_cohort_snapshots')
      .upsert(chunk, { onConflict: 'location_id,cohort_month,snapshot_month' });
    if (upsertErr) {
      result.errors++;
    } else {
      result.snapshotsUpserted += chunk.length;
    }
  }

  return result;
}

// ── Cron batch ────────────────────────────────────────────────────────────────

export async function buildAllLocations(): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  const batch: BatchResult = { locations: 0, cohortsBuilt: 0, snapshotsUpserted: 0, errors: 0 };
  if (!locations?.length) return batch;

  for (const loc of locations) {
    try {
      const r = await buildCohortsForLocation(loc.id as string);
      batch.locations++;
      batch.cohortsBuilt     += r.cohortsBuilt;
      batch.snapshotsUpserted += r.snapshotsUpserted;
      batch.errors           += r.errors;
    } catch {
      batch.errors++;
    }
  }
  return batch;
}

// ── Dashboard query ───────────────────────────────────────────────────────────

interface RawSummaryRow {
  cohort_month:      string;
  cohort_size:       number;
  retention_m0:      number | null;
  retention_m1:      number | null;
  retention_m3:      number | null;
  retention_m6:      number | null;
  total_revenue_eur: number;
  ltv_eur:           number | null;
  months_tracked:    number;
}

interface RawMatrixRow {
  cohort_month:        string;
  cohort_size:         number;
  months_since_cohort: number;
  active_customers:    number;
  retention_rate:      number | null;
  revenue_eur:         number;
}

export async function getCohortDashboard(locationId: string): Promise<CohortDashboard> {
  const sb = createServiceClient();
  const nowMonth = toYYYYMM(new Date());
  const twelveAgo = addMonths(nowMonth, -12);

  const [summaryRes, matrixRes, newCustRes] = await Promise.all([
    // cohort summary via view
    sb
      .from('v_cohort_summary')
      .select('cohort_month,cohort_size,retention_m0,retention_m1,retention_m3,retention_m6,total_revenue_eur,ltv_eur,months_tracked')
      .eq('location_id', locationId)
      .gte('cohort_month', twelveAgo)
      .order('cohort_month', { ascending: false })
      .limit(12),

    // raw matrix data for heatmap
    sb
      .from('customer_cohort_snapshots')
      .select('cohort_month,cohort_size,months_since_cohort,active_customers,retention_rate,revenue_eur')
      .eq('location_id', locationId)
      .gte('cohort_month', twelveAgo)
      .order('cohort_month', { ascending: false })
      .order('months_since_cohort', { ascending: true })
      .limit(500),

    // new customers this month (from customer_orders directly)
    sb
      .from('customer_orders')
      .select('kunde_telefon')
      .eq('location_id', locationId)
      .not('kunde_telefon', 'is', null)
      .gte('created_at', `${nowMonth}-01T00:00:00Z`)
      .in('order_status', ['delivered', 'completed', 'bezahlt'])
      .limit(5000),
  ]);

  // Parse summaries
  const summaries: CohortRow[] = ((summaryRes.data ?? []) as RawSummaryRow[]).map((r) => ({
    cohortMonth:     r.cohort_month,
    cohortSize:      r.cohort_size ?? 0,
    retentionM0:     r.retention_m0 !== null ? Math.round(r.retention_m0 * 1000) / 10 : null,
    retentionM1:     r.retention_m1 !== null ? Math.round(r.retention_m1 * 1000) / 10 : null,
    retentionM3:     r.retention_m3 !== null ? Math.round(r.retention_m3 * 1000) / 10 : null,
    retentionM6:     r.retention_m6 !== null ? Math.round(r.retention_m6 * 1000) / 10 : null,
    totalRevenueEur: r.total_revenue_eur ?? 0,
    ltvEur:          r.ltv_eur,
    monthsTracked:   r.months_tracked ?? 0,
  }));

  // Build retention matrix
  const matrixMap = new Map<string, CohortMatrix>();
  for (const row of ((matrixRes.data ?? []) as RawMatrixRow[])) {
    if (!matrixMap.has(row.cohort_month)) {
      matrixMap.set(row.cohort_month, { cohortMonth: row.cohort_month, cohortSize: row.cohort_size ?? 0, cells: [] });
    }
    matrixMap.get(row.cohort_month)!.cells.push({
      monthsSinceCohort: row.months_since_cohort,
      activeCustomers:   row.active_customers ?? 0,
      retentionRate:     row.retention_rate !== null ? Math.round((row.retention_rate as number) * 1000) / 10 : null,
      revenueEur:        row.revenue_eur ?? 0,
    });
  }
  const retentionMatrix = Array.from(matrixMap.values());

  // New customers this month (unique phones that had first order this month)
  const thisMonthPhones = new Set<string>();
  for (const row of ((newCustRes.data ?? []) as Array<{ kunde_telefon: string }>)) {
    const p = row.kunde_telefon?.trim();
    if (p) thisMonthPhones.add(p);
  }
  const newCustomersThisMonth = thisMonthPhones.size;

  // KPI aggregation
  const validM1 = summaries.filter((s) => s.retentionM1 !== null);
  const validM3 = summaries.filter((s) => s.retentionM3 !== null);
  const validLtv = summaries.filter((s) => s.ltvEur !== null);

  const avgRetentionM1 = validM1.length
    ? Math.round(validM1.reduce((s, r) => s + (r.retentionM1 ?? 0), 0) / validM1.length * 10) / 10
    : null;
  const avgRetentionM3 = validM3.length
    ? Math.round(validM3.reduce((s, r) => s + (r.retentionM3 ?? 0), 0) / validM3.length * 10) / 10
    : null;
  const avgLtvEur = validLtv.length
    ? Math.round(validLtv.reduce((s, r) => s + (r.ltvEur ?? 0), 0) / validLtv.length * 100) / 100
    : null;

  const bestCohort = summaries.reduce<CohortRow | null>((best, c) => {
    if (!best || (c.ltvEur ?? 0) > (best.ltvEur ?? 0)) return c;
    return best;
  }, null);

  return {
    totalCohorts: summaries.length,
    avgRetentionM1,
    avgRetentionM3,
    avgLtvEur,
    newCustomersThisMonth,
    bestCohort,
    cohortSummaries: summaries,
    retentionMatrix,
    computedAt: new Date().toISOString(),
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 730): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_cohort_snapshots', { days_to_keep: daysToKeep });
  if (error) return 0;
  return (data as number | null) ?? 0;
}
