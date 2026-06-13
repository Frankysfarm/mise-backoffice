/**
 * lib/delivery/zone-affinity.ts
 *
 * Smart Driver Zone Affinity Engine — Phase 110.
 *
 * Tracks how familiar and how well each driver performs per zone (A/B/C/D).
 * Affinity score 0–100:
 *   60% familiarity  = min(total_deliveries × 3, 60)  → full score at 20 deliveries
 *   40% performance  = (on_time_count / total_deliveries) × 40
 *
 * Used by dispatch-engine.ts (via scoring.ts f_zone factor) to prefer drivers
 * with proven zone knowledge.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { ZoneName } from './zones';

export interface DriverZoneStat {
  driverId: string;
  locationId: string;
  zone: ZoneName;
  totalDeliveries: number;
  onTimeCount: number;
  avgDeliveryMin: number | null;
  lastDeliveryAt: string | null;
  affinityScore: number;
}

export interface ZoneAffinityMatrixRow {
  driverId: string;
  driverName: string;
  locationId: string;
  zoneAScore: number | null;
  zoneBScore: number | null;
  zoneCScore: number | null;
  zoneDScore: number | null;
  zoneADeliveries: number;
  zoneBDeliveries: number;
  zoneCDeliveries: number;
  zoneDDeliveries: number;
  totalZoneDeliveries: number;
  lastZoneDeliveryAt: string | null;
}

export interface ZoneCoverageStats {
  zone: ZoneName;
  driversActive: number;
  totalDeliveries: number;
  avgAffinityScore: number | null;
  onTimePct: number | null;
  avgDeliveryMin: number | null;
}

export interface ZoneAffinityDashboard {
  matrix: ZoneAffinityMatrixRow[];
  coverage: ZoneCoverageStats[];
  topDriverPerZone: Record<ZoneName, { driverId: string; driverName: string; score: number } | null>;
  lastUpdated: string | null;
}

// ── Score computation ─────────────────────────────────────────────────────────

function computeAffinityScore(totalDeliveries: number, onTimeCount: number): number {
  const familiarity = Math.min(60, totalDeliveries * 3);
  const performance = totalDeliveries > 0 ? (onTimeCount / totalDeliveries) * 40 : 0;
  return Math.round(familiarity + performance);
}

// ── Update zone stats after a delivery ───────────────────────────────────────

/**
 * Called fire-and-forget when a tour stop is marked 'delivered'.
 * Updates (or inserts) the driver's zone stats for the given zone.
 */
export async function recordZoneDelivery(opts: {
  driverId: string;
  locationId: string;
  zone: ZoneName;
  wasOnTime: boolean;
  deliveryMinutes: number | null;
  deliveredAt?: Date;
}): Promise<void> {
  const sb = createServiceClient();
  const { driverId, locationId, zone, wasOnTime, deliveryMinutes, deliveredAt } = opts;
  const now = (deliveredAt ?? new Date()).toISOString();

  try {
    // Check if row exists
    const { data: existing } = await sb
      .from('driver_zone_stats')
      .select('id, total_deliveries, on_time_count, avg_delivery_min')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .eq('zone_name', zone)
      .maybeSingle();

    if (existing) {
      const newTotal = (existing.total_deliveries as number) + 1;
      const newOnTime = (existing.on_time_count as number) + (wasOnTime ? 1 : 0);
      const prevAvg = existing.avg_delivery_min as number | null;
      const newAvg = deliveryMinutes != null
        ? prevAvg != null
          ? Math.round(((prevAvg * (newTotal - 1) + deliveryMinutes) / newTotal) * 10) / 10
          : deliveryMinutes
        : prevAvg;

      await sb
        .from('driver_zone_stats')
        .update({
          total_deliveries: newTotal,
          on_time_count:    newOnTime,
          avg_delivery_min: newAvg,
          last_delivery_at: now,
          updated_at:       now,
        })
        .eq('id', existing.id as string);
    } else {
      await sb
        .from('driver_zone_stats')
        .insert({
          driver_id:        driverId,
          location_id:      locationId,
          zone_name:        zone,
          total_deliveries: 1,
          on_time_count:    wasOnTime ? 1 : 0,
          avg_delivery_min: deliveryMinutes,
          last_delivery_at: now,
          updated_at:       now,
        });
    }
  } catch {
    // fire-and-forget: never block the delivery flow
  }
}

