/**
 * lib/delivery/tour-profit.ts
 *
 * Phase 278 — Dispatch Echtzeit-Gewinn Backend
 *
 * Berechnet den Deckungsbeitrag je aktiver Tour aus echten DB-Werten:
 *   Umsatz (Σ gesamtbetrag) − Fahrerkosten (km + Zeit + Pauschalen) = Nettogewinn
 *
 * Verwendet delivery_cost_config je Location (migration 093).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TourProfitItem {
  batchId: string;
  driverName: string | null;
  vehicle: 'bike' | 'car' | 'ebike' | 'scooter' | 'moped' | null;
  zone: string | null;
  state: string;
  stopsTotal: number;
  stopsCompleted: number;
  startedAt: string | null;
  totalDistanceKm: number;
  totalEtaMin: number | null;
  // Revenue
  revenueEur: number;
  // Cost breakdown
  costDriverTimeEur: number;
  costKmEur: number;
  costStopEur: number;
  costTotalEur: number;
  // Result
  profitEur: number;
  marginPct: number;
}

export interface TourProfitDashboard {
  locationId: string;
  activeTours: TourProfitItem[];
  sessionTotals: {
    revenueEur: number;
    costEur: number;
    profitEur: number;
    marginPct: number;
    completedTours: number;
    activeTours: number;
  };
  costConfig: {
    driverHourlyEur: number;
    costPerKmBike: number;
    costPerKmCar: number;
    packagingPerStop: number;
    insurancePerStop: number;
  };
  generatedAt: string;
}

interface CostConfig {
  cost_driver_hourly_eur: number;
  cost_per_km_bicycle_eur: number;
  cost_per_km_ebike_eur: number;
  cost_per_km_scooter_eur: number;
  cost_per_km_moped_eur: number;
  cost_per_km_car_eur: number;
  cost_packaging_eur: number;
  cost_insurance_per_del: number;
}

interface BatchRow {
  id: string;
  driver_id: string | null;
  state: string;
  zone: string | null;
  started_at: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  dispatch_score: number | null;
  driver: { name: string | null; vehicle: string | null } | null;
}

interface StopRow {
  id: string;
  batch_id: string;
  type: string;
  delivered_at: string | null;
  order: { id: string; gesamtbetrag: number | null } | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_COST_CONFIG: CostConfig = {
  cost_driver_hourly_eur:  12.00,
  cost_per_km_bicycle_eur: 0.00,
  cost_per_km_ebike_eur:   0.05,
  cost_per_km_scooter_eur: 0.18,
  cost_per_km_moped_eur:   0.18,
  cost_per_km_car_eur:     0.30,
  cost_packaging_eur:      0.50,
  cost_insurance_per_del:  0.20,
};

function costPerKm(vehicle: string | null, cfg: CostConfig): number {
  switch (vehicle) {
    case 'car':     return cfg.cost_per_km_car_eur;
    case 'ebike':   return cfg.cost_per_km_ebike_eur;
    case 'scooter': return cfg.cost_per_km_scooter_eur;
    case 'moped':   return cfg.cost_per_km_moped_eur;
    default:        return cfg.cost_per_km_bicycle_eur; // bike
  }
}

function computeTourProfit(batch: BatchRow, stops: StopRow[], cfg: CostConfig): TourProfitItem {
  const vehicle = batch.driver?.vehicle ?? null;
  const distanceKm = Number(batch.total_distance_km ?? 0);
  const etaMin = batch.total_eta_min != null ? Number(batch.total_eta_min) : null;

  // Revenue: Summe aller Bestellbeträge (nur dropoff-Stops, sonst Doppelzählung)
  const dropoffStops = stops.filter((s) => s.type === 'dropoff');
  const revenueEur = dropoffStops.reduce(
    (sum, s) => sum + (s.order?.gesamtbetrag != null ? Number(s.order.gesamtbetrag) : 0),
    0,
  );

  const stopCount = dropoffStops.length;
  const completedCount = dropoffStops.filter((s) => s.delivered_at != null).length;

  // Cost 1: Fahrzeit (ETA → Stundenlohn)
  const durationH = (etaMin ?? distanceKm * 3) / 60; // Fallback: 3 Min/km
  const costDriverTimeEur = durationH * cfg.cost_driver_hourly_eur;

  // Cost 2: Kilometerkosten
  const costKmEur = distanceKm * costPerKm(vehicle, cfg);

  // Cost 3: Stopp-Pauschalen (Verpackung + Versicherung je Lieferung)
  const costStopEur = stopCount * (cfg.cost_packaging_eur + cfg.cost_insurance_per_del);

  const costTotalEur = costDriverTimeEur + costKmEur + costStopEur;
  const profitEur = revenueEur - costTotalEur;
  const marginPct = revenueEur > 0 ? (profitEur / revenueEur) * 100 : 0;

  return {
    batchId:          batch.id,
    driverName:       batch.driver?.name ?? null,
    vehicle:          vehicle as TourProfitItem['vehicle'],
    zone:             batch.zone,
    state:            batch.state,
    stopsTotal:       stopCount,
    stopsCompleted:   completedCount,
    startedAt:        batch.started_at,
    totalDistanceKm:  distanceKm,
    totalEtaMin:      etaMin,
    revenueEur:       Math.round(revenueEur * 100) / 100,
    costDriverTimeEur: Math.round(costDriverTimeEur * 100) / 100,
    costKmEur:        Math.round(costKmEur * 100) / 100,
    costStopEur:      Math.round(costStopEur * 100) / 100,
    costTotalEur:     Math.round(costTotalEur * 100) / 100,
    profitEur:        Math.round(profitEur * 100) / 100,
    marginPct:        Math.round(marginPct * 10) / 10,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getTourProfitDashboard(locationId: string): Promise<TourProfitDashboard> {
  const svc = createServiceClient();

  const shiftStart = new Date();
  shiftStart.setHours(shiftStart.getHours() - 12, 0, 0, 0); // letzte 12h als "Schicht"

  const [
    { data: configRow },
    { data: activeBatches },
    { data: allStops },
    { data: completedBatches },
  ] = await Promise.all([
    // Kostenkonfiguration für Location
    svc.from('delivery_cost_config')
      .select('cost_driver_hourly_eur, cost_per_km_bicycle_eur, cost_per_km_ebike_eur, cost_per_km_scooter_eur, cost_per_km_moped_eur, cost_per_km_car_eur, cost_packaging_eur, cost_insurance_per_del')
      .eq('location_id', locationId)
      .maybeSingle(),

    // Aktive Touren (unterwegs)
    svc.from('mise_delivery_batches')
      .select('id, driver_id, state, zone, started_at, total_distance_km, total_eta_min, dispatch_score, driver:mise_drivers!driver_id(name, vehicle)')
      .eq('location_id', locationId)
      .in('state', ['pending_acceptance', 'accepted', 'at_restaurant', 'en_route', 'returning', 'unterwegs', 'on_route'])
      .order('started_at', { ascending: false })
      .limit(20),

    // Stops für aktive Touren (geladen nach dem Batch-Query)
    svc.from('mise_delivery_batch_stops')
      .select('id, batch_id, type, delivered_at, order:customer_orders!order_id(id, gesamtbetrag)')
      .eq('location_id', locationId)
      .in('type', ['pickup', 'dropoff']),

    // Abgeschlossene Touren der laufenden Schicht (für Session-Totals)
    svc.from('mise_delivery_batches')
      .select('id, total_distance_km, total_eta_min, state, driver:mise_drivers!driver_id(vehicle)')
      .eq('location_id', locationId)
      .eq('state', 'completed')
      .gte('completed_at', shiftStart.toISOString())
      .limit(100),
  ]);

  const cfg: CostConfig = {
    ...DEFAULT_COST_CONFIG,
    ...(configRow ?? {}),
  };

  // Supabase returns joined relations as arrays (one-to-one flattened); cast via unknown
  const batchList = (activeBatches ?? []) as unknown as BatchRow[];
  const stopList = (allStops ?? []) as unknown as StopRow[];

  // Stops je Batch gruppieren
  const stopsByBatch = new Map<string, StopRow[]>();
  for (const s of stopList) {
    const arr = stopsByBatch.get(s.batch_id) ?? [];
    arr.push(s);
    stopsByBatch.set(s.batch_id, arr);
  }

  // Aktive Touren berechnen
  const activeTourItems: TourProfitItem[] = batchList.map((b) =>
    computeTourProfit(b, stopsByBatch.get(b.id) ?? [], cfg),
  );

  // Session-Totals: aktive + abgeschlossene
  const sessionActive = activeTourItems.reduce(
    (acc, t) => ({
      revenue: acc.revenue + t.revenueEur,
      cost: acc.cost + t.costTotalEur,
      profit: acc.profit + t.profitEur,
    }),
    { revenue: 0, cost: 0, profit: 0 },
  );

  // Abgeschlossene Touren: Profit aus verfügbaren trip_cost-Daten (oder Schätzung)
  const { data: completedTripCosts } = await svc
    .from('delivery_trip_costs')
    .select('revenue_eur, cost_total_eur, profit_eur')
    .eq('location_id', locationId)
    .gte('started_at', shiftStart.toISOString());

  const completedTotals = ((completedTripCosts ?? []) as Array<{
    revenue_eur: number | null;
    cost_total_eur: number | null;
    profit_eur: number | null;
  }>).reduce(
    (acc, r) => ({
      revenue: acc.revenue + (Number(r.revenue_eur) || 0),
      cost: acc.cost + (Number(r.cost_total_eur) || 0),
      profit: acc.profit + (Number(r.profit_eur) || 0),
    }),
    { revenue: 0, cost: 0, profit: 0 },
  );

  const totalRevenue = sessionActive.revenue + completedTotals.revenue;
  const totalCost = sessionActive.cost + completedTotals.cost;
  const totalProfit = sessionActive.profit + completedTotals.profit;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    locationId,
    activeTours: activeTourItems,
    sessionTotals: {
      revenueEur:     Math.round(totalRevenue * 100) / 100,
      costEur:        Math.round(totalCost * 100) / 100,
      profitEur:      Math.round(totalProfit * 100) / 100,
      marginPct:      Math.round(totalMargin * 10) / 10,
      completedTours: (completedBatches ?? []).length,
      activeTours:    activeTourItems.length,
    },
    costConfig: {
      driverHourlyEur:  cfg.cost_driver_hourly_eur,
      costPerKmBike:    cfg.cost_per_km_bicycle_eur,
      costPerKmCar:     cfg.cost_per_km_car_eur,
      packagingPerStop: cfg.cost_packaging_eur,
      insurancePerStop: cfg.cost_insurance_per_del,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Historische Snapshots ──────────────────────────────────────────────────────

export interface TourProfitSnapshot {
  id: string;
  locationId: string;
  snapshotDate: string;
  toursCompleted: number;
  deliveriesCount: number;
  totalDistanceKm: number;
  totalRevenueEur: number;
  totalCostEur: number;
  totalProfitEur: number;
  marginPct: number | null;
  avgProfitPerTourEur: number | null;
  avgMarginPct: number | null;
  avgTripDurationMin: number | null;
  zoneBreakdown: Record<string, { revenue: number; cost: number; profit: number; tours: number }>;
  vehicleBreakdown: Record<string, { revenue: number; cost: number; profit: number; tours: number }>;
  topDriverId: string | null;
  topDriverName: string | null;
  topDriverProfitEur: number | null;
  topDriverMarginPct: number | null;
  createdAt: string;
}

export interface DriverProfitEntry {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  toursCount: number;
  deliveriesCount: number;
  totalDistanceKm: number;
  totalRevenueEur: number;
  totalCostEur: number;
  totalProfitEur: number;
  avgMarginPct: number | null;
  avgTripDurationMin: number | null;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Erstellt einen Tages-Snapshot für eine Location (Cron täglich 02:45 UTC). */
