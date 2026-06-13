/**
 * lib/delivery/profitability.ts
 *
 * Delivery Profitability Analytics Engine — Phase 100
 *
 * Aggregiert Liefergebühren (Revenue) und Fahrer-Auszahlungen (Cost)
 * zu P&L-Metriken. Täglicher Cron-Snapshot + Live-Abfragen.
 *
 * Funktionen:
 *  snapshotProfitability(locationId, date?)  — tägliche Aggregation speichern
 *  snapshotAllLocations()                    — Cron-Batch über alle Locations
 *  getSnapshots(locationId, days)            — Tages-Verlauf (max 90 Tage)
 *  getZoneProfitability(locationId)          — P&L pro Zone (letzte 30 Tage)
 *  getDriverProfitability(locationId)        — P&L pro Fahrer (letzte 30 Tage)
 *  getHourlyProfitability(locationId)        — P&L nach Tagesstunde
 *  getRecommendedFees(locationId)            — Gebühren-Empfehlungen pro Zone
 *  getDashboard(locationId)                  — Kombinations-Response für Admin-UI
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ──────────────────────────────────────────────────────────────────────────────
// Typen
// ──────────────────────────────────────────────────────────────────────────────

export interface ProfitSnapshot {
  id: string;
  locationId: string;
  snapshotDate: string;
  totalOrders: number;
  revenueEur: number;
  avgFeeEur: number | null;
  totalPayouts: number;
  costEur: number;
  avgCostEur: number | null;
  profitEur: number;
  marginPct: number | null;
  createdAt: string;
}

export interface ZoneProfitability {
  zone: string;
  orderCount: number;
  revenueEur: number;
  avgFeeEur: number;
  costEur: number;
  avgCostEur: number;
  profitEur: number;
  marginPct: number | null;
}

export interface DriverProfitability {
  driverId: string;
  driverName: string | null;
  deliveryCount: number;
  revenueEur: number;
  costEur: number;
  profitContributionEur: number;
  avgCostPerDelivery: number;
  avgDistanceKm: number;
}

export interface HourlyProfitability {
  hourOfDay: number;
  orderCount: number;
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
}

export interface FeeRecommendation {
  zone: string;
  currentAvgFeeEur: number;
  avgCostEur: number;
  marginPct: number | null;
  recommendedFeeEur: number;
  reasoning: string;
}

export interface ProfitabilityDashboard {
  summary: {
    revenueEur: number;
    costEur: number;
    profitEur: number;
    marginPct: number | null;
    totalOrders: number;
    revenueYesterdayEur: number;
    profitYesterdayEur: number;
    revenueTrendPct: number | null;
    profitTrendPct: number | null;
  };
  trend: ProfitSnapshot[];
  zones: ZoneProfitability[];
  drivers: DriverProfitability[];
  hourly: HourlyProfitability[];
  feeRecommendations: FeeRecommendation[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Snapshot
// ──────────────────────────────────────────────────────────────────────────────

export async function snapshotProfitability(
  locationId: string,
  date?: string,
): Promise<ProfitSnapshot> {
  const sb = createServiceClient();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const dayStart = `${targetDate}T00:00:00+00:00`;
  const dayEnd   = `${targetDate}T23:59:59+00:00`;

  // Revenue: Liefergebühren gelieferter Bestellungen dieses Tages
  const { data: revenueRows } = await sb
    .from('customer_orders')
    .select('id, liefergebuehr')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .eq('typ', 'lieferung')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const orders = revenueRows ?? [];
  const totalOrders = orders.length;
  const revenueEur = orders.reduce((s, o) => s + (Number(o.liefergebuehr) || 0), 0);
  const avgFeeEur = totalOrders > 0 ? revenueEur / totalOrders : null;

  // Cost: Payout-Records desselben Tages
  const { data: payoutRows } = await sb
    .from('driver_payout_records')
    .select('id, total_amount')
    .eq('location_id', locationId)
    .gte('completed_at', dayStart)
    .lte('completed_at', dayEnd);

  const payouts = payoutRows ?? [];
  const totalPayouts = payouts.length;
  const costEur = payouts.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const avgCostEur = totalPayouts > 0 ? costEur / totalPayouts : null;

  const profitEur = revenueEur - costEur;
  const marginPct = revenueEur > 0 ? Math.round(((profitEur / revenueEur) * 100) * 100) / 100 : null;

  const { data: row, error } = await sb
    .from('delivery_profitability_snapshots')
    .upsert({
      location_id:    locationId,
      snapshot_date:  targetDate,
      total_orders:   totalOrders,
      revenue_eur:    Math.round(revenueEur * 100) / 100,
      avg_fee_eur:    avgFeeEur !== null ? Math.round(avgFeeEur * 100) / 100 : null,
      total_payouts:  totalPayouts,
      cost_eur:       Math.round(costEur * 100) / 100,
      avg_cost_eur:   avgCostEur !== null ? Math.round(avgCostEur * 100) / 100 : null,
    }, { onConflict: 'location_id,snapshot_date' })
    .select()
    .single();

  if (error) throw new Error(`snapshotProfitability: ${error.message}`);

  return fromDbSnapshot(row as Record<string, unknown>);
}

export async function snapshotAllLocations(): Promise<{ locations: number; snapshots: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs?.length) return { locations: 0, snapshots: 0 };

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  let snapshots = 0;
  await Promise.all(
    locs.map(async (loc) => {
      try {
        await snapshotProfitability(loc.id, dateStr);
        snapshots++;
      } catch {
        // Non-fatal: continue with other locations
      }
    }),
  );

  return { locations: locs.length, snapshots };
}

// ──────────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────────

export async function getSnapshots(
  locationId: string,
  days = 30,
): Promise<ProfitSnapshot[]> {
  const sb = createServiceClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data } = await sb
    .from('delivery_profitability_snapshots')
    .select('id, location_id, snapshot_date, total_orders, revenue_eur, avg_fee_eur, total_payouts, cost_eur, avg_cost_eur, profit_eur, margin_pct, created_at')
    .eq('location_id', locationId)
    .gte('snapshot_date', since.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  return (data ?? []).map((r) => fromDbSnapshot(r as Record<string, unknown>));
}

export async function getZoneProfitability(locationId: string): Promise<ZoneProfitability[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_zone_profitability')
    .select('zone, order_count, revenue_eur, avg_fee_eur, cost_eur, avg_cost_eur, profit_eur, margin_pct')
    .eq('location_id', locationId)
    .order('profit_eur', { ascending: false });

  return (data ?? []).map((r) => ({
    zone:          r.zone as string,
    orderCount:    Number(r.order_count) || 0,
    revenueEur:    Number(r.revenue_eur) || 0,
    avgFeeEur:     Number(r.avg_fee_eur) || 0,
    costEur:       Number(r.cost_eur) || 0,
    avgCostEur:    Number(r.avg_cost_eur) || 0,
    profitEur:     Number(r.profit_eur) || 0,
    marginPct:     r.margin_pct !== null ? Number(r.margin_pct) : null,
  }));
}

export async function getDriverProfitability(locationId: string): Promise<DriverProfitability[]> {
  const sb = createServiceClient();

  // Join with mise_drivers + employees to get names
  const { data: rows } = await sb
    .from('v_driver_profitability')
    .select('driver_id, delivery_count, revenue_eur, cost_eur, profit_contribution_eur, avg_cost_per_delivery, avg_distance_km')
    .eq('location_id', locationId)
    .order('profit_contribution_eur', { ascending: false });

  if (!rows?.length) return [];

  const driverIds = rows.map((r) => r.driver_id as string);
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, employee_id')
    .in('id', driverIds);

  const empIds = (drivers ?? []).map((d) => d.employee_id).filter(Boolean) as string[];
  const { data: employees } = empIds.length
    ? await sb.from('employees').select('id, vorname, nachname').in('id', empIds)
    : { data: [] };

  const empMap = new Map((employees ?? []).map((e) => [e.id as string, `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim()]));
  const driverMap = new Map((drivers ?? []).map((d) => [d.id as string, d.employee_id as string | null]));

  return rows.map((r) => {
    const empId = driverMap.get(r.driver_id as string) ?? null;
    return {
      driverId:               r.driver_id as string,
      driverName:             empId ? (empMap.get(empId) ?? null) : null,
      deliveryCount:          Number(r.delivery_count) || 0,
      revenueEur:             Number(r.revenue_eur) || 0,
      costEur:                Number(r.cost_eur) || 0,
      profitContributionEur:  Number(r.profit_contribution_eur) || 0,
      avgCostPerDelivery:     Number(r.avg_cost_per_delivery) || 0,
      avgDistanceKm:          Number(r.avg_distance_km) || 0,
    };
  });
}

export async function getHourlyProfitability(locationId: string): Promise<HourlyProfitability[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_hourly_profitability')
    .select('hour_of_day, order_count, revenue_eur, cost_eur, profit_eur, margin_pct')
    .eq('location_id', locationId)
    .order('hour_of_day', { ascending: true });

  return (data ?? []).map((r) => ({
    hourOfDay:  Number(r.hour_of_day),
    orderCount: Number(r.order_count) || 0,
    revenueEur: Number(r.revenue_eur) || 0,
    costEur:    Number(r.cost_eur) || 0,
    profitEur:  Number(r.profit_eur) || 0,
    marginPct:  r.margin_pct !== null ? Number(r.margin_pct) : null,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Fee Recommendations
// Empfehle Gebührenanpassung wenn Marge unter Ziel-Schwelle
// ──────────────────────────────────────────────────────────────────────────────
const TARGET_MARGIN = 0.35; // 35% Ziel-Marge

export async function getRecommendedFees(locationId: string): Promise<FeeRecommendation[]> {
  const zones = await getZoneProfitability(locationId);

  return zones.map((z) => {
    const avgCost = z.avgCostEur;
    // Gebühr die nötig wäre um TARGET_MARGIN zu erreichen: fee = cost / (1 - target)
    const recommendedFeeEur = avgCost > 0 ? Math.round((avgCost / (1 - TARGET_MARGIN)) * 20) / 20 : 0;
    const currentMargin = z.marginPct;

    let reasoning: string;
    if (currentMargin === null) {
      reasoning = 'Keine Umsatzdaten — Gebühr prüfen.';
    } else if (currentMargin < 0) {
      reasoning = `Zone ${z.zone}: Verlustzone (${currentMargin.toFixed(1)}% Marge). Gebühr um mind. €${(recommendedFeeEur - z.avgFeeEur).toFixed(2)} anheben.`;
    } else if (currentMargin < TARGET_MARGIN * 100) {
      reasoning = `Zone ${z.zone}: Marge unter Ziel (${currentMargin.toFixed(1)}% < ${(TARGET_MARGIN * 100).toFixed(0)}%). Empfohlene Gebühr: €${recommendedFeeEur.toFixed(2)}.`;
    } else {
      reasoning = `Zone ${z.zone}: Marge gesund (${currentMargin.toFixed(1)}%). Aktuelle Gebühr passt.`;
    }

    return {
      zone:                z.zone,
      currentAvgFeeEur:    z.avgFeeEur,
      avgCostEur:          avgCost,
      marginPct:           currentMargin,
      recommendedFeeEur:   Math.max(recommendedFeeEur, z.avgFeeEur),
      reasoning,
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard — kombinierter Response
// ──────────────────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<ProfitabilityDashboard> {
  const [trend, zones, drivers, hourly, feeRecommendations] = await Promise.all([
    getSnapshots(locationId, 30),
    getZoneProfitability(locationId),
    getDriverProfitability(locationId),
    getHourlyProfitability(locationId),
    getRecommendedFees(locationId),
  ]);

  // Heute + Gestern aus Snapshots
  const today    = trend[trend.length - 1] ?? null;
  const yesterday = trend[trend.length - 2] ?? null;

  // Fallback: live-Aggregation der letzten 30 Tage
  const totalRevenue = trend.reduce((s, t) => s + t.revenueEur, 0);
  const totalCost    = trend.reduce((s, t) => s + t.costEur, 0);
  const totalOrders  = trend.reduce((s, t) => s + t.totalOrders, 0);
  const totalProfit  = totalRevenue - totalCost;
  const marginPct    = totalRevenue > 0
    ? Math.round(((totalProfit / totalRevenue) * 100) * 100) / 100
    : null;

  const revToday     = today?.revenueEur     ?? 0;
  const revYesterday = yesterday?.revenueEur ?? 0;
  const revTrendPct  = revYesterday > 0
    ? Math.round(((revToday - revYesterday) / revYesterday) * 100 * 100) / 100
    : null;

  const profToday     = today?.profitEur     ?? 0;
  const profYesterday = yesterday?.profitEur ?? 0;
  const profTrendPct  = profYesterday > 0
    ? Math.round(((profToday - profYesterday) / profYesterday) * 100 * 100) / 100
    : null;

  return {
    summary: {
      revenueEur:          Math.round(totalRevenue * 100) / 100,
      costEur:             Math.round(totalCost * 100) / 100,
      profitEur:           Math.round(totalProfit * 100) / 100,
      marginPct,
      totalOrders,
      revenueYesterdayEur: revYesterday,
      profitYesterdayEur:  profYesterday,
      revenueTrendPct:     revTrendPct,
      profitTrendPct:      profTrendPct,
    },
    trend,
    zones,
    drivers,
    hourly,
    feeRecommendations,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ──────────────────────────────────────────────────────────────────────────────

function fromDbSnapshot(r: Record<string, unknown>): ProfitSnapshot {
  return {
    id:             r.id as string,
    locationId:     r.location_id as string,
    snapshotDate:   r.snapshot_date as string,
    totalOrders:    Number(r.total_orders) || 0,
    revenueEur:     Number(r.revenue_eur) || 0,
    avgFeeEur:      r.avg_fee_eur !== null ? Number(r.avg_fee_eur) : null,
    totalPayouts:   Number(r.total_payouts) || 0,
    costEur:        Number(r.cost_eur) || 0,
    avgCostEur:     r.avg_cost_eur !== null ? Number(r.avg_cost_eur) : null,
    profitEur:      Number(r.profit_eur) || 0,
    marginPct:      r.margin_pct !== null ? Number(r.margin_pct) : null,
    createdAt:      r.created_at as string,
  };
}
