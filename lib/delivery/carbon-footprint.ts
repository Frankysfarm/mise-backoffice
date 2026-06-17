/**
 * lib/delivery/carbon-footprint.ts
 *
 * Phase 212: Smart Delivery Carbon Footprint Engine
 *
 * Berechnet tägliche CO₂-Emissionen und Einsparungen pro Location und Fahrer
 * auf Basis von Fahrzeugtyp × gefahrene km (aus tour_performance_snapshots).
 *
 * CO₂-Raten pro km (kg) — stimmt mit Frontend TourCo2Tracker überein:
 *   fahrrad 0.000 · lastenrad 0.005 · ebike 0.012 · moped 0.065
 *   motorrad 0.103 · auto/car/default 0.168 (Baseline für Einspar-Berechnung)
 *
 * Baum-Äquivalent: 21.77 kg CO₂ absorbiert ein Baum pro Jahr (Durchschnitt).
 *
 * Public API:
 *   snapshotCarbonFootprint(locationId)   — Yesterday-Snapshot für eine Location
 *   snapshotCarbonAllLocations()          — Cron-Batch alle aktiven Locations
 *   getCarbonDashboard(locationId)        — KPI-Summary + Trend + Leaderboard
 *   getDriverLeaderboard(locationId)      — 30d Eco-Ranking der Fahrer
 *   getCo2Trend(locationId)               — Tages-Trend letzte 30d
 *   pruneCo2Snapshots(daysToKeep)         — Cleanup via SQL-Funktion
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from './events';

// ─── CO₂-Raten ───────────────────────────────────────────────────────────────

const CO2_PER_KM: Record<string, number> = {
  fahrrad:   0.0,
  lastenrad: 0.005,
  ebike:     0.012,
  moped:     0.065,
  motorrad:  0.103,
  auto:      0.168,
  car:       0.168,
  default:   0.168,
};
const CAR_BASELINE_KG_PER_KM = 0.168;
const KG_CO2_PER_TREE_PER_YEAR = 21.77;

function co2Rate(vehicleType: string): number {
  const key = vehicleType.toLowerCase().trim();
  return CO2_PER_KM[key] ?? CO2_PER_KM.default;
}

function isEcoVehicle(vehicleType: string): boolean {
  return co2Rate(vehicleType) < CAR_BASELINE_KG_PER_KM;
}

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface Co2SnapshotResult {
  locationId: string;
  date: string;
  totalCo2Kg: number;
  co2SavedKg: number;
  totalTours: number;
  ecoTours: number;
  totalDistanceKm: number;
  avgCo2PerTour: number;
  ecoRatePct: number;
  treesEquivalent: number;
}

export interface DriverCo2Row {
  driverId: string;
  locationId: string;
  driverName: string;
  vehicleType: string;
  tours30d: number;
  distanceKm30d: number;
  co2Kg30d: number;
  co2SavedKg30d: number;
  avgCo2PerTour: number;
  treesEquivalent: number;
}

export interface Co2TrendDay {
  snapshotDate: string;
  totalCo2Kg: number;
  co2SavedKg: number;
  ecoRatePct: number;
  totalTours: number;
  ecoTours: number;
  totalDistanceKm: number;
}

export interface Co2LocationSummary {
  daysWithData: number;
  totalTours30d: number;
  ecoTours30d: number;
  totalKm30d: number;
  totalCo2Kg30d: number;
  co2SavedKg30d: number;
  ecoRatePct: number;
  treesEquivalent30d: number;
  avgCo2PerTour: number;
}

export interface CarbonDashboard {
  locationId: string;
  generatedAt: string;
  summary: Co2LocationSummary | null;
  trend: Co2TrendDay[];
  leaderboard: DriverCo2Row[];
  todaySnapshot: Co2SnapshotResult | null;
}

// ─── Snapshot-Engine ──────────────────────────────────────────────────────────

/**
 * Aggregiert abgeschlossene Touren von gestern, berechnet CO₂-Werte
 * und schreibt Snapshots für Location + Fahrer.
 */
