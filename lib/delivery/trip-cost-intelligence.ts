/**
 * lib/delivery/trip-cost-intelligence.ts
 *
 * Phase 183: Smart Trip Cost Intelligence Engine
 *
 * Calculates the true economics of every delivery tour:
 *   - Driver time cost (hourly rate × trip duration)
 *   - Fuel / wear cost (per-km rate × distance, by vehicle type)
 *   - Fixed costs per stop (packaging, insurance)
 *   - Revenue (delivery fees collected minus platform cut)
 *   - Gross margin per trip
 *
 * Public API:
 *   getOrCreateConfig(locationId)            — fetch config, seed defaults if missing
 *   upsertConfig(locationId, input)          — save cost config
 *   computeTripCost(batchId, locationId)     — calculate economics for one batch
 *   computeRecentBatches(locationId, hours?) — backfill last N hours
 *   computeAllLocations()                    — cron batch
 *   getDashboard(locationId)                 — KPIs + trends + driver breakdown + loss list
 *   getLossMakingTrips(locationId, limit?)   — trips below breakeven
 *   getDriverCostProfile(locationId)         — per-driver cost efficiency
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostConfig {
  locationId: string;
  costDriverHourlyEur: number;
  costPerKmBicycleEur: number;
  costPerKmEbikeEur: number;
  costPerKmScooterEur: number;
  costPerKmMopedEur: number;
  costPerKmCarEur: number;
  costPackagingEur: number;
  costInsurancePerDel: number;
  platformFeePct: number;
  updatedAt: string;
}

export interface CostConfigInput {
  costDriverHourlyEur?: number;
  costPerKmBicycleEur?: number;
  costPerKmEbikeEur?: number;
  costPerKmScooterEur?: number;
  costPerKmMopedEur?: number;
  costPerKmCarEur?: number;
  costPackagingEur?: number;
  costInsurancePerDel?: number;
  platformFeePct?: number;
}

export interface TripCost {
  id: string;
  batchId: string;
  locationId: string;
  driverId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  tripDurationMin: number | null;
  totalDistanceKm: number;
  stopsCount: number;
  costDriverTimeEur: number;
  costFuelKmEur: number;
  costPackagingEur: number;
  costInsuranceEur: number;
  totalCostEur: number;
  deliveryFeesEur: number;
  platformFeesEur: number;
  netRevenueEur: number;
  grossMarginEur: number;
  marginPct: number | null;
  vehicleType: string | null;
  computedAt: string;
}

export interface DailyCostSummary {
  snapshotDate: string;
  tripsCount: number;
  deliveriesCount: number;
  totalDistanceKm: number;
  totalCostEur: number;
  totalFeesEur: number;
  totalMarginEur: number;
  avgTripMin: number | null;
  avgDistanceKm: number | null;
  avgMarginEur: number | null;
  marginPct: number | null;
  lossTrips: number;
}

export interface DriverCostProfile {
  driverId: string;
  driverName: string | null;
  tripsCount: number;
  deliveriesCount: number;
  totalDistanceKm: number;
  totalCostEur: number;
  totalRevenueEur: number;
  totalMarginEur: number;
  avgMarginPerTripEur: number | null;
  avgDistanceKmPerTrip: number | null;
  lossTrips: number;
  marginPct: number | null;
  vehicleType: string | null;
}

export interface CostBreakdown {
  driverTimePct: number;
  fuelKmPct: number;
  packagingPct: number;
  insurancePct: number;
  totalCostEur: number;
}

export interface TripCostDashboard {
  config: CostConfig;
  summary30d: {
    tripsCount: number;
    deliveriesCount: number;
    totalCostEur: number;
    totalRevenueEur: number;
    totalMarginEur: number;
    overallMarginPct: number | null;
    lossTrips: number;
    lossTriPct: number | null;
    avgMarginPerTripEur: number | null;
    totalDistanceKm: number;
  };
  dailyTrend14d: DailyCostSummary[];
  costBreakdown: CostBreakdown;
  drivers: DriverCostProfile[];
  lossMaking: TripCost[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function perKmRate(vehicleType: string | null, cfg: CostConfig): number {
  switch (vehicleType) {
    case 'bicycle': return cfg.costPerKmBicycleEur;
    case 'ebike':   return cfg.costPerKmEbikeEur;
    case 'scooter': return cfg.costPerKmScooterEur;
    case 'moped':   return cfg.costPerKmMopedEur;
    case 'car':     return cfg.costPerKmCarEur;
    default:        return cfg.costPerKmScooterEur; // safe default
  }
}

function rowToConfig(row: Record<string, unknown>): CostConfig {
  return {
    locationId: row.location_id as string,
    costDriverHourlyEur: Number(row.cost_driver_hourly_eur ?? 12),
    costPerKmBicycleEur: Number(row.cost_per_km_bicycle_eur ?? 0),
    costPerKmEbikeEur:   Number(row.cost_per_km_ebike_eur ?? 0.05),
    costPerKmScooterEur: Number(row.cost_per_km_scooter_eur ?? 0.18),
    costPerKmMopedEur:   Number(row.cost_per_km_moped_eur ?? 0.18),
    costPerKmCarEur:     Number(row.cost_per_km_car_eur ?? 0.30),
    costPackagingEur:    Number(row.cost_packaging_eur ?? 0.50),
    costInsurancePerDel: Number(row.cost_insurance_per_del ?? 0.20),
    platformFeePct:      Number(row.platform_fee_pct ?? 0),
    updatedAt: row.updated_at as string,
  };
}

function rowToTripCost(row: Record<string, unknown>): TripCost {
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    locationId: row.location_id as string,
    driverId: row.driver_id as string | null,
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
    tripDurationMin: row.trip_duration_min != null ? Number(row.trip_duration_min) : null,
    totalDistanceKm: Number(row.total_distance_km ?? 0),
    stopsCount: Number(row.stops_count ?? 0),
    costDriverTimeEur: Number(row.cost_driver_time_eur ?? 0),
    costFuelKmEur: Number(row.cost_fuel_km_eur ?? 0),
    costPackagingEur: Number(row.cost_packaging_eur ?? 0),
    costInsuranceEur: Number(row.cost_insurance_eur ?? 0),
    totalCostEur: Number(row.total_cost_eur ?? 0),
    deliveryFeesEur: Number(row.delivery_fees_eur ?? 0),
    platformFeesEur: Number(row.platform_fees_eur ?? 0),
    netRevenueEur: Number(row.net_revenue_eur ?? 0),
    grossMarginEur: Number(row.gross_margin_eur ?? 0),
    marginPct: row.margin_pct != null ? Number(row.margin_pct) : null,
    vehicleType: row.vehicle_type as string | null,
    computedAt: row.computed_at as string,
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getOrCreateConfig(locationId: string): Promise<CostConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_cost_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (data) return rowToConfig(data as Record<string, unknown>);

  // Seed defaults
  const { data: inserted } = await sb
    .from('delivery_cost_config')
    .insert({ location_id: locationId })
    .select()
    .single();

  if (!inserted) {
    // Table doesn't exist yet — return default object
    return {
      locationId,
      costDriverHourlyEur: 12,
      costPerKmBicycleEur: 0,
      costPerKmEbikeEur: 0.05,
      costPerKmScooterEur: 0.18,
      costPerKmMopedEur: 0.18,
      costPerKmCarEur: 0.30,
      costPackagingEur: 0.50,
      costInsurancePerDel: 0.20,
      platformFeePct: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return rowToConfig(inserted as Record<string, unknown>);
}

export async function upsertConfig(locationId: string, input: CostConfigInput): Promise<CostConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_cost_config')
    .upsert({
      location_id: locationId,
      ...(input.costDriverHourlyEur !== undefined && { cost_driver_hourly_eur: input.costDriverHourlyEur }),
      ...(input.costPerKmBicycleEur !== undefined && { cost_per_km_bicycle_eur: input.costPerKmBicycleEur }),
      ...(input.costPerKmEbikeEur !== undefined && { cost_per_km_ebike_eur: input.costPerKmEbikeEur }),
      ...(input.costPerKmScooterEur !== undefined && { cost_per_km_scooter_eur: input.costPerKmScooterEur }),
      ...(input.costPerKmMopedEur !== undefined && { cost_per_km_moped_eur: input.costPerKmMopedEur }),
      ...(input.costPerKmCarEur !== undefined && { cost_per_km_car_eur: input.costPerKmCarEur }),
      ...(input.costPackagingEur !== undefined && { cost_packaging_eur: input.costPackagingEur }),
      ...(input.costInsurancePerDel !== undefined && { cost_insurance_per_del: input.costInsurancePerDel }),
      ...(input.platformFeePct !== undefined && { platform_fee_pct: input.platformFeePct }),
    }, { onConflict: 'location_id' })
    .select()
    .single();

  return rowToConfig((data ?? { location_id: locationId, updated_at: new Date().toISOString() }) as Record<string, unknown>);
}

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Compute and store the cost economics for a single completed batch.
 * Idempotent — uses UPSERT on batch_id.
 */
