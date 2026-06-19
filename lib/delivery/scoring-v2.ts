/**
 * lib/delivery/scoring-v2.ts
 *
 * Phase 263: Smart Dispatch ML-Scoring V2
 *
 * 12-Faktoren (vs. 10 in V1), per-location Gewichts-Konfiguration,
 * Wetter-Penalty, Fahrer-Geschwindigkeits-Tier, historische Zone×Fahrzeug-Erfolgsrate.
 *
 * Neue Faktoren gegenüber V1:
 *  11. Wetter       — schlechtes Wetter bevorzugt Auto + erfahrene Fahrer
 *  12. Geschwindig. — Fahrer mit hoher Deliveries/h heute bekommt Bonus
 *
 * Zone×Fahrzeug-Statistik beeinflusst Faktor 3 (Fahrzeugtyp) und 10 (Historie)
 * sobald genug Daten vorliegen (≥20 Lieferungen).
 *
 * Public API:
 *   getScoringV2Config()             — Config laden (DB oder Defaults)
 *   upsertScoringV2Config()          — Config speichern
 *   scoreDriverV2()                  — Einzelfahrer-Score
 *   rankDriversV2()                  — sortierte Fahrerliste
 *   getZoneVehicleStats()            — Zone×Fahrzeug Tabelle
 *   rebuildZoneVehicleStats()        — Stats neu berechnen
 *   rebuildZoneVehicleStatsAllLocations() — Cron-Batch
 *   getScoringV2Dashboard()          — Admin-Dashboard
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';
import type { ZoneName } from './zones';
import type { DriverScoreInput, OrderScoreInput, ScoreBreakdown } from './scoring';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScoringV2Config {
  locationId: string;
  // Factor weights
  wDistance:   number;
  wLoad:       number;
  wVehicle:    number;
  wExperience: number;
  wZone:       number;
  wPrepTime:   number;
  wTimeOfDay:  number;
  wPriority:   number;
  wBundleFit:  number;
  wHistory:    number;
  wWeather:    number;
  wVelocity:   number;
  // Feature flags
  useWeather:           boolean;
  useVelocity:          boolean;
  useZoneVehicleStats:  boolean;
  isActive:             boolean;
}

export interface DriverScoreInputV2 extends DriverScoreInput {
  weather_difficulty?: number | null;    // 0–10 from weather-intelligence
  deliveries_today?: number | null;      // completed deliveries this shift
  shift_active_minutes?: number | null;  // minutes driver has been online today
  zone_vehicle_success_rate?: number | null; // 0–1 from driver_zone_vehicle_stats
}

export interface ScoreBreakdownV2 extends ScoreBreakdown {
  f_weather:  number;
  f_velocity: number;
}

export interface ZoneVehicleStat {
  zone: ZoneName;
  vehicle: 'bike' | 'car';
  totalDeliveries: number;
  onTimeCount: number;
  avgDeliveryMin: number;
  successRate: number;
  lastRebuiltAt: string | null;
}

export interface ScoringV2Dashboard {
  config: ScoringV2Config;
  zoneVehicleStats: ZoneVehicleStat[];
  weightSum: number;
  lastRebuiltAt: string | null;
  v2ActiveLocations: number;
}

// ── Default Config ───────────────────────────────────────────────────────────

function defaultConfig(locationId: string): ScoringV2Config {
  return {
    locationId,
    wDistance:   12,
    wLoad:        8,
    wVehicle:     8,
    wExperience:  6,
    wZone:       10,
    wPrepTime:   10,
    wTimeOfDay:   6,
    wPriority:    6,
    wBundleFit:   8,
    wHistory:    10,
    wWeather:     8,
    wVelocity:    8,
    useWeather:          true,
    useVelocity:         true,
    useZoneVehicleStats: true,
    isActive:            false,
  };
}

// ── Config CRUD ──────────────────────────────────────────────────────────────

export async function getScoringV2Config(locationId: string): Promise<ScoringV2Config> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('scoring_v2_configs')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return defaultConfig(locationId);

  interface ConfigRow {
    location_id: string;
    w_distance: number; w_load: number; w_vehicle: number; w_experience: number;
    w_zone: number; w_prep_time: number; w_time_of_day: number; w_priority: number;
    w_bundle_fit: number; w_history: number; w_weather: number; w_velocity: number;
    use_weather: boolean; use_velocity: boolean; use_zone_vehicle_stats: boolean;
    is_active: boolean;
  }
  const r = data as unknown as ConfigRow;
  return {
    locationId:          r.location_id,
    wDistance:           r.w_distance,
    wLoad:               r.w_load,
    wVehicle:            r.w_vehicle,
    wExperience:         r.w_experience,
    wZone:               r.w_zone,
    wPrepTime:           r.w_prep_time,
    wTimeOfDay:          r.w_time_of_day,
    wPriority:           r.w_priority,
    wBundleFit:          r.w_bundle_fit,
    wHistory:            r.w_history,
    wWeather:            r.w_weather,
    wVelocity:           r.w_velocity,
    useWeather:          r.use_weather,
    useVelocity:         r.use_velocity,
    useZoneVehicleStats: r.use_zone_vehicle_stats,
    isActive:            r.is_active,
  };
}

export async function upsertScoringV2Config(
  locationId: string,
  patch: Partial<Omit<ScoringV2Config, 'locationId'>>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb.from('scoring_v2_configs').upsert({
    location_id:          locationId,
    w_distance:           patch.wDistance,
    w_load:               patch.wLoad,
    w_vehicle:            patch.wVehicle,
    w_experience:         patch.wExperience,
    w_zone:               patch.wZone,
    w_prep_time:          patch.wPrepTime,
    w_time_of_day:        patch.wTimeOfDay,
    w_priority:           patch.wPriority,
    w_bundle_fit:         patch.wBundleFit,
    w_history:            patch.wHistory,
    w_weather:            patch.wWeather,
    w_velocity:           patch.wVelocity,
    use_weather:          patch.useWeather,
    use_velocity:         patch.useVelocity,
    use_zone_vehicle_stats: patch.useZoneVehicleStats,
    is_active:            patch.isActive,
  }, { onConflict: 'location_id', ignoreDuplicates: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Zone × Vehicle Stats ──────────────────────────────────────────────────────

export async function getZoneVehicleStats(locationId: string): Promise<ZoneVehicleStat[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_zone_vehicle_stats')
    .select('zone, vehicle, total_deliveries, on_time_count, avg_delivery_min, success_rate, last_rebuilt_at')
    .eq('location_id', locationId)
    .order('zone')
    .order('vehicle');

  interface StatRow {
    zone: string; vehicle: string; total_deliveries: number;
    on_time_count: number; avg_delivery_min: number;
    success_rate: number; last_rebuilt_at: string | null;
  }
  return ((data ?? []) as unknown as StatRow[]).map((r) => ({
    zone:            r.zone as ZoneName,
    vehicle:         r.vehicle as 'bike' | 'car',
    totalDeliveries: r.total_deliveries,
    onTimeCount:     r.on_time_count,
    avgDeliveryMin:  r.avg_delivery_min,
    successRate:     r.success_rate,
    lastRebuiltAt:   r.last_rebuilt_at,
  }));
}

export async function rebuildZoneVehicleStats(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('rebuild_zone_vehicle_stats', { p_location_id: locationId });
  if (error) {
    console.warn('[scoring-v2] rebuild_zone_vehicle_stats error:', error.message);
    return 0;
  }
  return (data as number) ?? 0;
}

export async function rebuildZoneVehicleStatsAllLocations(): Promise<{
  locations: number;
  totalRows: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs?.length) return { locations: 0, totalRows: 0 };

  let totalRows = 0;
  await Promise.allSettled(
    locs.map(async (l) => {
      const rows = await rebuildZoneVehicleStats(l.id as string);
      totalRows += rows;
    }),
  );
  return { locations: locs.length, totalRows };
}

// ── Load driver context (weather + velocity) for V2 scoring ─────────────────

export async function enrichDriversV2(
  driverIds: string[],
  locationId: string,
  config: ScoringV2Config,
): Promise<Map<string, { weatherDifficulty: number; deliveriesToday: number; shiftActiveMinutes: number; zoneVehicleSuccessRate: Record<string, number> }>> {
  const sb = createServiceClient();
  const result = new Map<string, { weatherDifficulty: number; deliveriesToday: number; shiftActiveMinutes: number; zoneVehicleSuccessRate: Record<string, number> }>();

  // Default context
  const defaultCtx = { weatherDifficulty: 0, deliveriesToday: 0, shiftActiveMinutes: 60, zoneVehicleSuccessRate: {} };
  for (const id of driverIds) result.set(id, { ...defaultCtx });

  // Load weather (once for location)
  let weatherDifficulty = 0;
  if (config.useWeather) {
    const { data: ws } = await sb
      .from('weather_snapshots')
      .select('difficulty_score')
      .eq('location_id', locationId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ws) weatherDifficulty = (ws as { difficulty_score: number }).difficulty_score ?? 0;
  }

  // Load today's completed deliveries per driver (velocity)
  if (config.useVelocity && driverIds.length > 0) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: deliveries } = await sb
      .from('customer_orders')
      .select('mise_driver_id')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen', 'completed'])
      .in('mise_driver_id', driverIds)
      .gte('fertig_am', todayStart.toISOString());

    const countByDriver: Record<string, number> = {};
    for (const d of deliveries ?? []) {
      const did = d.mise_driver_id as string;
      countByDriver[did] = (countByDriver[did] ?? 0) + 1;
    }

    // Load shift active minutes
    const { data: shifts } = await sb
      .from('mise_drivers')
      .select('id, shift_started_at')
      .in('id', driverIds)
      .not('shift_started_at', 'is', null);

    const now = Date.now();
    for (const s of shifts ?? []) {
      const did = s.id as string;
      const started = new Date(s.shift_started_at as string).getTime();
      const activeMin = Math.max(10, (now - started) / 60_000);
      const existing = result.get(did) ?? { ...defaultCtx };
      result.set(did, {
        ...existing,
        weatherDifficulty,
        deliveriesToday: countByDriver[did] ?? 0,
        shiftActiveMinutes: activeMin,
      });
    }

    // Apply delivery counts to those not yet in shifts map
    for (const [did, count] of Object.entries(countByDriver)) {
      const existing = result.get(did) ?? { ...defaultCtx };
      result.set(did, { ...existing, weatherDifficulty, deliveriesToday: count });
    }
  }

  // Apply weather to all
  for (const [did, ctx] of result.entries()) {
    result.set(did, { ...ctx, weatherDifficulty });
  }

  // Load zone×vehicle success rates
  if (config.useZoneVehicleStats) {
    const stats = await getZoneVehicleStats(locationId);
    const rateMap: Record<string, number> = {};
    for (const s of stats) {
      if (s.totalDeliveries >= 20) {
        rateMap[`${s.zone}_${s.vehicle}`] = s.successRate;
      }
    }
    if (Object.keys(rateMap).length > 0) {
      for (const [did, ctx] of result.entries()) {
        result.set(did, { ...ctx, zoneVehicleSuccessRate: rateMap });
      }
    }
  }

  return result;
}

// ── 12-Factor Scoring Functions ──────────────────────────────────────────────

function computeDistanceFactor(driver: DriverScoreInputV2, order: OrderScoreInput): number {
  if (driver.last_lat == null || driver.last_lng == null) return 5;
  const dist = haversineKm(
    { lat: driver.last_lat, lng: driver.last_lng },
    { lat: order.restaurant_lat, lng: order.restaurant_lng },
  );
  return Math.max(0, 10 - dist);
}

function computeLoadFactor(driver: DriverScoreInputV2): number {
  const free = driver.max_capacity - driver.current_capacity;
  return Math.round((free / driver.max_capacity) * 10 * 100) / 100;
}

function computeVehicleFactor(driver: DriverScoreInputV2, order: OrderScoreInput, zoneVehicleRates: Record<string, number>, useStats: boolean, orderZone: ZoneName | null): number {
  const itemCount = order.item_count ?? 1;
  const baseScore = driver.vehicle === 'car' ? 10 : itemCount > 4 ? 3 : itemCount > 2 ? 6 : 9;

  // Blend with historical success rate if available
  if (useStats && orderZone) {
    const key = `${orderZone}_${driver.vehicle}`;
    const rate = zoneVehicleRates[key];
    if (rate != null) {
      const histScore = rate * 10;
      return Math.round((baseScore * 0.5 + histScore * 0.5) * 100) / 100;
    }
  }
  return baseScore;
}

function computeExperienceFactor(driver: DriverScoreInputV2): number {
  const d = driver.total_deliveries;
  if (d >= 500) return 10;
  if (d >= 200) return 8;
  if (d >= 100) return 7;
  if (d >= 50)  return 6;
  if (d >= 20)  return 5;
  if (d >= 5)   return 3;
  return 1;
}

function computeZoneFactor(driver: DriverScoreInputV2, order: OrderScoreInput): number {
  const orderZone = order.zone;
  const affinity = orderZone ? (driver.zone_affinity?.[orderZone] ?? null) : null;
  if (affinity != null) {
    const staticScore = (() => {
      if (!driver.zone || !orderZone) return 5;
      if (driver.zone === orderZone) return 10;
      const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
      const diff = Math.abs(zones.indexOf(driver.zone) - zones.indexOf(orderZone));
      return Math.max(0, 10 - diff * 3);
    })();
    return Math.round((affinity / 100) * 7 * 10 + staticScore * 3) / 10;
  }
  if (!driver.zone || !orderZone) return 5;
  if (driver.zone === orderZone) return 10;
  const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
  const diff = Math.abs(zones.indexOf(driver.zone) - zones.indexOf(orderZone));
  return Math.max(0, 10 - diff * 3);
}

function computePrepTimeFactor(driver: DriverScoreInputV2, order: OrderScoreInput, now: Date): number {
  if (driver.last_lat == null || driver.last_lng == null) return 5;
  const dist = haversineKm(
    { lat: driver.last_lat, lng: driver.last_lng },
    { lat: order.restaurant_lat, lng: order.restaurant_lng },
  );
  const speedKmh = driver.vehicle === 'car' ? 30 : 18;
  const driveMins = (dist / speedKmh) * 60;
  const prepMins = order.estimated_prep_min ?? 15;
  const ageMins = (now.getTime() - new Date(order.created_at).getTime()) / 60_000;
  const remaining = Math.max(0, prepMins - ageMins);
  const slack = remaining - driveMins;
  if (slack >= 0 && slack <= 5)  return 10;
  if (slack > 5 && slack <= 10)  return 8;
  if (slack > 10)                return 5;
  if (slack >= -3)               return 7;
  return 2;
}

function computeTimeOfDayFactor(now: Date): number {
  const hour = now.getUTCHours() + 1;
  if ((hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20)) return 6;
  if (hour >= 11 && hour <= 21) return 8;
  return 4;
}

function computePriorityFactor(order: OrderScoreInput): number {
  switch (order.priority) {
    case 'express': return 10;
    case 'vip':     return 9;
    case 'rush':    return 8;
    default:        return 5;
  }
}

function computeBundleFitFactor(driver: DriverScoreInputV2): number {
  if (!driver.active_batch_id) return 7;
  const free = driver.max_capacity - driver.current_capacity;
  if (free >= 2) return 9;
  if (free === 1) return 7;
  return 0;
}

function computeHistoryFactor(driver: DriverScoreInputV2): number {
  const rating = driver.rating ?? 4.5;
  const avgMin = driver.avg_delivery_min ?? 25;
  const ratingScore = ((rating - 1) / 4) * 7;
  const speedScore = avgMin <= 20 ? 3 : avgMin <= 30 ? 2 : avgMin <= 40 ? 1 : 0;
  return Math.min(10, ratingScore + speedScore);
}

/**
 * Factor 11: Weather penalty.
 * High difficulty (snow/storm) → prefers car drivers (Bike gets penalty).
 * difficultyScore 0–10: 0 = perfect, 10 = dangerous.
 */