// ── Load zone affinities for dispatch ────────────────────────────────────────

/**
 * Loads zone affinity scores for a list of drivers.
 * Returns a map: driverId → { A: score, B: score, C: score, D: score }
 */
export async function getDriverZoneAffinities(
  driverIds: string[],
  locationId: string,
): Promise<Record<string, Record<string, number>>> {
  if (driverIds.length === 0) return {};

  const sb = createServiceClient();

  try {
    const { data } = await sb
      .from('driver_zone_stats')
      .select('driver_id, zone_name, total_deliveries, on_time_count')
      .eq('location_id', locationId)
      .in('driver_id', driverIds);

    if (!data || data.length === 0) return {};

    const result: Record<string, Record<string, number>> = {};
    for (const row of data) {
      const dId = row.driver_id as string;
      const zone = row.zone_name as string;
      const score = computeAffinityScore(
        row.total_deliveries as number,
        row.on_time_count as number,
      );
      if (!result[dId]) result[dId] = {};
      result[dId][zone] = score;
    }
    return result;
  } catch {
    return {};
  }
}

// ── Admin dashboard ───────────────────────────────────────────────────────────

export async function getZoneAffinityMatrix(locationId: string): Promise<ZoneAffinityMatrixRow[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_zone_affinity_matrix')
    .select('*')
    .eq('location_id', locationId)
    .order('total_zone_deliveries', { ascending: false });

  return (data ?? []).map((r) => ({
    driverId:            r.driver_id as string,
    driverName:          r.driver_name as string,
    locationId:          r.location_id as string,
    zoneAScore:          r.zone_a_score != null ? Number(r.zone_a_score) : null,
    zoneBScore:          r.zone_b_score != null ? Number(r.zone_b_score) : null,
    zoneCScore:          r.zone_c_score != null ? Number(r.zone_c_score) : null,
    zoneDScore:          r.zone_d_score != null ? Number(r.zone_d_score) : null,
    zoneADeliveries:     Number(r.zone_a_deliveries ?? 0),
    zoneBDeliveries:     Number(r.zone_b_deliveries ?? 0),
    zoneCDeliveries:     Number(r.zone_c_deliveries ?? 0),
    zoneDDeliveries:     Number(r.zone_d_deliveries ?? 0),
    totalZoneDeliveries: Number(r.total_zone_deliveries ?? 0),
    lastZoneDeliveryAt:  r.last_zone_delivery_at as string | null,
  }));
}

export async function getZoneCoverageStats(locationId: string): Promise<ZoneCoverageStats[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_zone_coverage_stats')
    .select('*')
    .eq('location_id', locationId)
    .order('zone_name', { ascending: true });

  return (data ?? []).map((r) => ({
    zone:             r.zone_name as ZoneName,
    driversActive:    Number(r.drivers_active ?? 0),
    totalDeliveries:  Number(r.total_deliveries ?? 0),
    avgAffinityScore: r.avg_affinity_score != null ? Number(r.avg_affinity_score) : null,
    onTimePct:        r.on_time_pct != null ? Number(r.on_time_pct) : null,
    avgDeliveryMin:   r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
  }));
}

