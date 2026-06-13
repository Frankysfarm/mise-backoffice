/**
 * lib/delivery/geo-demand.ts
 *
 * Phase 116: Geo-Demand Intelligence & Zone Expansion Advisor
 *
 * Analysiert tägliche Bestellungen nach Postleitzahl, identifiziert
 * Gebiete außerhalb der aktuellen Lieferzonen und berechnet ROI-Schätzungen
 * für potenzielle Zonen-Erweiterungen.
 *
 * Public API:
 *   snapshotGeoDemand(locationId)          — gestern per PLZ aggregieren + upsert
 *   snapshotGeoDemandAllLocations()        — Cron-Batch alle aktiven Locations
 *   getGeoDemandMap(locationId)            — v_geo_demand_summary lesen
 *   getExpansionCandidates(locationId)     — v_zone_expansion_candidates lesen
 *   getGeoDemandDashboard(locationId)      — kombinierter Response für Admin-UI
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getZoneConfig } from './zones';
import { haversineKm } from '@/lib/google-maps';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface GeoDemandRow {
  plz: string;
  zone_name: string | null;
  is_outside_zone: boolean;
  total_orders: number;
  total_revenue_eur: number;
  avg_distance_km: number | null;
  total_on_time: number;
  on_time_pct: number;
  days_with_data: number;
  last_seen_date: string;
}

export interface ExpansionCandidate {
  plz: string;
  total_orders: number;
  total_revenue_eur: number;
  avg_distance_km: number | null;
  active_days: number;
  estimated_weekly_revenue: number;
  projected_annual_revenue: number;
  expansion_score: number;
}

export interface GeoDemandSummary {
  covered_plzs: number;
  outside_plzs: number;
  total_orders_30d: number;
  total_revenue_30d: number;
  coverage_rate_pct: number;
  potential_annual_gain: number;
}

export interface GeoDemandDashboard {
  location_id: string;
  generated_at: string;
  summary: GeoDemandSummary;
  demand_map: GeoDemandRow[];
  expansion_candidates: ExpansionCandidate[];
  top_inside_plz: GeoDemandRow | null;
  top_candidate: ExpansionCandidate | null;
}

// ─── Snapshot-Engine ──────────────────────────────────────────────────────────

/** Aggregiert Bestellungen von gestern nach PLZ und schreibt in delivery_geo_demand_snapshots. */
export async function snapshotGeoDemand(
  locationId: string,
): Promise<{ plzs_snapshotted: number }> {
  const sb = createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Restaurantstandort für Distanzberechnung
  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();
  const restaurantLat = loc?.lat as number | null;
  const restaurantLng = loc?.lng as number | null;

  // Zonen-Konfiguration für Klassifizierung
  const zones = await getZoneConfig(locationId);
  const maxZoneKm = Math.max(...zones.map((z) => z.max_km));

  // Alle Lieferbestellungen von gestern
  const { data: orders } = await sb
    .from('customer_orders')
    .select('kunde_plz, gesamtbetrag, kunde_lat, kunde_lng, eta_latest, geliefert_am, delivery_zone')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('kunde_plz', 'is', null)
    .not('status', 'in', '("storniert","abgelehnt")')
    .gte('created_at', yesterday + 'T00:00:00Z')
    .lt('created_at', today + 'T00:00:00Z');

  if (!orders || orders.length === 0) return { plzs_snapshotted: 0 };

  // Aggregation nach PLZ
  const byPlz = new Map<string, {
    order_count: number;
    revenue: number;
    distances: number[];
    on_time_count: number;
    zone_name: string | null;
  }>();

  for (const order of orders) {
    const plz = ((order.kunde_plz as string | null) ?? '').trim();
    if (!plz) continue;

    const entry = byPlz.get(plz) ?? {
      order_count: 0,
      revenue: 0,
      distances: [],
      on_time_count: 0,
      zone_name: null,
    };

    entry.order_count++;
    entry.revenue += Number(order.gesamtbetrag ?? 0);

    if (
      restaurantLat != null &&
      restaurantLng != null &&
      order.kunde_lat != null &&
      order.kunde_lng != null
    ) {
      const dist = haversineKm(
        { lat: restaurantLat, lng: restaurantLng },
        { lat: order.kunde_lat as number, lng: order.kunde_lng as number },
      );
      entry.distances.push(dist);

      const zone = zones.find((z) => dist >= z.min_km && dist < z.max_km);
      entry.zone_name = zone?.name ?? null;
    } else if (order.delivery_zone) {
      entry.zone_name = order.delivery_zone as string;
    }

    if (order.geliefert_am && order.eta_latest) {
      if (
        new Date(order.geliefert_am as string) <=
        new Date(order.eta_latest as string)
      ) {
        entry.on_time_count++;
      }
    }

    byPlz.set(plz, entry);
  }

  const rows = Array.from(byPlz.entries()).map(([plz, entry]) => {
    const avgDist =
      entry.distances.length > 0
        ? entry.distances.reduce((a, b) => a + b, 0) / entry.distances.length
        : null;
    const isOutside = avgDist != null ? avgDist > maxZoneKm : entry.zone_name == null;

    return {
      location_id: locationId,
      snapshot_date: yesterday,
      plz,
      order_count: entry.order_count,
      revenue_eur: Math.round(entry.revenue * 100) / 100,
      avg_distance_km: avgDist != null ? Math.round(avgDist * 100) / 100 : null,
      on_time_count: entry.on_time_count,
      zone_name: entry.zone_name,
      is_outside_zone: isOutside,
    };
  });

  if (rows.length > 0) {
    await sb
      .from('delivery_geo_demand_snapshots')
      .upsert(rows, { onConflict: 'location_id,snapshot_date,plz' });
  }

  return { plzs_snapshotted: rows.length };
}