function computeWeatherFactor(driver: DriverScoreInputV2, difficulty: number): number {
  if (difficulty <= 2) return 10; // good weather → no penalty
  const penalty = difficulty * (driver.vehicle === 'bike' ? 0.9 : 0.4);
  return Math.max(0, 10 - penalty);
}

/**
 * Factor 12: Driver velocity (deliveries per active hour today).
 * Fast drivers get a bonus; idle drivers get neutral.
 */
function computeVelocityFactor(driver: DriverScoreInputV2): number {
  const delivs = driver.deliveries_today ?? 0;
  const activeH = Math.max(0.5, (driver.shift_active_minutes ?? 60) / 60);
  const perHour = delivs / activeH;
  if (perHour >= 4)  return 10;
  if (perHour >= 3)  return 8;
  if (perHour >= 2)  return 6;
  if (perHour >= 1)  return 4;
  if (delivs === 0)  return 5; // just started shift — neutral
  return 3;
}

// ── Main V2 Scoring ──────────────────────────────────────────────────────────

export function scoreDriverV2(
  driver: DriverScoreInputV2,
  order: OrderScoreInput,
  config: ScoringV2Config,
  zoneVehicleRates: Record<string, number>,
  nowUtc: Date = new Date(),
): ScoreBreakdownV2 | null {
  if (driver.current_capacity >= driver.max_capacity) return null;

  const orderZone = order.zone ?? null;
  const weatherDiff = config.useWeather ? (driver.weather_difficulty ?? 0) : 0;

  const raw = {
    f_distance:    computeDistanceFactor(driver, order),
    f_load:        computeLoadFactor(driver),
    f_vehicle:     computeVehicleFactor(driver, order, zoneVehicleRates, config.useZoneVehicleStats, orderZone),
    f_experience:  computeExperienceFactor(driver),
    f_zone:        computeZoneFactor(driver, order),
    f_prep_time:   computePrepTimeFactor(driver, order, nowUtc),
    f_time_of_day: computeTimeOfDayFactor(nowUtc),
    f_priority:    computePriorityFactor(order),
    f_bundle_fit:  computeBundleFitFactor(driver),
    f_history:     computeHistoryFactor(driver),
    f_weather:     config.useWeather ? computeWeatherFactor(driver, weatherDiff) : 10,
    f_velocity:    config.useVelocity ? computeVelocityFactor(driver) : 5,
  };

  // Weighted sum normalised to 0–100
  const totalWeight =
    config.wDistance + config.wLoad + config.wVehicle + config.wExperience +
    config.wZone + config.wPrepTime + config.wTimeOfDay + config.wPriority +
    config.wBundleFit + config.wHistory + config.wWeather + config.wVelocity;

  const weightedSum =
    raw.f_distance    * config.wDistance +
    raw.f_load        * config.wLoad +
    raw.f_vehicle     * config.wVehicle +
    raw.f_experience  * config.wExperience +
    raw.f_zone        * config.wZone +
    raw.f_prep_time   * config.wPrepTime +
    raw.f_time_of_day * config.wTimeOfDay +
    raw.f_priority    * config.wPriority +
    raw.f_bundle_fit  * config.wBundleFit +
    raw.f_history     * config.wHistory +
    raw.f_weather     * config.wWeather +
    raw.f_velocity    * config.wVelocity;

  const total = Math.round((weightedSum / totalWeight) * 100 * 100) / 100;

  return { ...raw, total };
}

