/**
 * lib/delivery/tour-feedback-analytics.ts
 *
 * Phase 360 — Tour Feedback Aggregation + Management Report Engine
 *
 * Aggregiert tour_feedback pro Fahrer wöchentlich/monatlich in tour_feedback_aggregates.
 * Liefert Management-Reports mit Trend-Daten für Admin-Dashboards.
 *
 * Exports:
 *  aggregateTourFeedbackForLocation(locationId, periodType, periodStart?)
 *  aggregateTourFeedbackAllLocations(periodType?)
 *  getFeedbackManagementReport(locationId, months)
 *  getDriverFeedbackProfile(locationId, driverId, weeks)
 *  getTourFeedbackAnalyticsDashboard(locationId)
 *  pruneOldFeedbackAggregates(daysOld?)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type FeedbackPeriodType = 'week' | 'month';

export interface FeedbackAggregate {
  id: string;
  locationId: string;
  driverId: string;
  periodType: FeedbackPeriodType;
  periodStart: string;          // YYYY-MM-DD
  avgDifficulty: number | null;
  avgTraffic: number | null;
  avgCustomerRating: number | null;
  avgOverallScore: number | null;
  feedbackCount: number;
  parkingIssueRate: number | null;
  navIssueRate: number | null;
  addressIssueRate: number | null;
  customerIssueRate: number | null;
  topZone: string | null;
  computedAt: string;
}

export interface MonthlyReportEntry {
  month: string;                // YYYY-MM
  periodStart: string;          // YYYY-MM-DD
  avgCustomerRating: number;
  avgDifficulty: number;
  avgTraffic: number;
  avgOverallScore: number;
  totalFeedbacks: number;
  parkingIssueRate: number;
  navIssueRate: number;
  addressIssueRate: number;
  customerIssueRate: number;
  activeDrivers: number;
}

export interface DriverFeedbackProfileEntry {
  periodStart: string;
  periodType: FeedbackPeriodType;
  avgCustomerRating: number | null;
  avgDifficulty: number | null;
  avgOverallScore: number | null;
  feedbackCount: number;
  topZone: string | null;
}

export interface FeedbackAnalyticsDashboard {
  kpis: {
    avgCustomerRatingThisWeek: number;
    avgCustomerRatingLastWeek: number;
    ratingTrend: number;           // delta
    totalFeedbacksThisWeek: number;
    avgDifficultyThisWeek: number;
    activeDriversWithFeedback: number;
    topRatedDriverName: string | null;
    topRatedScore: number | null;
  };
  monthlyTrend: MonthlyReportEntry[];
  topDrivers: Array<{ driverId: string; driverName: string | null; avgRating: number; feedbackCount: number }>;
  bottomDrivers: Array<{ driverId: string; driverName: string | null; avgRating: number; feedbackCount: number }>;
}

export interface AggregateResult {
  locationId: string;
  driversAggregated: number;
  rowsUpserted: number;
  errors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function svc() {
  return createServiceClient();
}

function getPeriodStart(periodType: FeedbackPeriodType, referenceDate?: Date): string {
  const d = referenceDate ?? new Date();
  if (periodType === 'week') {
    const day = d.getUTCDay(); // 0=Sun
    const diff = (day === 0 ? 6 : day - 1); // Mon=0
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - diff);
    return mon.toISOString().slice(0, 10);
  }
  // month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function getPeriodStartNMonthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function toMonth(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function mapAggregate(r: Record<string, unknown>): FeedbackAggregate {
  return {
    id:                 r.id as string,
    locationId:         r.location_id as string,
    driverId:           r.driver_id as string,
    periodType:         r.period_type as FeedbackPeriodType,
    periodStart:        r.period_start as string,
    avgDifficulty:      r.avg_difficulty != null ? Number(r.avg_difficulty) : null,
    avgTraffic:         r.avg_traffic != null ? Number(r.avg_traffic) : null,
    avgCustomerRating:  r.avg_customer_rating != null ? Number(r.avg_customer_rating) : null,
    avgOverallScore:    r.avg_overall_score != null ? Number(r.avg_overall_score) : null,
    feedbackCount:      Number(r.feedback_count ?? 0),
    parkingIssueRate:   r.parking_issue_rate != null ? Number(r.parking_issue_rate) : null,
    navIssueRate:       r.nav_issue_rate != null ? Number(r.nav_issue_rate) : null,
    addressIssueRate:   r.address_issue_rate != null ? Number(r.address_issue_rate) : null,
    customerIssueRate:  r.customer_issue_rate != null ? Number(r.customer_issue_rate) : null,
    topZone:            r.top_zone as string | null,
    computedAt:         r.computed_at as string,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export async function aggregateTourFeedbackForLocation(
  locationId: string,
  periodType: FeedbackPeriodType = 'week',
  referenceDate?: Date,
): Promise<AggregateResult> {
  const sb = svc();
  const periodStart = getPeriodStart(periodType, referenceDate);

  // Compute period end date
  let periodEnd: string;
  if (periodType === 'week') {
    const d = new Date(periodStart);
    d.setUTCDate(d.getUTCDate() + 7);
    periodEnd = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(periodStart);
    d.setUTCMonth(d.getUTCMonth() + 1);
    periodEnd = d.toISOString().slice(0, 10);
  }

  // Load tour_feedback rows for this period + location, joined with batch for zone
  let feedbackRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await sb
      .from('tour_feedback')
      .select('driver_id, difficulty_rating, traffic_rating, customer_rating, overall_score, had_parking_issue, had_customer_issue, had_nav_issue, had_address_issue, submitted_at, batch_id')
      .eq('location_id', locationId)
      .gte('submitted_at', periodStart)
      .lt('submitted_at', periodEnd);
    feedbackRows = (data ?? []) as Array<Record<string, unknown>>;
  } catch {
    return { locationId, driversAggregated: 0, rowsUpserted: 0, errors: 1 };
  }

  if (feedbackRows.length === 0) {
    return { locationId, driversAggregated: 0, rowsUpserted: 0, errors: 0 };
  }

  // Load zone info from mise_delivery_batches for batch_ids
  const batchIds = [...new Set(feedbackRows.map((r) => r.batch_id as string).filter(Boolean))];
  const zoneMap = new Map<string, string>();
  if (batchIds.length > 0) {
    try {
      const { data: batches } = await sb
        .from('mise_delivery_batches')
        .select('id, zone')
        .in('id', batchIds);
      for (const b of batches ?? []) {
        if (b.zone) zoneMap.set(b.id as string, b.zone as string);
      }
    } catch { /* zone data is optional */ }
  }

  // Group by driver
  type DriverStats = {
    difficulty: number[];
    traffic: number[];
    customerRating: number[];
    overallScore: number[];
    parking: number;
    customer: number;
    nav: number;
    address: number;
    total: number;
    zones: Record<string, number>;
  };

  const byDriver = new Map<string, DriverStats>();

  for (const row of feedbackRows) {
    const driverId = row.driver_id as string;
    if (!driverId) continue;

    if (!byDriver.has(driverId)) {
      byDriver.set(driverId, {
        difficulty: [], traffic: [], customerRating: [], overallScore: [],
        parking: 0, customer: 0, nav: 0, address: 0, total: 0, zones: {},
      });
    }
    const s = byDriver.get(driverId)!;
    s.total++;
    if (row.difficulty_rating != null) s.difficulty.push(Number(row.difficulty_rating));
    if (row.traffic_rating != null) s.traffic.push(Number(row.traffic_rating));
    if (row.customer_rating != null) s.customerRating.push(Number(row.customer_rating));
    if (row.overall_score != null) s.overallScore.push(Number(row.overall_score));
    if (row.had_parking_issue) s.parking++;
    if (row.had_customer_issue) s.customer++;
    if (row.had_nav_issue) s.nav++;
    if (row.had_address_issue) s.address++;
    const zone = zoneMap.get(row.batch_id as string);
    if (zone) s.zones[zone] = (s.zones[zone] ?? 0) + 1;
  }

  const avg = (arr: number[]): number | null =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
  const rate = (count: number, total: number): number | null =>
    total === 0 ? null : Math.round((count / total) * 10000) / 100;
  const topZone = (zones: Record<string, number>): string | null => {
    const entries = Object.entries(zones);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  // Upsert aggregates for each driver
  let rowsUpserted = 0;
  let errors = 0;

  for (const [driverId, s] of byDriver.entries()) {
    const row = {
      location_id:          locationId,
      driver_id:            driverId,
      period_type:          periodType,
      period_start:         periodStart,
      avg_difficulty:       avg(s.difficulty),
      avg_traffic:          avg(s.traffic),
      avg_customer_rating:  avg(s.customerRating),
      avg_overall_score:    avg(s.overallScore),
      feedback_count:       s.total,
      parking_issue_rate:   rate(s.parking, s.total),
      nav_issue_rate:       rate(s.nav, s.total),
      address_issue_rate:   rate(s.address, s.total),
      customer_issue_rate:  rate(s.customer, s.total),
      top_zone:             topZone(s.zones),
      computed_at:          new Date().toISOString(),
    };

    const { error } = await sb
      .from('tour_feedback_aggregates')
      .upsert(row, { onConflict: 'location_id,driver_id,period_type,period_start' });

    if (error) {
      if (error.message.includes('tour_feedback_aggregates')) errors++;
    } else {
      rowsUpserted++;
    }
  }

  return { locationId, driversAggregated: byDriver.size, rowsUpserted, errors };
}