export async function computeTripCost(
  batchId: string,
  locationId: string,
): Promise<TripCost | null> {
  const sb = createServiceClient();

  // Load batch
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, fahrer_id, started_at, completed_at, total_distance_km')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return null;
  if ((batch.completed_at as string | null) == null) return null; // not done

  // Load stops + orders to get fees and stop count
  const { data: stops } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, type')
    .eq('batch_id', batchId)
    .eq('type', 'dropoff');

  const dropoffCount = (stops ?? []).length;
  if (dropoffCount === 0) return null;

  const orderIds = (stops ?? [])
    .map((s) => (s as Record<string, unknown>).order_id as string)
    .filter(Boolean);

  // Get delivery fees from orders
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, liefergebuehr')
    .in('id', orderIds);

  const totalFees = (orders ?? []).reduce((sum, o) => {
    return sum + Number((o as Record<string, unknown>).liefergebuehr ?? 0);
  }, 0);

  // Get driver vehicle type
  const driverId = batch.fahrer_id as string | null;
  let vehicleType: string | null = null;
  if (driverId) {
    const { data: driver } = await sb
      .from('mise_drivers')
      .select('vehicle_type')
      .eq('id', driverId)
      .maybeSingle();
    vehicleType = driver ? (driver as Record<string, unknown>).vehicle_type as string | null : null;
  }

  // Load cost config
  const cfg = await getOrCreateConfig(locationId);

  // Calculate duration
  const startedAt = batch.started_at as string | null;
  const completedAt = batch.completed_at as string;
  let durationMin: number | null = null;
  if (startedAt) {
    durationMin = (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60_000;
    if (durationMin < 0 || durationMin > 480) durationMin = null; // sanity: max 8h
  }

  // Distance
  const distanceKm = Math.max(0, Number(batch.total_distance_km ?? 0));

  // Cost components
  const costDriverTime = durationMin != null
    ? (durationMin / 60) * cfg.costDriverHourlyEur
    : 0;
  const kmRate = perKmRate(vehicleType, cfg);
  const costFuel = distanceKm * kmRate;
  const costPackaging = dropoffCount * cfg.costPackagingEur;
  const costInsurance = dropoffCount * cfg.costInsurancePerDel;
  const totalCost = costDriverTime + costFuel + costPackaging + costInsurance;

  // Revenue
  const platformFees = totalFees * (cfg.platformFeePct / 100);
  const netRevenue = totalFees - platformFees;
  const grossMargin = netRevenue - totalCost;
  const marginPct = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : null;

  const record = {
    batch_id: batchId,
    location_id: locationId,
    driver_id: driverId,
    started_at: startedAt,
    completed_at: completedAt,
    trip_duration_min: durationMin,
    total_distance_km: distanceKm,
    stops_count: dropoffCount,
    cost_driver_time_eur: Math.round(costDriverTime * 100) / 100,
    cost_fuel_km_eur: Math.round(costFuel * 100) / 100,
    cost_packaging_eur: Math.round(costPackaging * 100) / 100,
    cost_insurance_eur: Math.round(costInsurance * 100) / 100,
    total_cost_eur: Math.round(totalCost * 100) / 100,
    delivery_fees_eur: Math.round(totalFees * 100) / 100,
    platform_fees_eur: Math.round(platformFees * 100) / 100,
    net_revenue_eur: Math.round(netRevenue * 100) / 100,
    gross_margin_eur: Math.round(grossMargin * 100) / 100,
    margin_pct: marginPct != null ? Math.round(marginPct * 10) / 10 : null,
    vehicle_type: vehicleType,
  };

  const { data: upserted } = await sb
    .from('delivery_trip_costs')
    .upsert(record, { onConflict: 'batch_id' })
    .select()
    .single();

  return upserted ? rowToTripCost(upserted as Record<string, unknown>) : null;
}

/**
 * Compute costs for all completed batches in the last N hours that don't yet have a record.
 */
export async function computeRecentBatches(
  locationId: string,
  hours = 48,
): Promise<{ computed: number; errors: number }> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id')
    .eq('location_id', locationId)
    .not('completed_at', 'is', null)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(200);

  if (!batches?.length) return { computed: 0, errors: 0 };

  // Find which ones already have a cost record
  const batchIds = batches.map((b) => (b as Record<string, unknown>).id as string);
  const { data: existing } = await sb
    .from('delivery_trip_costs')
    .select('batch_id')
    .in('batch_id', batchIds);

  const existingSet = new Set((existing ?? []).map((r) => (r as Record<string, unknown>).batch_id as string));
  const toCompute = batchIds.filter((id) => !existingSet.has(id));

  let computed = 0;
  let errors = 0;
  for (const batchId of toCompute) {
    try {
      const r = await computeTripCost(batchId, locationId);
      if (r) computed++;
    } catch {
      errors++;
    }
  }
  return { computed, errors };
}