export function rankDriversV2(
  drivers: DriverScoreInputV2[],
  order: OrderScoreInput,
  config: ScoringV2Config,
  zoneVehicleRates: Record<string, number>,
  nowUtc: Date = new Date(),
): Array<{ driver: DriverScoreInputV2; score: ScoreBreakdownV2 }> {
  return drivers
    .map((d) => ({ driver: d, score: scoreDriverV2(d, order, config, zoneVehicleRates, nowUtc) }))
    .filter((e): e is { driver: DriverScoreInputV2; score: ScoreBreakdownV2 } => e.score !== null)
    .sort((a, b) => b.score.total - a.score.total);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getScoringV2Dashboard(locationId: string): Promise<ScoringV2Dashboard> {
  const [config, zoneVehicleStats, activeCount] = await Promise.all([
    getScoringV2Config(locationId),
    getZoneVehicleStats(locationId),
    (async () => {
      const sb = createServiceClient();
      const { count } = await sb
        .from('scoring_v2_configs')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      return count ?? 0;
    })(),
  ]);

  const weightSum =
    config.wDistance + config.wLoad + config.wVehicle + config.wExperience +
    config.wZone + config.wPrepTime + config.wTimeOfDay + config.wPriority +
    config.wBundleFit + config.wHistory + config.wWeather + config.wVelocity;

  const lastRebuiltAt = zoneVehicleStats.reduce<string | null>((best, s) => {
    if (!s.lastRebuiltAt) return best;
    if (!best || s.lastRebuiltAt > best) return s.lastRebuiltAt;
    return best;
  }, null);

  return {
    config,
    zoneVehicleStats,
    weightSum,
    lastRebuiltAt,
    v2ActiveLocations: activeCount,
  };
}
