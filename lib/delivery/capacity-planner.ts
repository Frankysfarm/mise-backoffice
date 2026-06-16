/**
 * lib/delivery/capacity-planner.ts
 *
 * Phase 207 — Predictive Capacity Planner
 *
 * Generates 7-day driver capacity recommendations by combining:
 *  - Demand forecasts (v_hourly_demand_pattern per weekday+hour)
 *  - Scheduled drivers (driver_shifts.planned_start/end)
 *
 * Core formula:
 *  recommended_drivers = ceil(expected_orders / ORDERS_PER_DRIVER_PER_HOUR)
 *  coverage_gap        = max(0, recommended_drivers - scheduled_drivers)
 *
 * Status:
 *  ok          — scheduled >= recommended
 *  understaffed — 0 < scheduled < recommended
 *  uncovered   — scheduled == 0 && recommended > 0
 *
 * Exports:
 *  generateCapacityPlanForLocation()   — 7-day plan for one location
 *  generateCapacityPlanAllLocations()  — Cron batch
 *  getCapacityDashboard()              — Admin dashboard
 *  getCoverageGaps()                   — Upcoming understaffed slots (today)
 *  getUpcomingPeakHours()              — Peak hours for fahrer-app chip
 *  pruneOldSlots()                     — Cleanup via SQL function
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDERS_PER_DRIVER_PER_HOUR = 2.5;
const PLAN_DAYS_AHEAD = 7;
const BUSINESS_HOURS_START = 10;
const BUSINESS_HOURS_END = 23;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapacitySlot {
  id: string;
  locationId: string;
  slotDate: string;
  hourOfDay: number;
  weekday: number;
  expectedOrders: number;
  recommendedDrivers: number;
  scheduledDrivers: number;
  coverageGap: number;
  isOverstaffed: boolean;
  isPeak: boolean;
  confidencePct: number;
  demandSource: 'forecast' | 'historical' | 'manual';
  generatedAt: string;
}

export type CapacitySlotStatus = 'ok' | 'understaffed' | 'uncovered';

export interface CapacityDayCell {
  date: string;
  weekday: number;
  hourOfDay: number;
  expectedOrders: number;
  recommendedDrivers: number;
  scheduledDrivers: number;
  coverageGap: number;
  isPeak: boolean;
  status: CapacitySlotStatus;
}

export interface CapacitySummary {
  totalSlots: number;
  coveredSlots: number;
  understaffedSlots: number;
  uncoveredSlots: number;
  coveragePct: number;
  peakSlots: number;
  maxGap: number;
  worstDate: string | null;
}

export interface CapacityDashboard {
  weekGrid: CapacityDayCell[];
  gaps: CapacitySlot[];
  summary: CapacitySummary;
  generatedAt: string;
}

export interface GeneratePlanResult {
  locationId: string;
  slotsUpserted: number;
  errors: number;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CapacitySlot {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    slotDate: String(row.slot_date),
    hourOfDay: Number(row.hour_of_day),
    weekday: Number(row.weekday),
    expectedOrders: Number(row.expected_orders),
    recommendedDrivers: Number(row.recommended_drivers),
    scheduledDrivers: Number(row.scheduled_drivers),
    coverageGap: Number(row.coverage_gap ?? 0),
    isOverstaffed: Boolean(row.is_overstaffed),
    isPeak: Boolean(row.is_peak),
    confidencePct: Number(row.confidence_pct ?? 70),
    demandSource: (row.demand_source as 'forecast' | 'historical' | 'manual') ?? 'forecast',
    generatedAt: String(row.generated_at),
  };
}

function slotStatus(
  recommended: number,
  scheduled: number,
): CapacitySlotStatus {
  if (scheduled >= recommended) return 'ok';
  if (scheduled === 0) return 'uncovered';
  return 'understaffed';
}

// ── generateCapacityPlanForLocation ───────────────────────────────────────────

export async function generateCapacityPlanForLocation(
  locationId: string,
): Promise<GeneratePlanResult> {
  const sb = createServiceClient();
  let errors = 0;

  // 1. Load demand pattern per weekday+hour
  const { data: patterns, error: patErr } = await sb
    .from('v_hourly_demand_pattern')
    .select('weekday,hour_of_day,avg_orders,peak_orders,data_points')
    .eq('location_id', locationId);

  if (patErr) errors++;

  const patternMap = new Map<string, { avgOrders: number; peakOrders: number; dataPoints: number }>();
  for (const p of patterns ?? []) {
    patternMap.set(`${p.weekday}_${p.hour_of_day}`, {
      avgOrders: Number(p.avg_orders ?? 0),
      peakOrders: Number(p.peak_orders ?? 0),
      dataPoints: Number(p.data_points ?? 0),
    });
  }

  // 2. Load scheduled driver shifts for next 7 days
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + PLAN_DAYS_AHEAD + 1);

  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('planned_start,planned_end')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .gte('planned_start', today.toISOString())
    .lte('planned_start', endDate.toISOString());

  // Build a map: "YYYY-MM-DD|H" → driver count
  const scheduledMap = new Map<string, number>();
  for (const shift of shifts ?? []) {
    const start = new Date(shift.planned_start);
    const end = new Date(shift.planned_end);
    const cur = new Date(start);
    cur.setMinutes(0, 0, 0);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const key = `${dateStr}|${cur.getUTCHours()}`;
      scheduledMap.set(key, (scheduledMap.get(key) ?? 0) + 1);
      cur.setUTCHours(cur.getUTCHours() + 1);
    }
  }

  // 3. Build upsert rows for next 7 days × business hours
  const rows: Record<string, unknown>[] = [];

  for (let d = 0; d < PLAN_DAYS_AHEAD; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);
    const weekday = date.getDay();

    for (let h = BUSINESS_HOURS_START; h <= BUSINESS_HOURS_END; h++) {
      const pat = patternMap.get(`${weekday}_${h}`);
      const expectedOrders = pat ? Math.round(pat.avgOrders) : 0;
      const peakOrders = pat?.peakOrders ?? 0;
      const recommendedDrivers =
        expectedOrders > 0
          ? Math.max(1, Math.ceil(expectedOrders / ORDERS_PER_DRIVER_PER_HOUR))
          : 0;
      const scheduledDrivers = scheduledMap.get(`${dateStr}|${h}`) ?? 0;
      const isPeak = expectedOrders > 0 && expectedOrders >= peakOrders * 0.75;
      const confidencePct = pat && pat.dataPoints >= 4 ? 80 : 50;

      rows.push({
        location_id: locationId,
        slot_date: dateStr,
        hour_of_day: h,
        weekday,
        expected_orders: expectedOrders,
        recommended_drivers: recommendedDrivers,
        scheduled_drivers: scheduledDrivers,
        is_peak: isPeak,
        confidence_pct: confidencePct,
        demand_source: pat && pat.dataPoints >= 2 ? 'historical' : 'forecast',
        generated_at: new Date().toISOString(),
      });
    }
  }

  const { error: upsertErr } = await sb
    .from('capacity_plan_slots')
    .upsert(
      rows as Parameters<ReturnType<typeof sb.from>['upsert']>[0],
      { onConflict: 'location_id,slot_date,hour_of_day' },
    );

  if (upsertErr) {
    errors++;
    return { locationId, slotsUpserted: 0, errors };
  }

  return { locationId, slotsUpserted: rows.length, errors };
}

// ── generateCapacityPlanAllLocations ─────────────────────────────────────────

export async function generateCapacityPlanAllLocations(): Promise<{
  locations: number;
  slotsUpserted: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, slotsUpserted: 0, errors: 0 };

  const results = await Promise.all(
    locations.map((l) => generateCapacityPlanForLocation(String(l.id))),
  );

  return {
    locations: results.length,
    slotsUpserted: results.reduce((s, r) => s + r.slotsUpserted, 0),
    errors: results.reduce((s, r) => s + r.errors, 0),
  };
}

// ── getCapacityDashboard ──────────────────────────────────────────────────────

export async function getCapacityDashboard(locationId: string): Promise<CapacityDashboard> {
  const sb = createServiceClient();

  const [weekResult, gapsResult] = await Promise.all([
    sb
      .from('v_capacity_week_ahead')
      .select('*')
      .eq('location_id', locationId)
      .order('slot_date', { ascending: true })
      .order('hour_of_day', { ascending: true }),
    sb
      .from('v_capacity_gaps_24h')
      .select('*')
      .eq('location_id', locationId)
      .order('hour_of_day', { ascending: true }),
  ]);

  const weekGrid: CapacityDayCell[] = (weekResult.data ?? []).map((row) => {
    const gap = Number(row.coverage_gap ?? 0);
    const rec = Number(row.recommended_drivers);
    const sch = Number(row.scheduled_drivers);
    return {
      date: String(row.slot_date),
      weekday: Number(row.weekday),
      hourOfDay: Number(row.hour_of_day),
      expectedOrders: Number(row.expected_orders),
      recommendedDrivers: rec,
      scheduledDrivers: sch,
      coverageGap: gap,
      isPeak: Boolean(row.is_peak),
      status: slotStatus(rec, sch),
    };
  });

  const gaps = (gapsResult.data ?? []).map(mapRow);

  const totalSlots = weekGrid.filter((s) => s.recommendedDrivers > 0).length;
  const coveredSlots = weekGrid.filter((s) => s.status === 'ok' && s.recommendedDrivers > 0).length;
  const understaffedSlots = weekGrid.filter((s) => s.status === 'understaffed').length;
  const uncoveredSlots = weekGrid.filter((s) => s.status === 'uncovered').length;
  const peakSlots = weekGrid.filter((s) => s.isPeak).length;
  const maxGap = Math.max(0, ...weekGrid.map((s) => s.coverageGap));

  // Find worst date (most total coverage_gap)
  const gapByDate = new Map<string, number>();
  for (const s of weekGrid) {
    gapByDate.set(s.date, (gapByDate.get(s.date) ?? 0) + s.coverageGap);
  }
  let worstDate: string | null = null;
  let worstGap = 0;
  for (const [date, gap] of gapByDate) {
    if (gap > worstGap) { worstGap = gap; worstDate = date; }
  }

  return {
    weekGrid,
    gaps,
    summary: {
      totalSlots,
      coveredSlots,
      understaffedSlots,
      uncoveredSlots,
      coveragePct: totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0,
      peakSlots,
      maxGap,
      worstDate,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── getCoverageGaps ───────────────────────────────────────────────────────────

export async function getCoverageGaps(locationId: string): Promise<CapacitySlot[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_capacity_gaps_24h')
    .select('*')
    .eq('location_id', locationId)
    .order('hour_of_day', { ascending: true });

  return (data ?? []).map(mapRow);
}

// ── getUpcomingPeakHours ──────────────────────────────────────────────────────

export async function getUpcomingPeakHours(
  locationId: string,
  limit = 3,
): Promise<CapacitySlot[]> {
  const sb = createServiceClient();
  const nowHour = new Date().getUTCHours();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data } = await sb
    .from('capacity_plan_slots')
    .select('*')
    .eq('location_id', locationId)
    .eq('slot_date', todayStr)
    .eq('is_peak', true)
    .gte('hour_of_day', nowHour)
    .order('hour_of_day', { ascending: true })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

// ── pruneOldSlots ─────────────────────────────────────────────────────────────

export async function pruneOldSlots(daysToKeep = 14): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_capacity_slots', {
    days_to_keep: daysToKeep,
  });
  if (error) return 0;
  return Number(data ?? 0);
}