/**
 * Cron batch — compute recent batches for all active locations.
 */
export async function computeAllLocations(): Promise<{ locations: number; computed: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  let totalComputed = 0;
  let totalErrors = 0;
  for (const loc of locs ?? []) {
    const r = await computeRecentBatches(loc.id as string, 26).catch(() => ({ computed: 0, errors: 1 }));
    totalComputed += r.computed;
    totalErrors += r.errors;
  }
  return { locations: (locs ?? []).length, computed: totalComputed, errors: totalErrors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getLossMakingTrips(locationId: string, limit = 20): Promise<TripCost[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data } = await sb
    .from('delivery_trip_costs')
    .select('*')
    .eq('location_id', locationId)
    .lt('gross_margin_eur', 0)
    .gte('computed_at', since)
    .order('gross_margin_eur', { ascending: true })
    .limit(limit);

  return (data ?? []).map((r) => rowToTripCost(r as Record<string, unknown>));
}

export async function getDriverCostProfile(locationId: string): Promise<DriverCostProfile[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: rows } = await sb
    .from('delivery_trip_costs')
    .select('driver_id, total_distance_km, stops_count, total_cost_eur, net_revenue_eur, gross_margin_eur, trip_duration_min, vehicle_type')
    .eq('location_id', locationId)
    .not('driver_id', 'is', null)
    .gte('computed_at', since);

  if (!rows?.length) return [];

  // Aggregate per driver
  const map = new Map<string, {
    tripsCount: number;
    deliveries: number;
    distKm: number;
    cost: number;
    revenue: number;
    margin: number;
    lossTrips: number;
    vehicleType: string | null;
  }>();

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const dId = row.driver_id as string;
    const existing = map.get(dId) ?? {
      tripsCount: 0, deliveries: 0, distKm: 0, cost: 0,
      revenue: 0, margin: 0, lossTrips: 0, vehicleType: null,
    };
    existing.tripsCount++;
    existing.deliveries += Number(row.stops_count ?? 0);
    existing.distKm += Number(row.total_distance_km ?? 0);
    existing.cost += Number(row.total_cost_eur ?? 0);
    existing.revenue += Number(row.net_revenue_eur ?? 0);
    existing.margin += Number(row.gross_margin_eur ?? 0);
    if (Number(row.gross_margin_eur ?? 0) < 0) existing.lossTrips++;
    if (!existing.vehicleType) existing.vehicleType = row.vehicle_type as string | null;
    map.set(dId, existing);
  }

  // Load driver names
  const driverIds = [...map.keys()];
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, vorname, nachname')
    .in('id', driverIds);

  const nameMap = new Map<string, string>();
  for (const d of drivers ?? []) {
    const dr = d as Record<string, unknown>;
    nameMap.set(dr.id as string, [dr.vorname, dr.nachname].filter(Boolean).join(' ') || null as unknown as string);
  }

  return [...map.entries()].map(([dId, s]) => ({
    driverId: dId,
    driverName: nameMap.get(dId) ?? null,
    tripsCount: s.tripsCount,
    deliveriesCount: s.deliveries,
    totalDistanceKm: Math.round(s.distKm * 10) / 10,
    totalCostEur: Math.round(s.cost * 100) / 100,
    totalRevenueEur: Math.round(s.revenue * 100) / 100,
    totalMarginEur: Math.round(s.margin * 100) / 100,
    avgMarginPerTripEur: s.tripsCount > 0 ? Math.round((s.margin / s.tripsCount) * 100) / 100 : null,
    avgDistanceKmPerTrip: s.tripsCount > 0 ? Math.round((s.distKm / s.tripsCount) * 10) / 10 : null,
    lossTrips: s.lossTrips,
    marginPct: s.revenue > 0 ? Math.round((s.margin / s.revenue) * 1000) / 10 : null,
    vehicleType: s.vehicleType,
  })).sort((a, b) => (b.totalMarginEur) - (a.totalMarginEur));
}