export async function aggregateTourFeedbackAllLocations(
  periodType: FeedbackPeriodType = 'week',
): Promise<{ locations: number; aggregated: number; errors: number }> {
  const sb = svc();
  const { data: locs } = await sb.from('locations').select('id');
  if (!locs?.length) return { locations: 0, aggregated: 0, errors: 0 };

  let totalAgg = 0;
  let totalErr = 0;

  await Promise.allSettled(locs.map(async (l) => {
    try {
      const r = await aggregateTourFeedbackForLocation(l.id as string, periodType);
      totalAgg += r.rowsUpserted;
      totalErr += r.errors;
    } catch {
      totalErr++;
    }
  }));

  return { locations: locs.length, aggregated: totalAgg, errors: totalErr };
}

// ── Management Report ─────────────────────────────────────────────────────────

export async function getFeedbackManagementReport(
  locationId: string,
  months = 3,
): Promise<MonthlyReportEntry[]> {
  const sb = svc();
  const since = getPeriodStartNMonthsAgo(months);

  try {
    const { data, error } = await sb
      .from('tour_feedback_aggregates')
      .select('period_start, avg_customer_rating, avg_difficulty, avg_traffic, avg_overall_score, feedback_count, parking_issue_rate, nav_issue_rate, address_issue_rate, customer_issue_rate, driver_id')
      .eq('location_id', locationId)
      .eq('period_type', 'month')
      .gte('period_start', since)
      .order('period_start', { ascending: true });

    if (error || !data) return [];

    // Group by month, aggregate across drivers
    const byMonth = new Map<string, {
      ratings: number[]; difficulty: number[]; traffic: number[]; overall: number[];
      feedbacks: number; parking: number[]; nav: number[]; address: number[]; customer: number[];
      drivers: Set<string>;
    }>();

    for (const row of data) {
      const month = toMonth(row.period_start as string);
      if (!byMonth.has(month)) {
        byMonth.set(month, {
          ratings: [], difficulty: [], traffic: [], overall: [],
          feedbacks: 0, parking: [], nav: [], address: [], customer: [],
          drivers: new Set(),
        });
      }
      const m = byMonth.get(month)!;
      if (row.avg_customer_rating != null) m.ratings.push(Number(row.avg_customer_rating));
      if (row.avg_difficulty != null) m.difficulty.push(Number(row.avg_difficulty));
      if (row.avg_traffic != null) m.traffic.push(Number(row.avg_traffic));
      if (row.avg_overall_score != null) m.overall.push(Number(row.avg_overall_score));
      if (row.parking_issue_rate != null) m.parking.push(Number(row.parking_issue_rate));
      if (row.nav_issue_rate != null) m.nav.push(Number(row.nav_issue_rate));
      if (row.address_issue_rate != null) m.address.push(Number(row.address_issue_rate));
      if (row.customer_issue_rate != null) m.customer.push(Number(row.customer_issue_rate));
      m.feedbacks += Number(row.feedback_count ?? 0);
      m.drivers.add(row.driver_id as string);
    }

    const avgArr = (arr: number[]): number =>
      arr.length === 0 ? 0 : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;

    const result: MonthlyReportEntry[] = [];
    for (const [month, m] of byMonth.entries()) {
      result.push({
        month,
        periodStart:       `${month}-01`,
        avgCustomerRating: avgArr(m.ratings),
        avgDifficulty:     avgArr(m.difficulty),
        avgTraffic:        avgArr(m.traffic),
        avgOverallScore:   avgArr(m.overall),
        totalFeedbacks:    m.feedbacks,
        parkingIssueRate:  avgArr(m.parking),
        navIssueRate:      avgArr(m.nav),
        addressIssueRate:  avgArr(m.address),
        customerIssueRate: avgArr(m.customer),
        activeDrivers:     m.drivers.size,
      });
    }
    return result.sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    return [];
  }
}

