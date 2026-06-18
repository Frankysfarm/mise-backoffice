/**
 * lib/delivery/cost-per-order.ts
 *
 * Phase 244: Delivery Cost-per-Order Analysis
 *
 * Allocates trip-level costs down to individual order granularity by dividing
 * shared costs (driver time, fuel) proportionally across all dropoff stops in
 * each batch, then aggregates by driver, shift-hour and vehicle type.
 *
 * Builds on top of delivery_trip_costs (Phase 183) — no new DB table needed.
 *
 * Public API:
 *   getCostPerOrderDashboard(locationId, days?) → CostPerOrderDashboard
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OrderCostKpis {
  totalTrips: number;
  totalOrders: number;               // sum of stops_count
  avgCostPerOrderEur: number | null;
  avgFeePerOrderEur: number | null;
  avgMarginPerOrderEur: number | null;
  overallMarginPct: number | null;
  lossOrdersPct: number | null;      // share of trips where margin < 0, weighted by stops
  avgOrdersPerTrip: number | null;
}

export interface DriverOrderCost {
  driverId: string;
  driverName: string | null;
  vehicleType: string | null;
  tripsCount: number;
  totalOrders: number;
  avgCostPerOrderEur: number | null;
  avgFeePerOrderEur: number | null;
  avgMarginPerOrderEur: number | null;
  marginPct: number | null;
  lossTrips: number;
}

export interface HourlyOrderCost {
  hourOfDay: number;                  // 0–23
  tripsCount: number;
  totalOrders: number;
  avgCostPerOrderEur: number | null;
  avgFeePerOrderEur: number | null;
  avgMarginPerOrderEur: number | null;
}

export interface VehicleOrderCost {
  vehicleType: string;
  tripsCount: number;
  totalOrders: number;
  avgCostPerOrderEur: number | null;
  avgFeePerOrderEur: number | null;
  totalCostEur: number;
  totalRevenueEur: number;
  totalMarginEur: number;
  marginPct: number | null;
}

export interface DailyOrderCostTrend {
  dateStr: string;                    // YYYY-MM-DD
  totalOrders: number;
  avgCostPerOrderEur: number | null;
  avgFeePerOrderEur: number | null;
  avgMarginPerOrderEur: number | null;
}

export interface CostPerOrderDashboard {
  kpis: OrderCostKpis;
  byDriver: DriverOrderCost[];
  byHour: HourlyOrderCost[];
  byVehicle: VehicleOrderCost[];
  trend14d: DailyOrderCostTrend[];
  days: number;
  generatedAt: string;
}

// ─── Raw row from delivery_trip_costs ─────────────────────────────────────────

interface TripCostRow {
  batch_id: string;
  driver_id: string | null;
  vehicle_type: string | null;
  stops_count: number;
  total_cost_eur: number;
  delivery_fees_eur: number;
  gross_margin_eur: number;
  net_revenue_eur: number;
  computed_at: string;          // ISO timestamp
  driver_name: string | null;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function getCostPerOrderDashboard(
  locationId: string,
  days = 30,
): Promise<CostPerOrderDashboard> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Query trip costs + driver name in one call (LEFT JOIN via select)
  const { data: rawRows, error } = await sb
    .from('delivery_trip_costs')
    .select(`
      batch_id,
      driver_id,
      vehicle_type,
      stops_count,
      total_cost_eur,
      delivery_fees_eur,
      gross_margin_eur,
      net_revenue_eur,
      computed_at,
      mise_drivers ( name )
    `)
    .eq('location_id', locationId)
    .gte('computed_at', since)
    .gt('stops_count', 0)
    .order('computed_at', { ascending: false })
    .limit(2000);

  if (error || !rawRows) {
    return emptyDashboard(days);
  }

  const rows: TripCostRow[] = (rawRows as Record<string, unknown>[]).map((r) => ({
    batch_id:         r.batch_id as string,
    driver_id:        r.driver_id as string | null,
    vehicle_type:     r.vehicle_type as string | null,
    stops_count:      Math.max(1, Number(r.stops_count ?? 1)),
    total_cost_eur:   Number(r.total_cost_eur ?? 0),
    delivery_fees_eur: Number(r.delivery_fees_eur ?? 0),
    gross_margin_eur:  Number(r.gross_margin_eur ?? 0),
    net_revenue_eur:   Number(r.net_revenue_eur ?? 0),
    computed_at:       r.computed_at as string,
    driver_name: (() => {
      const d = r.mise_drivers as Record<string, unknown> | null;
      return d?.name as string | null ?? null;
    })(),
  }));

  if (rows.length === 0) return emptyDashboard(days);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalTrips = rows.length;
  const totalOrders = rows.reduce((s, r) => s + r.stops_count, 0);
  const totalCostEur = rows.reduce((s, r) => s + r.total_cost_eur, 0);
  const totalFeesEur = rows.reduce((s, r) => s + r.delivery_fees_eur, 0);
  const totalMarginEur = rows.reduce((s, r) => s + r.gross_margin_eur, 0);
  const totalRevenueEur = rows.reduce((s, r) => s + r.net_revenue_eur, 0);
  const lossTripsOrders = rows.filter((r) => r.gross_margin_eur < 0).reduce((s, r) => s + r.stops_count, 0);

  const kpis: OrderCostKpis = {
    totalTrips,
    totalOrders,
    avgCostPerOrderEur: totalOrders > 0 ? round2(totalCostEur / totalOrders) : null,
    avgFeePerOrderEur:  totalOrders > 0 ? round2(totalFeesEur / totalOrders) : null,
    avgMarginPerOrderEur: totalOrders > 0 ? round2(totalMarginEur / totalOrders) : null,
    overallMarginPct: totalRevenueEur > 0 ? round1((totalMarginEur / totalRevenueEur) * 100) : null,
    lossOrdersPct: totalOrders > 0 ? round1((lossTripsOrders / totalOrders) * 100) : null,
    avgOrdersPerTrip: totalTrips > 0 ? round1(totalOrders / totalTrips) : null,
  };

  // ── By Driver ─────────────────────────────────────────────────────────────
  const driverMap = new Map<string, {
    name: string | null; vt: string | null;
    trips: number; orders: number; cost: number; fees: number; margin: number; revenue: number; lossTrips: number;
  }>();

  for (const r of rows) {
    const key = r.driver_id ?? '__unknown__';
    const cur = driverMap.get(key) ?? { name: r.driver_name, vt: r.vehicle_type, trips: 0, orders: 0, cost: 0, fees: 0, margin: 0, revenue: 0, lossTrips: 0 };
    cur.trips++;
    cur.orders += r.stops_count;
    cur.cost   += r.total_cost_eur;
    cur.fees   += r.delivery_fees_eur;
    cur.margin += r.gross_margin_eur;
    cur.revenue += r.net_revenue_eur;
    if (r.gross_margin_eur < 0) cur.lossTrips++;
    driverMap.set(key, cur);
  }

  const byDriver: DriverOrderCost[] = Array.from(driverMap.entries())
    .map(([id, d]) => ({
      driverId:             id === '__unknown__' ? 'unbekannt' : id,
      driverName:           d.name,
      vehicleType:          d.vt,
      tripsCount:           d.trips,
      totalOrders:          d.orders,
      avgCostPerOrderEur:   d.orders > 0 ? round2(d.cost / d.orders) : null,
      avgFeePerOrderEur:    d.orders > 0 ? round2(d.fees / d.orders) : null,
      avgMarginPerOrderEur: d.orders > 0 ? round2(d.margin / d.orders) : null,
      marginPct:            d.revenue > 0 ? round1((d.margin / d.revenue) * 100) : null,
      lossTrips:            d.lossTrips,
    }))
    .sort((a, b) => (b.totalOrders) - (a.totalOrders))
    .slice(0, 20);

  // ── By Hour ───────────────────────────────────────────────────────────────
  const hourMap = new Map<number, { trips: number; orders: number; cost: number; fees: number; margin: number }>();

  for (const r of rows) {
    const h = new Date(r.computed_at).getHours();
    const cur = hourMap.get(h) ?? { trips: 0, orders: 0, cost: 0, fees: 0, margin: 0 };
    cur.trips++;
    cur.orders += r.stops_count;
    cur.cost   += r.total_cost_eur;
    cur.fees   += r.delivery_fees_eur;
    cur.margin += r.gross_margin_eur;
    hourMap.set(h, cur);
  }

  const byHour: HourlyOrderCost[] = Array.from({ length: 24 }, (_, h) => {
    const d = hourMap.get(h);
    if (!d) return { hourOfDay: h, tripsCount: 0, totalOrders: 0, avgCostPerOrderEur: null, avgFeePerOrderEur: null, avgMarginPerOrderEur: null };
    return {
      hourOfDay: h,
      tripsCount: d.trips,
      totalOrders: d.orders,
      avgCostPerOrderEur:   d.orders > 0 ? round2(d.cost / d.orders) : null,
      avgFeePerOrderEur:    d.orders > 0 ? round2(d.fees / d.orders) : null,
      avgMarginPerOrderEur: d.orders > 0 ? round2(d.margin / d.orders) : null,
    };
  });

  // ── By Vehicle ────────────────────────────────────────────────────────────
  const vehicleMap = new Map<string, { trips: number; orders: number; cost: number; fees: number; margin: number; revenue: number }>();

  for (const r of rows) {
    const key = r.vehicle_type ?? 'unbekannt';
    const cur = vehicleMap.get(key) ?? { trips: 0, orders: 0, cost: 0, fees: 0, margin: 0, revenue: 0 };
    cur.trips++;
    cur.orders  += r.stops_count;
    cur.cost    += r.total_cost_eur;
    cur.fees    += r.delivery_fees_eur;
    cur.margin  += r.gross_margin_eur;
    cur.revenue += r.net_revenue_eur;
    vehicleMap.set(key, cur);
  }

  const byVehicle: VehicleOrderCost[] = Array.from(vehicleMap.entries())
    .map(([vt, d]) => ({
      vehicleType:          vt,
      tripsCount:           d.trips,
      totalOrders:          d.orders,
      avgCostPerOrderEur:   d.orders > 0 ? round2(d.cost / d.orders) : null,
      avgFeePerOrderEur:    d.orders > 0 ? round2(d.fees / d.orders) : null,
      totalCostEur:         round2(d.cost),
      totalRevenueEur:      round2(d.revenue),
      totalMarginEur:       round2(d.margin),
      marginPct:            d.revenue > 0 ? round1((d.margin / d.revenue) * 100) : null,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);

  // ── 14-Day Trend ──────────────────────────────────────────────────────────
  const dayMap = new Map<string, { orders: number; cost: number; fees: number; margin: number }>();

  for (const r of rows) {
    const d = r.computed_at.slice(0, 10); // YYYY-MM-DD
    const cur = dayMap.get(d) ?? { orders: 0, cost: 0, fees: 0, margin: 0 };
    cur.orders += r.stops_count;
    cur.cost   += r.total_cost_eur;
    cur.fees   += r.delivery_fees_eur;
    cur.margin += r.gross_margin_eur;
    dayMap.set(d, cur);
  }

  const trend14d: DailyOrderCostTrend[] = Array.from(dayMap.entries())
    .map(([dateStr, d]) => ({
      dateStr,
      totalOrders: d.orders,
      avgCostPerOrderEur:   d.orders > 0 ? round2(d.cost / d.orders) : null,
      avgFeePerOrderEur:    d.orders > 0 ? round2(d.fees / d.orders) : null,
      avgMarginPerOrderEur: d.orders > 0 ? round2(d.margin / d.orders) : null,
    }))
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
    .slice(-14);

  return {
    kpis,
    byDriver,
    byHour,
    byVehicle,
    trend14d,
    days,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(v: number): number { return Math.round(v * 100) / 100; }
function round1(v: number): number { return Math.round(v * 10) / 10; }

function emptyDashboard(days: number): CostPerOrderDashboard {
  return {
    kpis: {
      totalTrips: 0, totalOrders: 0, avgCostPerOrderEur: null, avgFeePerOrderEur: null,
      avgMarginPerOrderEur: null, overallMarginPct: null, lossOrdersPct: null, avgOrdersPerTrip: null,
    },
    byDriver: [], byHour: byHourEmpty(), byVehicle: [], trend14d: [],
    days, generatedAt: new Date().toISOString(),
  };
}

function byHourEmpty(): HourlyOrderCost[] {
  return Array.from({ length: 24 }, (_, h) => ({
    hourOfDay: h, tripsCount: 0, totalOrders: 0, avgCostPerOrderEur: null, avgFeePerOrderEur: null, avgMarginPerOrderEur: null,
  }));
}