export async function getDashboard(locationId: string): Promise<TripCostDashboard> {
  const sb = createServiceClient();

  const [config, summary30dRow, dailyRows, lossRows, driverRows] = await Promise.all([
    getOrCreateConfig(locationId),
    sb
      .from('v_trip_cost_summary_30d')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle()
      .then((r) => r.data as Record<string, unknown> | null),
    sb
      .from('v_trip_cost_daily')
      .select('*')
      .eq('location_id', locationId)
      .gte('snapshot_date', new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: true })
      .limit(14)
      .then((r) => (r.data ?? []) as Record<string, unknown>[]),
    getLossMakingTrips(locationId, 10),
    getDriverCostProfile(locationId),

    // Also fetch cost breakdown from raw 30d data
  ]);

  // Cost breakdown from summary30d
  const s = summary30dRow ?? {};
  const totalCostEur = Number(s.total_cost_eur ?? 0);
  const driverTotal = Number(s.cost_driver_total ?? 0);
  const fuelTotal = Number(s.cost_fuel_total ?? 0);
  const packagingTotal = Number(s.cost_packaging_total ?? 0);
  const insuranceTotal = Number(s.cost_insurance_total ?? 0);

  const costBreakdown: CostBreakdown = {
    driverTimePct: totalCostEur > 0 ? Math.round((driverTotal / totalCostEur) * 1000) / 10 : 0,
    fuelKmPct:     totalCostEur > 0 ? Math.round((fuelTotal / totalCostEur) * 1000) / 10 : 0,
    packagingPct:  totalCostEur > 0 ? Math.round((packagingTotal / totalCostEur) * 1000) / 10 : 0,
    insurancePct:  totalCostEur > 0 ? Math.round((insuranceTotal / totalCostEur) * 1000) / 10 : 0,
    totalCostEur,
  };

  const dailyTrend14d: DailyCostSummary[] = dailyRows.map((r) => ({
    snapshotDate: r.snapshot_date as string,
    tripsCount: Number(r.trips_count ?? 0),
    deliveriesCount: Number(r.deliveries_count ?? 0),
    totalDistanceKm: Number(r.total_distance_km ?? 0),
    totalCostEur: Number(r.total_cost_eur ?? 0),
    totalFeesEur: Number(r.total_fees_eur ?? 0),
    totalMarginEur: Number(r.total_margin_eur ?? 0),
    avgTripMin: r.avg_trip_min != null ? Number(r.avg_trip_min) : null,
    avgDistanceKm: r.avg_distance_km != null ? Number(r.avg_distance_km) : null,
    avgMarginEur: r.avg_margin_eur != null ? Number(r.avg_margin_eur) : null,
    marginPct: r.margin_pct != null ? Number(r.margin_pct) : null,
    lossTrips: Number(r.loss_trips ?? 0),
  }));

  return {
    config,
    summary30d: {
      tripsCount: Number(s.trips_count ?? 0),
      deliveriesCount: Number(s.deliveries_count ?? 0),
      totalCostEur: Number(s.total_cost_eur ?? 0),
      totalRevenueEur: Number(s.total_revenue_eur ?? 0),
      totalMarginEur: Number(s.total_margin_eur ?? 0),
      overallMarginPct: s.overall_margin_pct != null ? Number(s.overall_margin_pct) : null,
      lossTrips: Number(s.loss_trips ?? 0),
      lossTriPct: s.loss_trip_pct != null ? Number(s.loss_trip_pct) : null,
      avgMarginPerTripEur: s.avg_margin_per_trip != null ? Number(s.avg_margin_per_trip) : null,
      totalDistanceKm: Number(s.total_distance_km ?? 0),
    },
    dailyTrend14d,
    costBreakdown,
    drivers: driverRows,
    lossMaking: lossRows,
  };
}