// ── Driver Profile ────────────────────────────────────────────────────────────

export async function getDriverFeedbackProfile(
  locationId: string,
  driverId: string,
  weeks = 8,
): Promise<DriverFeedbackProfileEntry[]> {
  const sb = svc();
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  const since = d.toISOString().slice(0, 10);

  try {
    const { data, error } = await sb
      .from('tour_feedback_aggregates')
      .select('period_start, period_type, avg_customer_rating, avg_difficulty, avg_overall_score, feedback_count, top_zone')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .eq('period_type', 'week')
      .gte('period_start', since)
      .order('period_start', { ascending: true });

    if (error || !data) return [];

    return data.map((r) => ({
      periodStart:       r.period_start as string,
      periodType:        r.period_type as FeedbackPeriodType,
      avgCustomerRating: r.avg_customer_rating != null ? Number(r.avg_customer_rating) : null,
      avgDifficulty:     r.avg_difficulty != null ? Number(r.avg_difficulty) : null,
      avgOverallScore:   r.avg_overall_score != null ? Number(r.avg_overall_score) : null,
      feedbackCount:     Number(r.feedback_count ?? 0),
      topZone:           r.top_zone as string | null,
    }));
  } catch {
    return [];
  }
}

// ── Analytics Dashboard ───────────────────────────────────────────────────────

