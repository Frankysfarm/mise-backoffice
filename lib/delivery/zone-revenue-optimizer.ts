/**
 * lib/delivery/zone-revenue-optimizer.ts — Phase 331
 *
 * Smart Zone Revenue Optimizer
 *
 * Analysiert täglich die Umsatzperformance pro Lieferzone (A/B/C/D) und leitet
 * konkrete Handlungsempfehlungen ab:
 *   - Zuschlag erhöhen/senken (cost_ratio < 0.4 → zu billig)
 *   - MOV anpassen (avg_order_value < zone.min_order_eur)
 *   - Zone entfernen (margin_score < 20, Verlustzone)
 *   - Zone erweitern (hohe Dichte, gute Marge)
 *
 * margin_score (0–100):
 *   on_time_pct × 0.30 + (1 - cancellation_pct/100) × 0.30 × 100
 *   + cost_ratio_capped × 0.40 × 100
 *   (cost_ratio: fee_revenue / delivery_cost_estimate; ideal ≥ 0.6)
 *
 * Cron: snapshotAllLocations() täglich 02:45 UTC
 *       generateRecommendationsAllLocations() täglich 03:10 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getZoneConfig } from './zones';

// Cost-per-km estimate used for cost_ratio (adjustable per location later)
const COST_PER_KM_EUR = 0.35;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZoneRevRec =
  | 'increase_surcharge'
  | 'decrease_surcharge'
  | 'increase_mov'
  | 'decrease_mov'
  | 'remove_zone'
  | 'expand_zone'
  | 'add_free_threshold'
  | 'investigate';

export interface ZoneRevenueSnapshot {
  id: string;
  locationId: string;
  zoneName: string;
  snapshotDate: string;
  orderCount: number;
  revenueEur: number;
  feeRevenueEur: number;
  avgOrderValue: number | null;
  avgDistanceKm: number | null;
  onTimePct: number | null;
  cancellationPct: number | null;
  marginScore: number | null;
  costRatio: number | null;
}

export interface ZoneRevenueRecommendation {
  id: string;
  locationId: string;
  zoneName: string;
  recType: ZoneRevRec;
  reason: string;
  suggestedSurcharge: number | null;
  suggestedMov: number | null;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'accepted' | 'dismissed' | 'applied';
  generatedAt: string;
  resolvedAt: string | null;
}

export interface ZoneDashboardEntry {
  zoneName: string;
  label: string;
  surchargeEur: number;
  minOrderEur: number;
  minKm: number;
  maxKm: number;
  latest: ZoneRevenueSnapshot | null;
  trend30d: Array<{ date: string; revenueEur: number; orderCount: number; marginScore: number | null }>;
  recommendations: ZoneRevenueRecommendation[];
}

export interface ZoneRevenueDashboard {
  locationId: string;
  refreshedAt: string;
  // KPIs
  totalRevenueToday: number;
  totalOrdersToday: number;
  bestZone: string | null;
  worstZone: string | null;
  pendingRecs: number;
  zones: ZoneDashboardEntry[];
}

export interface SnapshotResult {
  locations: number;
  snapshots: number;
  errors: number;
}

// ─── 1. Daily Snapshot ────────────────────────────────────────────────────────

export async function snapshotZoneRevenue(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00Z`;

  // Get orders for today with distance info
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, gesamtbetrag, liefergebuehr, entfernung_km, status, bestellt_am, fertig_am, eta_earliest, zone')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .gte('bestellt_am', dayStart)
    .not('zone', 'is', null);

  if (!orders || orders.length === 0) return 0;

  // Group by zone
  type ZoneAgg = {
    orders: number;
    revenue: number;
    feeRevenue: number;
    distances: number[];
    orderValues: number[];
    onTimeCount: number;
    cancelledCount: number;
  };

  const byZone = new Map<string, ZoneAgg>();

  for (const o of orders) {
    const z = (o.zone as string | null) ?? 'unknown';
    if (!byZone.has(z)) {
      byZone.set(z, { orders: 0, revenue: 0, feeRevenue: 0, distances: [], orderValues: [], onTimeCount: 0, cancelledCount: 0 });
    }
    const agg = byZone.get(z)!;
    agg.orders++;
    agg.revenue += Number(o.gesamtbetrag ?? 0);
    agg.feeRevenue += Number(o.liefergebuehr ?? 0);
    if (o.entfernung_km != null) agg.distances.push(Number(o.entfernung_km));
    agg.orderValues.push(Number(o.gesamtbetrag ?? 0));

    if (o.status === 'storniert' || o.status === 'abgebrochen') {
      agg.cancelledCount++;
    } else if (o.fertig_am && o.eta_earliest) {
      if (new Date(o.fertig_am) <= new Date(o.eta_earliest)) agg.onTimeCount++;
    }
  }

  let saved = 0;
  for (const [zoneName, agg] of byZone.entries()) {
    const avgDist = agg.distances.length > 0
      ? agg.distances.reduce((a, b) => a + b, 0) / agg.distances.length
      : null;
    const avgOV = agg.orders > 0
      ? agg.revenue / agg.orders
      : null;
    const nonCancelledCount = agg.orders - agg.cancelledCount;
    const onTimePct = nonCancelledCount > 0 ? (agg.onTimeCount / nonCancelledCount) * 100 : null;
    const cancellationPct = agg.orders > 0 ? (agg.cancelledCount / agg.orders) * 100 : 0;

    // cost_ratio: fee collected vs. estimated delivery cost
    const estimatedCost = avgDist != null ? avgDist * agg.orders * COST_PER_KM_EUR : null;
    const costRatio = estimatedCost != null && estimatedCost > 0
      ? Math.min(agg.feeRevenue / estimatedCost, 2)
      : null;

    // margin_score: 0–100
    const onTimeFactor = onTimePct != null ? (onTimePct / 100) * 30 : 15;
    const cancelFactor = (1 - cancellationPct / 100) * 30;
    const costFactor = costRatio != null ? Math.min(costRatio / 1.0, 1) * 40 : 20;
    const marginScore = onTimeFactor + cancelFactor + costFactor;

    const { error } = await sb.from('zone_revenue_snapshots').upsert({
      location_id: locationId,
      zone_name: zoneName,
      snapshot_date: today,
      order_count: agg.orders,
      revenue_eur: Math.round(agg.revenue * 100) / 100,
      fee_revenue_eur: Math.round(agg.feeRevenue * 100) / 100,
      avg_order_value: avgOV != null ? Math.round(avgOV * 100) / 100 : null,
      avg_distance_km: avgDist != null ? Math.round(avgDist * 100) / 100 : null,
      on_time_count: agg.onTimeCount,
      cancelled_count: agg.cancelledCount,
      on_time_pct: onTimePct != null ? Math.round(onTimePct * 10) / 10 : null,
      cancellation_pct: Math.round(cancellationPct * 10) / 10,
      margin_score: Math.round(marginScore * 10) / 10,
      cost_ratio: costRatio != null ? Math.round(costRatio * 10000) / 10000 : null,
    }, { onConflict: 'location_id,zone_name,snapshot_date' });

    if (!error) saved++;
  }

  return saved;
}

export async function snapshotAllLocations(): Promise<SnapshotResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  if (!locs) return { locations: 0, snapshots: 0, errors: 0 };

  let snapshots = 0;
  let errors = 0;
  for (const loc of locs) {
    try {
      snapshots += await snapshotZoneRevenue(loc.id as string);
    } catch {
      errors++;
    }
  }
  return { locations: locs.length, snapshots, errors };
}

// ─── 2. Recommendations ───────────────────────────────────────────────────────

export async function generateRecommendations(locationId: string): Promise<number> {
  const sb = createServiceClient();

  // Get latest snapshots per zone
  const { data: snaps } = await sb
    .from('v_zone_revenue_latest')
    .select('*')
    .eq('location_id', locationId);

  if (!snaps || snaps.length === 0) return 0;

  const zoneConfigs = await getZoneConfig(locationId);

  const recs: Array<{
    location_id: string;
    zone_name: string;
    rec_type: ZoneRevRec;
    reason: string;
    suggested_surcharge: number | null;
    suggested_mov: number | null;
    urgency: string;
    status: string;
    generated_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const snap of snaps) {
    const zoneName = snap.zone_name as string;
    const cfg = zoneConfigs.find((z) => z.name === zoneName);
    const marginScore = snap.margin_score != null ? Number(snap.margin_score) : null;
    const costRatio = snap.cost_ratio != null ? Number(snap.cost_ratio) : null;
    const cancellationPct = snap.cancellation_pct != null ? Number(snap.cancellation_pct) : null;
    const onTimePct = snap.on_time_pct != null ? Number(snap.on_time_pct) : null;
    const avgOV = snap.avg_order_value != null ? Number(snap.avg_order_value) : null;
    const orderCount = Number(snap.order_count ?? 0);

    if (orderCount < 3) continue; // not enough data

    // Recommendation 1: Remove zone if margin is critically low
    if (marginScore != null && marginScore < 20 && orderCount >= 5) {
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'remove_zone',
        reason: `Zone ${zoneName}: Margin-Score ${marginScore.toFixed(0)}/100 kritisch niedrig. Lieferungen in dieser Zone sind unprofitabel.`,
        suggested_surcharge: null,
        suggested_mov: null,
        urgency: 'critical',
        status: 'pending',
        generated_at: now,
      });
      continue;
    }

    // Recommendation 2: cost_ratio too low → increase surcharge
    if (costRatio != null && costRatio < 0.4 && cfg) {
      const suggestedSurcharge = Math.round((cfg.surcharge_eur * 1.3 + 0.5) * 20) / 20;
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'increase_surcharge',
        reason: `Zone ${zoneName}: Gebühren decken nur ${(costRatio * 100).toFixed(0)}% der Kosten. Aktueller Zuschlag: €${cfg.surcharge_eur.toFixed(2)}.`,
        suggested_surcharge: suggestedSurcharge,
        suggested_mov: null,
        urgency: costRatio < 0.2 ? 'high' : 'normal',
        status: 'pending',
        generated_at: now,
      });
    }

    // Recommendation 3: cost_ratio very high → could lower surcharge to drive volume
    if (costRatio != null && costRatio > 1.5 && cfg && cfg.surcharge_eur > 0.5) {
      const suggestedSurcharge = Math.round((cfg.surcharge_eur * 0.85) * 20) / 20;
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'decrease_surcharge',
        reason: `Zone ${zoneName}: Sehr gute Kostendeckung (${(costRatio * 100).toFixed(0)}%). Zuschlag-Senkung könnte Bestellvolumen steigern.`,
        suggested_surcharge: suggestedSurcharge,
        suggested_mov: null,
        urgency: 'low',
        status: 'pending',
        generated_at: now,
      });
    }

    // Recommendation 4: avg order value below MOV → increase MOV or investigate
    if (avgOV != null && cfg && avgOV < cfg.min_order_eur * 0.85 && orderCount >= 5) {
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'investigate',
        reason: `Zone ${zoneName}: Ø Bestellwert €${avgOV.toFixed(2)} liegt deutlich unter MOV €${cfg.min_order_eur.toFixed(2)}. Prüfen: Gutscheine oder Fehler in MOV-Durchsetzung?`,
        suggested_surcharge: null,
        suggested_mov: null,
        urgency: 'normal',
        status: 'pending',
        generated_at: now,
      });
    }

    // Recommendation 5: high cancellation rate
    if (cancellationPct != null && cancellationPct > 15 && orderCount >= 5) {
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'investigate',
        reason: `Zone ${zoneName}: Stornoquote ${cancellationPct.toFixed(1)}% überdurchschnittlich hoch. Mögliche Ursachen: zu lange ETA, zu hoher Zuschlag.`,
        suggested_surcharge: null,
        suggested_mov: null,
        urgency: cancellationPct > 25 ? 'high' : 'normal',
        status: 'pending',
        generated_at: now,
      });
    }

    // Recommendation 6: on-time rate low → investigate route/capacity
    if (onTimePct != null && onTimePct < 60 && orderCount >= 5) {
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'investigate',
        reason: `Zone ${zoneName}: Pünktlichkeitsrate ${onTimePct.toFixed(0)}% unter Ziel (≥80%). Mehr Fahrer oder angepasste ETA-Puffer empfohlen.`,
        suggested_surcharge: null,
        suggested_mov: null,
        urgency: onTimePct < 40 ? 'high' : 'normal',
        status: 'pending',
        generated_at: now,
      });
    }

    // Recommendation 7: expand zone (great margin, high volume)
    if (marginScore != null && marginScore > 75 && orderCount >= 20) {
      recs.push({
        location_id: locationId,
        zone_name: zoneName,
        rec_type: 'expand_zone',
        reason: `Zone ${zoneName}: Exzellente Performance (Margin-Score ${marginScore.toFixed(0)}/100, ${orderCount} Bestellungen). Erweiterung des Lieferradius könnte Umsatz steigern.`,
        suggested_surcharge: null,
        suggested_mov: null,
        urgency: 'low',
        status: 'pending',
        generated_at: now,
      });
    }
  }

  if (recs.length === 0) return 0;

  // Deduplicate: remove existing pending recs for same zone+type from last 7 days
  const zones = [...new Set(recs.map((r) => r.zone_name))];
  await sb
    .from('zone_revenue_recommendations')
    .delete()
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .in('zone_name', zones)
    .gte('generated_at', new Date(Date.now() - 7 * 86400000).toISOString());

  const { error } = await sb.from('zone_revenue_recommendations').insert(recs);
  return error ? 0 : recs.length;
}

export async function generateRecommendationsAllLocations(): Promise<{ locations: number; recs: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  if (!locs) return { locations: 0, recs: 0, errors: 0 };

  let recs = 0;
  let errors = 0;
  for (const loc of locs) {
    try {
      recs += await generateRecommendations(loc.id as string);
    } catch {
      errors++;
    }
  }
  return { locations: locs.length, recs, errors };
}

// ─── 3. Dashboard ─────────────────────────────────────────────────────────────

export async function getZoneRevenueDashboard(locationId: string): Promise<ZoneRevenueDashboard> {
  const sb = createServiceClient();

  const [zoneConfigs, { data: latest }, { data: recs30d }, { data: trend30d }] = await Promise.all([
    getZoneConfig(locationId),
    sb.from('v_zone_revenue_latest').select('*').eq('location_id', locationId),
    sb.from('zone_revenue_recommendations')
      .select('*')
      .eq('location_id', locationId)
      .order('generated_at', { ascending: false })
      .limit(100),
    sb.from('zone_revenue_snapshots')
      .select('zone_name, snapshot_date, revenue_eur, order_count, margin_score')
      .eq('location_id', locationId)
      .gte('snapshot_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: true }),
  ]);

  const latestMap = new Map<string, typeof latest extends (infer T)[] | null ? T : never>();
  for (const s of latest ?? []) latestMap.set(s.zone_name as string, s);

  const recsMap = new Map<string, ZoneRevenueRecommendation[]>();
  for (const r of recs30d ?? []) {
    const k = r.zone_name as string;
    if (!recsMap.has(k)) recsMap.set(k, []);
    recsMap.get(k)!.push({
      id: r.id as string,
      locationId: r.location_id as string,
      zoneName: r.zone_name as string,
      recType: r.rec_type as ZoneRevRec,
      reason: r.reason as string,
      suggestedSurcharge: r.suggested_surcharge != null ? Number(r.suggested_surcharge) : null,
      suggestedMov: r.suggested_mov != null ? Number(r.suggested_mov) : null,
      urgency: r.urgency as ZoneRevenueRecommendation['urgency'],
      status: r.status as ZoneRevenueRecommendation['status'],
      generatedAt: r.generated_at as string,
      resolvedAt: r.resolved_at as string | null,
    });
  }

  // Trend data by zone
  const trendMap = new Map<string, Array<{ date: string; revenueEur: number; orderCount: number; marginScore: number | null }>>();
  for (const t of trend30d ?? []) {
    const k = t.zone_name as string;
    if (!trendMap.has(k)) trendMap.set(k, []);
    trendMap.get(k)!.push({
      date: t.snapshot_date as string,
      revenueEur: Number(t.revenue_eur ?? 0),
      orderCount: Number(t.order_count ?? 0),
      marginScore: t.margin_score != null ? Number(t.margin_score) : null,
    });
  }

  // Build zone entries
  const zoneOrder = ['A', 'B', 'C', 'D'];
  const zones: ZoneDashboardEntry[] = [];

  const allZoneNames = new Set([
    ...zoneOrder,
    ...(latest ?? []).map((s) => s.zone_name as string),
  ]);

  for (const zoneName of [...allZoneNames].sort((a, b) => {
    const ai = zoneOrder.indexOf(a);
    const bi = zoneOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  })) {
    const cfg = zoneConfigs.find((z) => z.name === zoneName);
    const snap = latestMap.get(zoneName);

    const latestSnap: ZoneRevenueSnapshot | null = snap ? {
      id: snap.id as string,
      locationId: snap.location_id as string,
      zoneName: snap.zone_name as string,
      snapshotDate: snap.snapshot_date as string,
      orderCount: Number(snap.order_count ?? 0),
      revenueEur: Number(snap.revenue_eur ?? 0),
      feeRevenueEur: Number(snap.fee_revenue_eur ?? 0),
      avgOrderValue: snap.avg_order_value != null ? Number(snap.avg_order_value) : null,
      avgDistanceKm: snap.avg_distance_km != null ? Number(snap.avg_distance_km) : null,
      onTimePct: snap.on_time_pct != null ? Number(snap.on_time_pct) : null,
      cancellationPct: snap.cancellation_pct != null ? Number(snap.cancellation_pct) : null,
      marginScore: snap.margin_score != null ? Number(snap.margin_score) : null,
      costRatio: snap.cost_ratio != null ? Number(snap.cost_ratio) : null,
    } : null;

    zones.push({
      zoneName,
      label: cfg?.label ?? zoneName,
      surchargeEur: cfg?.surcharge_eur ?? 0,
      minOrderEur: cfg?.min_order_eur ?? 0,
      minKm: cfg?.min_km ?? 0,
      maxKm: cfg?.max_km ?? 999,
      latest: latestSnap,
      trend30d: trendMap.get(zoneName) ?? [],
      recommendations: recsMap.get(zoneName) ?? [],
    });
  }

  // KPIs
  const totalRevenueToday = zones.reduce((s, z) => s + (z.latest?.revenueEur ?? 0), 0);
  const totalOrdersToday = zones.reduce((s, z) => s + (z.latest?.orderCount ?? 0), 0);

  const zonesWithData = zones.filter((z) => z.latest != null && z.latest.marginScore != null);
  const bestZone = zonesWithData.length > 0
    ? zonesWithData.reduce((best, z) => (z.latest!.marginScore! > best.latest!.marginScore! ? z : best)).zoneName
    : null;
  const worstZone = zonesWithData.length > 0
    ? zonesWithData.reduce((worst, z) => (z.latest!.marginScore! < worst.latest!.marginScore! ? z : worst)).zoneName
    : null;

  const pendingRecs = (recs30d ?? []).filter((r) => r.status === 'pending').length;

  return {
    locationId,
    refreshedAt: new Date().toISOString(),
    totalRevenueToday,
    totalOrdersToday,
    bestZone,
    worstZone,
    pendingRecs,
    zones,
  };
}

// ─── 4. Resolve Recommendation ────────────────────────────────────────────────

export async function resolveRecommendation(
  id: string,
  locationId: string,
  action: 'accepted' | 'dismissed' | 'applied',
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('zone_revenue_recommendations')
    .update({ status: action, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('location_id', locationId);
}

// ─── 5. Prune ─────────────────────────────────────────────────────────────────

export async function pruneZoneRevenueSnapshots(daysOld = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_zone_revenue_snapshots', { days_old: daysOld });
  return { pruned: Number(data ?? 0) };
}