export async function getZoneAffinityDashboard(locationId: string): Promise<ZoneAffinityDashboard> {
  const [matrix, coverage] = await Promise.all([
    getZoneAffinityMatrix(locationId),
    getZoneCoverageStats(locationId),
  ]);

  // Top driver per zone
  const topDriverPerZone: Record<ZoneName, { driverId: string; driverName: string; score: number } | null> = {
    A: null, B: null, C: null, D: null,
  };
  const zoneScoreField: Record<ZoneName, keyof ZoneAffinityMatrixRow> = {
    A: 'zoneAScore', B: 'zoneBScore', C: 'zoneCScore', D: 'zoneDScore',
  };
  for (const zone of ['A', 'B', 'C', 'D'] as ZoneName[]) {
    const field = zoneScoreField[zone];
    let best: ZoneAffinityMatrixRow | null = null;
    let bestScore = -1;
    for (const row of matrix) {
      const score = row[field] as number | null;
      if (score != null && score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
    if (best) {
      topDriverPerZone[zone] = {
        driverId:   best.driverId,
        driverName: best.driverName,
        score:      bestScore,
      };
    }
  }

  const lastUpdated = matrix.reduce((latest: string | null, r) => {
    if (!r.lastZoneDeliveryAt) return latest;
    if (!latest || r.lastZoneDeliveryAt > latest) return r.lastZoneDeliveryAt;
    return latest;
  }, null);

  return { matrix, coverage, topDriverPerZone, lastUpdated };
}

// ── Cron: refresh all locations ───────────────────────────────────────────────

/**
 * Re-computes zone affinity stats from raw delivery data for all locations.
 * Useful as a nightly reconciliation to catch any missed incremental updates.
 */
export async function refreshZoneAffinityAllLocations(): Promise<{
  locations: number;
  driversUpdated: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(20);

  let driversUpdated = 0;
  let errors = 0;

  for (const loc of locs ?? []) {
    try {
      const locId = loc.id as string;

      // Aggregate historical deliveries: driver × zone → count + on_time
      const { data: rows } = await sb
        .from('mise_delivery_batch_stops')
        .select(`
          mise_delivery_batches!inner(driver_id, location_id),
          customer_orders!inner(delivery_zone, eta_latest),
          completed_at
        `)
        .eq('mise_delivery_batches.location_id', locId)
        .eq('type', 'dropoff')
        .not('completed_at', 'is', null)
        .not('customer_orders.delivery_zone', 'is', null)
        .limit(5000);

      if (!rows || rows.length === 0) continue;

      type AggKey = string; // driverId|zone
      const agg: Record<AggKey, {
        driverId: string; zone: ZoneName; total: number; onTime: number; sumMin: number; count: number; last: string;
      }> = {};

      for (const row of rows) {
        const batch = (row['mise_delivery_batches'] as unknown) as { driver_id: string | null; location_id: string };
        const order = (row['customer_orders'] as unknown) as { delivery_zone: string | null; eta_latest: string | null };
        if (!batch.driver_id || !order.delivery_zone) continue;

        const zone = order.delivery_zone as ZoneName;
        const key: AggKey = `${batch.driver_id}|${zone}`;
        if (!agg[key]) {
          agg[key] = { driverId: batch.driver_id, zone, total: 0, onTime: 0, sumMin: 0, count: 0, last: '' };
        }
        agg[key].total++;

        const completedAt = new Date(row['completed_at'] as string);
        if (order.eta_latest) {
          const etaLatest = new Date(order.eta_latest);
          if (completedAt <= etaLatest) agg[key].onTime++;
        }

        if (agg[key].last < (row['completed_at'] as string)) {
          agg[key].last = row['completed_at'] as string;
        }
      }

      for (const entry of Object.values(agg)) {
        const avgMin = entry.count > 0 ? entry.sumMin / entry.count : null;

        await sb
          .from('driver_zone_stats')
          .upsert({
            driver_id:        entry.driverId,
            location_id:      locId,
            zone_name:        entry.zone,
            total_deliveries: entry.total,
            on_time_count:    entry.onTime,
            avg_delivery_min: avgMin,
            last_delivery_at: entry.last || null,
            updated_at:       new Date().toISOString(),
          }, {
            onConflict: 'location_id,driver_id,zone_name',
          });
        driversUpdated++;
      }
    } catch {
      errors++;
    }
  }

  return {
    locations:      (locs ?? []).length,
    driversUpdated,
    errors,
  };
}