export async function getTourFeedbackAnalyticsDashboard(
  locationId: string,
): Promise<FeedbackAnalyticsDashboard> {
  const sb = svc();

  const thisWeek = getPeriodStart('week');
  const d = new Date(thisWeek);
  d.setUTCDate(d.getUTCDate() - 7);
  const lastWeek = d.toISOString().slice(0, 10);

  // Load this week + last week aggregates
  let thisWeekRows: Array<Record<string, unknown>> = [];
  let lastWeekRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await sb
      .from('tour_feedback_aggregates')
      .select('driver_id, period_start, avg_customer_rating, avg_difficulty, feedback_count')
      .eq('location_id', locationId)
      .eq('period_type', 'week')
      .in('period_start', [thisWeek, lastWeek]);
    for (const r of data ?? []) {
      if ((r.period_start as string) === thisWeek) thisWeekRows.push(r);
      else lastWeekRows.push(r);
    }
  } catch { /* graceful */ }

  const avgRating = (rows: Array<Record<string, unknown>>): number => {
    const vals = rows.map((r) => Number(r.avg_customer_rating ?? 0)).filter((v) => v > 0);
    return vals.length === 0 ? 0 : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const thisAvg = avgRating(thisWeekRows);
  const lastAvg = avgRating(lastWeekRows);
  const totalFeedbacks = thisWeekRows.reduce((s, r) => s + Number(r.feedback_count ?? 0), 0);
  const avgDiff = (() => {
    const vals = thisWeekRows.map((r) => Number(r.avg_difficulty ?? 0)).filter((v) => v > 0);
    return vals.length === 0 ? 0 : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  })();

  // Find top rated driver this week
  const topRow = thisWeekRows.length > 0
    ? thisWeekRows.reduce((best, r) =>
        Number(r.avg_customer_rating ?? 0) > Number(best.avg_customer_rating ?? 0) ? r : best,
      thisWeekRows[0])
    : null;

  // Load driver names for top/bottom
  const driverIds = [...new Set(thisWeekRows.map((r) => r.driver_id as string).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (driverIds.length > 0) {
    try {
      const { data: drivers } = await sb
        .from('mise_drivers')
        .select('id, name')
        .in('id', driverIds);
      for (const d of drivers ?? []) nameMap.set(d.id as string, d.name as string);
    } catch { /* graceful */ }
  }
  let topRatedDriverName: string | null = null;
  if (topRow?.driver_id) topRatedDriverName = nameMap.get(topRow.driver_id as string) ?? null;

  // Sort for top/bottom 5
  const ranked = thisWeekRows
    .filter((r) => Number(r.avg_customer_rating ?? 0) > 0)
    .sort((a, b) => Number(b.avg_customer_rating ?? 0) - Number(a.avg_customer_rating ?? 0));

  const mapDriver = (r: Record<string, unknown>) => ({
    driverId:     r.driver_id as string,
    driverName:   nameMap.get(r.driver_id as string) ?? null,
    avgRating:    Number(r.avg_customer_rating ?? 0),
    feedbackCount: Number(r.feedback_count ?? 0),
  });

  const topDrivers = ranked.slice(0, 5).map(mapDriver);
  const bottomDrivers = [...ranked].reverse().slice(0, 5).map(mapDriver);

  // Monthly trend (last 3 months)
  const monthlyTrend = await getFeedbackManagementReport(locationId, 3);

  return {
    kpis: {
      avgCustomerRatingThisWeek: thisAvg,
      avgCustomerRatingLastWeek: lastAvg,
      ratingTrend:               Math.round((thisAvg - lastAvg) * 10) / 10,
      totalFeedbacksThisWeek:    totalFeedbacks,
      avgDifficultyThisWeek:     avgDiff,
      activeDriversWithFeedback: thisWeekRows.length,
      topRatedDriverName,
      topRatedScore:             topRow ? Number(topRow.avg_customer_rating ?? 0) : null,
    },
    monthlyTrend,
    topDrivers,
    bottomDrivers,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldFeedbackAggregates(daysOld = 365): Promise<number> {
  const sb = svc();
  try {
    const { data } = await sb.rpc('prune_tour_feedback_aggregates', { days_old: daysOld });
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}
