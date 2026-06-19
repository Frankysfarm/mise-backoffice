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