/** Cron-Batch: alle aktiven Locations. */
export async function snapshotGeoDemandAllLocations(): Promise<{
  locations: number;
  plzs: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let totalPlzs = 0;
  let errors = 0;

  await Promise.allSettled(
    (locs ?? []).map(async (l) => {
      try {
        const r = await snapshotGeoDemand(l.id as string);
        totalPlzs += r.plzs_snapshotted;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, plzs: totalPlzs, errors };
}

// ─── Lesefunktionen ───────────────────────────────────────────────────────────

/** PLZ-Nachfrage-Karte der letzten 30 Tage (alle PLZs, sortiert nach Volumen). */
export async function getGeoDemandMap(locationId: string): Promise<GeoDemandRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_geo_demand_summary')
    .select(
      'plz, zone_name, is_outside_zone, total_orders, total_revenue_eur, avg_distance_km, total_on_time, on_time_pct, days_with_data, last_seen_date',
    )
    .eq('location_id', locationId)
    .order('total_orders', { ascending: false });

  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      plz: row.plz as string,
      zone_name: (row.zone_name as string | null) ?? null,
      is_outside_zone: row.is_outside_zone as boolean,
      total_orders: Number(row.total_orders),
      total_revenue_eur: Number(row.total_revenue_eur),
      avg_distance_km: row.avg_distance_km != null ? Number(row.avg_distance_km) : null,
      total_on_time: Number(row.total_on_time ?? 0),
      on_time_pct: Number(row.on_time_pct ?? 0),
      days_with_data: Number(row.days_with_data),
      last_seen_date: row.last_seen_date as string,
    };
  });
}

/** Expansionskandidaten: PLZs außerhalb der Zone mit Demand-Score (Top 20). */
export async function getExpansionCandidates(locationId: string): Promise<ExpansionCandidate[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_zone_expansion_candidates')
    .select(
      'plz, total_orders, total_revenue_eur, avg_distance_km, active_days, estimated_weekly_revenue, projected_annual_revenue, expansion_score',
    )
    .eq('location_id', locationId)
    .order('expansion_score', { ascending: false })
    .limit(20);

  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      plz: row.plz as string,
      total_orders: Number(row.total_orders),
      total_revenue_eur: Number(row.total_revenue_eur),
      avg_distance_km: row.avg_distance_km != null ? Number(row.avg_distance_km) : null,
      active_days: Number(row.active_days),
      estimated_weekly_revenue: Number(row.estimated_weekly_revenue ?? 0),
      projected_annual_revenue: Number(row.projected_annual_revenue ?? 0),
      expansion_score: Number(row.expansion_score ?? 0),
    };
  });
}

/** Kombiniertes Dashboard für die Admin-UI. */
export async function getGeoDemandDashboard(locationId: string): Promise<GeoDemandDashboard> {
  const [demandMap, candidates] = await Promise.all([
    getGeoDemandMap(locationId),
    getExpansionCandidates(locationId),
  ]);

  const covered = demandMap.filter((r) => !r.is_outside_zone);
  const outside = demandMap.filter((r) => r.is_outside_zone);

  const totalOrders = demandMap.reduce((s, r) => s + r.total_orders, 0);
  const coveredOrders = covered.reduce((s, r) => s + r.total_orders, 0);
  const totalRevenue = demandMap.reduce((s, r) => s + r.total_revenue_eur, 0);
  const potentialAnnualGain = candidates.reduce(
    (s, c) => s + c.projected_annual_revenue,
    0,
  );

  return {
    location_id: locationId,
    generated_at: new Date().toISOString(),
    summary: {
      covered_plzs: covered.length,
      outside_plzs: outside.length,
      total_orders_30d: totalOrders,
      total_revenue_30d: Math.round(totalRevenue * 100) / 100,
      coverage_rate_pct:
        totalOrders > 0 ? Math.round((coveredOrders / totalOrders) * 100) : 100,
      potential_annual_gain: Math.round(potentialAnnualGain * 100) / 100,
    },
    demand_map: demandMap,
    expansion_candidates: candidates,
    top_inside_plz: covered[0] ?? null,
    top_candidate: candidates[0] ?? null,
  };
}