export async function snapshotDailyProfit(
  locationId: string,
  date: Date = new Date(),
): Promise<{ snapshotDate: string; tours: number; profit: number }> {
  const svc = createServiceClient();

  const snapshotDate = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${snapshotDate}T00:00:00.000Z`);
  const dayEnd   = new Date(`${snapshotDate}T23:59:59.999Z`);

  // Basis: delivery_trip_costs für diesen Tag
  const { data: tripCosts } = await svc
    .from('delivery_trip_costs')
    .select('batch_id, driver_id, total_distance_km, stops_count, total_cost_eur, net_revenue_eur, gross_margin_eur, margin_pct, vehicle_type, trip_duration_min, completed_at')
    .eq('location_id', locationId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', dayEnd.toISOString());

  const rows = (tripCosts ?? []) as Array<{
    batch_id: string;
    driver_id: string | null;
    total_distance_km: number | null;
    stops_count: number | null;
    total_cost_eur: number | null;
    net_revenue_eur: number | null;
    gross_margin_eur: number | null;
    margin_pct: number | null;
    vehicle_type: string | null;
    trip_duration_min: number | null;
    completed_at: string | null;
  }>;

  if (rows.length === 0) {
    const { error } = await svc.from('tour_profit_snapshots').upsert({
      location_id: locationId,
      snapshot_date: snapshotDate,
      tours_completed: 0,
      deliveries_count: 0,
      total_distance_km: 0,
      total_revenue_eur: 0,
      total_cost_eur: 0,
      total_profit_eur: 0,
      margin_pct: null,
      avg_profit_per_tour_eur: null,
      avg_margin_pct: null,
      avg_trip_duration_min: null,
      zone_breakdown: {},
      vehicle_breakdown: {},
      top_driver_id: null,
      top_driver_name: null,
      top_driver_profit_eur: null,
      top_driver_margin_pct: null,
    }, { onConflict: 'location_id,snapshot_date' });
    if (error) throw new Error(`snapshot upsert failed: ${error.message}`);
    return { snapshotDate, tours: 0, profit: 0 };
  }

  // Zone-Zuordnung: lade mise_delivery_batches.zone für die batch_ids
  const batchIds = rows.map((r) => r.batch_id).filter(Boolean);
  const { data: batchZones } = await svc
    .from('mise_delivery_batches')
    .select('id, zone')
    .in('id', batchIds);
  const zoneMap = new Map<string, string | null>((batchZones ?? []).map((b) => [b.id, b.zone as string | null]));

  // Driver-Namen laden
  const driverIds = [...new Set(rows.map((r) => r.driver_id).filter((id): id is string => !!id))];
  const { data: drivers } = driverIds.length
    ? await svc.from('mise_drivers').select('id, name').in('id', driverIds)
    : { data: [] };
  const driverNameMap = new Map<string, string>((drivers ?? []).map((d) => [d.id as string, d.name as string]));

  // Aggregation
  let totalRev = 0, totalCost = 0, totalProfit = 0, totalDist = 0;
  let totalStops = 0, totalDurMin = 0, durCount = 0;

  const vehicleBreakdown: Record<string, { revenue: number; cost: number; profit: number; tours: number }> = {};
  const zoneBreakdown: Record<string, { revenue: number; cost: number; profit: number; tours: number }> = {};
  const driverAccum: Map<string, { revenue: number; cost: number; profit: number; tours: number; stops: number; durationMin: number }> = new Map();

  for (const row of rows) {
    const rev    = Number(row.net_revenue_eur ?? 0);
    const cost   = Number(row.total_cost_eur ?? 0);
    const profit = Number(row.gross_margin_eur ?? 0);
    const dist   = Number(row.total_distance_km ?? 0);
    const stops  = Number(row.stops_count ?? 0);
    const dur    = row.trip_duration_min != null ? Number(row.trip_duration_min) : null;

    totalRev    += rev;
    totalCost   += cost;
    totalProfit += profit;
    totalDist   += dist;
    totalStops  += stops;
    if (dur != null) { totalDurMin += dur; durCount++; }

    const veh  = row.vehicle_type ?? 'unknown';
    const zone = zoneMap.get(row.batch_id) ?? 'unknown';

    const updateBreakdown = (
      map: Record<string, { revenue: number; cost: number; profit: number; tours: number }>,
      key: string,
    ) => {
      if (!map[key]) map[key] = { revenue: 0, cost: 0, profit: 0, tours: 0 };
      map[key].revenue += rev;
      map[key].cost    += cost;
      map[key].profit  += profit;
      map[key].tours   += 1;
    };
    updateBreakdown(vehicleBreakdown, veh);
    updateBreakdown(zoneBreakdown, zone);

    if (row.driver_id) {
      const d = driverAccum.get(row.driver_id) ?? { revenue: 0, cost: 0, profit: 0, tours: 0, stops: 0, durationMin: 0 };
      d.revenue += rev; d.cost += cost; d.profit += profit;
      d.tours += 1; d.stops += stops;
      if (dur != null) d.durationMin += dur;
      driverAccum.set(row.driver_id, d);
    }
  }

  const toursCompleted = rows.length;
  const marginPct = totalRev > 0 ? (totalProfit / totalRev) * 100 : null;
  const avgProfitPerTour = toursCompleted > 0 ? totalProfit / toursCompleted : null;
  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : null;
  const avgDuration = durCount > 0 ? totalDurMin / durCount : null;

  // Top-Fahrer
  let topDriverId: string | null = null;
  let topDriverProfit = -Infinity;
  for (const [dId, d] of driverAccum) {
    if (d.profit > topDriverProfit) { topDriverProfit = d.profit; topDriverId = dId; }
  }
  const topDriverEntry = topDriverId ? driverAccum.get(topDriverId)! : null;
  const topDriverMargin = topDriverEntry && topDriverEntry.revenue > 0
    ? (topDriverEntry.profit / topDriverEntry.revenue) * 100 : null;

  const { error } = await svc.from('tour_profit_snapshots').upsert({
    location_id:             locationId,
    snapshot_date:           snapshotDate,
    tours_completed:         toursCompleted,
    deliveries_count:        totalStops,
    total_distance_km:       r2(totalDist),
    total_revenue_eur:       r2(totalRev),
    total_cost_eur:          r2(totalCost),
    total_profit_eur:        r2(totalProfit),
    margin_pct:              marginPct != null ? r2(marginPct) : null,
    avg_profit_per_tour_eur: avgProfitPerTour != null ? r2(avgProfitPerTour) : null,
    avg_margin_pct:          avgMargin != null ? r2(avgMargin) : null,
    avg_trip_duration_min:   avgDuration != null ? r2(avgDuration) : null,
    zone_breakdown:          zoneBreakdown,
    vehicle_breakdown:       vehicleBreakdown,
    top_driver_id:           topDriverId,
    top_driver_name:         topDriverId ? (driverNameMap.get(topDriverId) ?? null) : null,
    top_driver_profit_eur:   topDriverId ? r2(topDriverProfit) : null,
    top_driver_margin_pct:   topDriverMargin != null ? r2(topDriverMargin) : null,
  }, { onConflict: 'location_id,snapshot_date' });

  if (error) throw new Error(`tour_profit_snapshots upsert failed: ${error.message}`);

  return { snapshotDate, tours: toursCompleted, profit: r2(totalProfit) };
}

/** Liest historische Tages-Snapshots (letzte N Tage). */
export async function getTourProfitHistory(
  locationId: string,
  days = 30,
): Promise<TourProfitSnapshot[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await svc
    .from('tour_profit_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: false })
    .limit(days + 5);

  if (error) throw new Error(`history query failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    locationId: r.location_id as string,
    snapshotDate: r.snapshot_date as string,
    toursCompleted: Number(r.tours_completed),
    deliveriesCount: Number(r.deliveries_count),
    totalDistanceKm: Number(r.total_distance_km),
    totalRevenueEur: Number(r.total_revenue_eur),
    totalCostEur: Number(r.total_cost_eur),
    totalProfitEur: Number(r.total_profit_eur),
    marginPct: r.margin_pct != null ? Number(r.margin_pct) : null,
    avgProfitPerTourEur: r.avg_profit_per_tour_eur != null ? Number(r.avg_profit_per_tour_eur) : null,
    avgMarginPct: r.avg_margin_pct != null ? Number(r.avg_margin_pct) : null,
    avgTripDurationMin: r.avg_trip_duration_min != null ? Number(r.avg_trip_duration_min) : null,
    zoneBreakdown: (r.zone_breakdown ?? {}) as TourProfitSnapshot['zoneBreakdown'],
    vehicleBreakdown: (r.vehicle_breakdown ?? {}) as TourProfitSnapshot['vehicleBreakdown'],
    topDriverId: (r.top_driver_id as string | null) ?? null,
    topDriverName: (r.top_driver_name as string | null) ?? null,
    topDriverProfitEur: r.top_driver_profit_eur != null ? Number(r.top_driver_profit_eur) : null,
    topDriverMarginPct: r.top_driver_margin_pct != null ? Number(r.top_driver_margin_pct) : null,
    createdAt: r.created_at as string,
  }));
}