export async function snapshotCarbonFootprint(
  locationId: string,
): Promise<Co2SnapshotResult> {
  const sb = createServiceClient();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Abgeschlossene Touren von gestern mit Fahrzeugtyp und Strecke
  const { data: tours, error } = await sb
    .from('tour_performance_snapshots')
    .select('driver_id, vehicle_type, total_route_km')
    .eq('location_id', locationId)
    .gte('completed_at', `${yesterday}T00:00:00Z`)
    .lt('completed_at', `${yesterday}T23:59:59Z`)
    .not('total_route_km', 'is', null);

  if (error && error.code !== '42P01') {
    throw new Error(`CO₂ snapshot query failed: ${error.message}`);
  }

  const rows = tours ?? [];

  // CO₂ per Tour berechnen
  let totalCo2Kg = 0;
  let co2SavedKg = 0;
  let totalDistanceKm = 0;
  let ecoTours = 0;

  // Aggregate per driver for driver_co2_snapshots
  const driverMap = new Map<string, {
    vehicleType: string; tours: number; distanceKm: number; co2Kg: number; co2SavedKg: number;
  }>();

  for (const t of rows) {
    const km = Number(t.total_route_km ?? 0);
    if (km <= 0) continue;

    const vt = (t.vehicle_type as string | null) ?? 'auto';
    const rate = co2Rate(vt);
    const co2 = rate * km;
    const saved = Math.max(0, CAR_BASELINE_KG_PER_KM * km - co2);

    totalCo2Kg += co2;
    co2SavedKg += saved;
    totalDistanceKm += km;
    if (isEcoVehicle(vt)) ecoTours++;

    const dId = (t.driver_id as string | null) ?? 'unknown';
    if (dId !== 'unknown') {
      const prev = driverMap.get(dId) ?? { vehicleType: vt, tours: 0, distanceKm: 0, co2Kg: 0, co2SavedKg: 0 };
      driverMap.set(dId, {
        vehicleType: vt,
        tours: prev.tours + 1,
        distanceKm: prev.distanceKm + km,
        co2Kg: prev.co2Kg + co2,
        co2SavedKg: prev.co2SavedKg + saved,
      });
    }
  }

  const totalTours = rows.filter((t) => Number(t.total_route_km ?? 0) > 0).length;
  const avgCo2PerTour = totalTours > 0 ? totalCo2Kg / totalTours : 0;
  const ecoRatePct = totalTours > 0 ? (ecoTours / totalTours) * 100 : 0;
  const treesEquivalent = co2SavedKg / KG_CO2_PER_TREE_PER_YEAR;

  // Location-Snapshot upsert
  await sb.from('delivery_co2_snapshots').upsert({
    location_id:      locationId,
    snapshot_date:    yesterday,
    total_co2_kg:     Math.round(totalCo2Kg * 1000) / 1000,
    co2_saved_kg:     Math.round(co2SavedKg * 1000) / 1000,
    total_tours:      totalTours,
    eco_tours:        ecoTours,
    total_distance_km: Math.round(totalDistanceKm * 100) / 100,
    avg_co2_per_tour: Math.round(avgCo2PerTour * 1000) / 1000,
    eco_rate_pct:     Math.round(ecoRatePct * 10) / 10,
    trees_equivalent: Math.round(treesEquivalent * 100) / 100,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'location_id,snapshot_date' });

  // Driver-Snapshots upsert
  if (driverMap.size > 0) {
    const driverRows = Array.from(driverMap.entries()).map(([driverId, d]) => ({
      location_id:   locationId,
      driver_id:     driverId,
      snapshot_date: yesterday,
      vehicle_type:  d.vehicleType,
      tours:         d.tours,
      distance_km:   Math.round(d.distanceKm * 100) / 100,
      co2_kg:        Math.round(d.co2Kg * 1000) / 1000,
      co2_saved_kg:  Math.round(d.co2SavedKg * 1000) / 1000,
    }));
    await sb.from('driver_co2_snapshots').upsert(driverRows, { onConflict: 'driver_id,snapshot_date' });
  }

  await logDeliveryEvent({
    location_id: locationId,
    event_type: 'carbon_snapshot',
    payload: { date: yesterday, total_tours: totalTours, co2_saved_kg: Math.round(co2SavedKg * 1000) / 1000 },
  });

  return {
    locationId,
    date: yesterday,
    totalCo2Kg: Math.round(totalCo2Kg * 1000) / 1000,
    co2SavedKg: Math.round(co2SavedKg * 1000) / 1000,
    totalTours,
    ecoTours,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    avgCo2PerTour: Math.round(avgCo2PerTour * 1000) / 1000,
    ecoRatePct: Math.round(ecoRatePct * 10) / 10,
    treesEquivalent: Math.round(treesEquivalent * 100) / 100,
  };
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export interface CarbonBatchResult {
  locations: number;
  snapshots: number;
  errors: number;
}

export async function snapshotCarbonAllLocations(): Promise<CarbonBatchResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let snapshots = 0;
  let errors = 0;

  await Promise.all(
    (locs ?? []).map(async (loc) => {
      try {
        await snapshotCarbonFootprint(loc.id);
        snapshots++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, snapshots, errors };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getDriverLeaderboard(locationId: string): Promise<DriverCo2Row[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_co2_driver_leaderboard')
    .select('*')
    .eq('location_id', locationId)
    .limit(20);

  if (error && error.code !== '42P01') throw new Error(error.message);

  return (data ?? []).map((r) => ({
    driverId:       String(r.driver_id),
    locationId:     String(r.location_id),
    driverName:     String(r.driver_name ?? 'Fahrer'),
    vehicleType:    String(r.vehicle_type ?? 'auto'),
    tours30d:       Number(r.tours_30d ?? 0),
    distanceKm30d:  Number(r.distance_km_30d ?? 0),
    co2Kg30d:       Number(r.co2_kg_30d ?? 0),
    co2SavedKg30d:  Number(r.co2_saved_kg_30d ?? 0),
    avgCo2PerTour:  Number(r.avg_co2_per_tour ?? 0),
    treesEquivalent: Number(r.trees_equivalent ?? 0),
  }));
}

export async function getCo2Trend(locationId: string): Promise<Co2TrendDay[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_co2_trend_30d')
    .select('*')
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: true });

  if (error && error.code !== '42P01') throw new Error(error.message);

  return (data ?? []).map((r) => ({
    snapshotDate:    String(r.snapshot_date),
    totalCo2Kg:      Number(r.total_co2_kg ?? 0),
    co2SavedKg:      Number(r.co2_saved_kg ?? 0),
    ecoRatePct:      Number(r.eco_rate_pct ?? 0),
    totalTours:      Number(r.total_tours ?? 0),
    ecoTours:        Number(r.eco_tours ?? 0),
    totalDistanceKm: Number(r.total_distance_km ?? 0),
  }));
}

export async function getCarbonDashboard(locationId: string): Promise<CarbonDashboard> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [summaryRes, trendRows, leaderboardRows, todayRes] = await Promise.all([
    sb.from('v_co2_location_summary').select('*').eq('location_id', locationId).maybeSingle(),
    getCo2Trend(locationId),
    getDriverLeaderboard(locationId),
    sb.from('delivery_co2_snapshots').select('*').eq('location_id', locationId)
      .eq('snapshot_date', today).maybeSingle(),
  ]);

  const s = summaryRes.data;
  const summary: Co2LocationSummary | null = s ? {
    daysWithData:      Number(s.days_with_data ?? 0),
    totalTours30d:     Number(s.total_tours_30d ?? 0),
    ecoTours30d:       Number(s.eco_tours_30d ?? 0),
    totalKm30d:        Number(s.total_km_30d ?? 0),
    totalCo2Kg30d:     Number(s.total_co2_kg_30d ?? 0),
    co2SavedKg30d:     Number(s.co2_saved_kg_30d ?? 0),
    ecoRatePct:        Number(s.eco_rate_pct ?? 0),
    treesEquivalent30d: Number(s.trees_equivalent_30d ?? 0),
    avgCo2PerTour:     Number(s.avg_co2_per_tour ?? 0),
  } : null;

  let todaySnapshot: Co2SnapshotResult | null = null;
  const td = todayRes.data;
  if (td) {
    todaySnapshot = {
      locationId:      locationId,
      date:            today,
      totalCo2Kg:      Number(td.total_co2_kg ?? 0),
      co2SavedKg:      Number(td.co2_saved_kg ?? 0),
      totalTours:      Number(td.total_tours ?? 0),
      ecoTours:        Number(td.eco_tours ?? 0),
      totalDistanceKm: Number(td.total_distance_km ?? 0),
      avgCo2PerTour:   Number(td.avg_co2_per_tour ?? 0),
      ecoRatePct:      Number(td.eco_rate_pct ?? 0),
      treesEquivalent: Number(td.trees_equivalent ?? 0),
    };
  }

  return {
    locationId,
    generatedAt:  new Date().toISOString(),
    summary,
    trend:        trendRows,
    leaderboard:  leaderboardRows,
    todaySnapshot,
  };
}

// ─── Prune ────────────────────────────────────────────────────────────────────

export async function pruneCo2Snapshots(daysToKeep = 90): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_co2_snapshots', { days_to_keep: daysToKeep });
  if (error && error.code !== '42883') throw new Error(error.message);
  return Number(data ?? 0);
}