/** Fahrer-Gewinn-Aufschlüsselung (letzte N Tage aus delivery_trip_costs). */
export async function getDriverProfitBreakdown(
  locationId: string,
  days = 30,
): Promise<DriverProfitEntry[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: trips } = await svc
    .from('delivery_trip_costs')
    .select('driver_id, total_distance_km, stops_count, total_cost_eur, net_revenue_eur, gross_margin_eur, vehicle_type, trip_duration_min')
    .eq('location_id', locationId)
    .gte('completed_at', since);

  const rows = (trips ?? []) as Array<{
    driver_id: string | null;
    total_distance_km: number | null;
    stops_count: number | null;
    total_cost_eur: number | null;
    net_revenue_eur: number | null;
    gross_margin_eur: number | null;
    vehicle_type: string | null;
    trip_duration_min: number | null;
  }>;

  const driverMap = new Map<string, { revenue: number; cost: number; profit: number; tours: number; stops: number; distance: number; durationMin: number; vehicle: string | null }>();

  for (const row of rows) {
    const dId = row.driver_id;
    if (!dId) continue;
    const d = driverMap.get(dId) ?? { revenue: 0, cost: 0, profit: 0, tours: 0, stops: 0, distance: 0, durationMin: 0, vehicle: null };
    d.revenue  += Number(row.net_revenue_eur ?? 0);
    d.cost     += Number(row.total_cost_eur ?? 0);
    d.profit   += Number(row.gross_margin_eur ?? 0);
    d.tours    += 1;
    d.stops    += Number(row.stops_count ?? 0);
    d.distance += Number(row.total_distance_km ?? 0);
    if (row.trip_duration_min != null) d.durationMin += Number(row.trip_duration_min);
    d.vehicle  = d.vehicle ?? row.vehicle_type;
    driverMap.set(dId, d);
  }

  if (driverMap.size === 0) return [];

  const driverIds = [...driverMap.keys()];
  const { data: driverRows } = await svc
    .from('mise_drivers')
    .select('id, name, vehicle')
    .in('id', driverIds);
  const driverInfoMap = new Map<string, { name: string | null; vehicle: string | null }>(
    (driverRows ?? []).map((d) => [d.id as string, { name: d.name as string | null, vehicle: d.vehicle as string | null }]),
  );

  return [...driverMap.entries()]
    .map(([dId, d]) => {
      const info = driverInfoMap.get(dId);
      return {
        driverId: dId,
        driverName: info?.name ?? null,
        vehicle: d.vehicle ?? info?.vehicle ?? null,
        toursCount: d.tours,
        deliveriesCount: d.stops,
        totalDistanceKm: r2(d.distance),
        totalRevenueEur: r2(d.revenue),
        totalCostEur: r2(d.cost),
        totalProfitEur: r2(d.profit),
        avgMarginPct: d.revenue > 0 ? r2((d.profit / d.revenue) * 100) : null,
        avgTripDurationMin: d.tours > 0 ? r2(d.durationMin / d.tours) : null,
      };
    })
    .sort((a, b) => b.totalProfitEur - a.totalProfitEur);
}

/** Cron-Batch: Snapshot für alle aktiven Locations. */
export async function snapshotTourProfitAllLocations(date?: Date): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true);

  const locationIds = (locs ?? []).map((l) => l.id as string);
  let snapshots = 0;
  let errors = 0;

  await Promise.allSettled(
    locationIds.map(async (lid) => {
      try {
        await snapshotDailyProfit(lid, date);
        snapshots++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locationIds.length, snapshots, errors };
}

/** Prune alte Snapshots (via RPC). */
export async function pruneTourProfitSnapshots(daysToKeep = 90): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_tour_profit_snapshots', { days_to_keep: daysToKeep });
  if (error) throw new Error(`prune failed: ${error.message}`);
  const pruned = (data as Array<{ pruned: number }> | null)?.[0]?.pruned ?? 0;
  return { pruned };
}
