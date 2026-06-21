/**
 * lib/delivery/transparency-engine.ts
 *
 * Delivery Transparency Engine — Phase 389
 *
 * Berechnet täglich einen öffentlichen Vertrauens-Score (0–100) + Badge-Level
 * (Bronze/Silver/Gold/Platinum) aus bestehenden Qualitätsdaten.
 *
 * Score-Gewichtung:
 *   Pünktlichkeit   35 %  — on_time_rate aus delivery_performance
 *   Kundenzufrieden 25 %  — Ø-Bewertung aus mise_driver_ratings / customer_orders
 *   Liefergeschw.   20 %  — avg_delivery_min vs. Ziel 30 Min
 *   SLA-Compliance  12 %  — sla-breach-Rate aus sla_breach_events
 *   Storno-Rate      8 %  — cancel_rate aus customer_orders
 *
 * Badge-Stufen:
 *   Platinum ≥ 90 · Gold ≥ 75 · Silver ≥ 60 · Bronze < 60
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface TransparencyComponents {
  scoreOntime:      number; // 0–100
  scoreQuality:     number; // 0–100 (Kundenzufriedenheit)
  scoreAccuracy:    number; // 0–100 (Liefergeschwindigkeit)
  scoreSpeed:       number; // 0–100 (SLA-Compliance)
  scoreCare:        number; // 0–100 (niedrige Storno-Rate)
}

export type BadgeLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TransparencySnapshot {
  locationId:        string;
  snapshotDate:      string;
  trustScore:        number;
  badgeLevel:        BadgeLevel;
  components:        TransparencyComponents;
  avgDeliveryMin:    number | null;
  onTimeRatePct:     number | null;
  satisfactionRate:  number | null;
  totalDeliveries:   number;
  ordersLast30d:     number;
  trustDelta:        number | null;
  previousBadge:     BadgeLevel | null;
}

export interface PublicTransparencyProfile {
  trustScore:        number;
  badgeLevel:        BadgeLevel;
  badgeLabel:        string;
  avgDeliveryMin:    number | null;
  onTimeRatePct:     number | null;
  satisfactionRate:  number | null;
  ordersLast30d:     number;
  snapshotDate:      string | null;
}

export interface TransparencyDashboard {
  today:        TransparencySnapshot | null;
  yesterday:    TransparencySnapshot | null;
  trend:        TransparencySnapshot[];
  weeklyAvg:    number | null;
  badgeHistory: { date: string; level: BadgeLevel }[];
}

// ─── Konstanten ───────────────────────────────────────────────────────────────

const WEIGHTS = {
  ontime:   0.35,
  quality:  0.25,
  accuracy: 0.20,
  speed:    0.12,
  care:     0.08,
} as const;

const BADGE_THRESHOLDS: { level: BadgeLevel; min: number }[] = [
  { level: 'platinum', min: 90 },
  { level: 'gold',     min: 75 },
  { level: 'silver',   min: 60 },
  { level: 'bronze',   min:  0 },
];

const BADGE_LABELS: Record<BadgeLevel, string> = {
  platinum: 'Platin-Qualität',
  gold:     'Gold-Qualität',
  silver:   'Silber-Qualität',
  bronze:   'Bronze-Qualität',
};

const TARGET_DELIVERY_MIN = 30; // Ziel-Lieferzeit in Minuten

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

export function getBadgeLevel(score: number): BadgeLevel {
  return (
    BADGE_THRESHOLDS.find((t) => score >= t.min)?.level ?? 'bronze'
  );
}

export function getBadgeLabel(level: BadgeLevel): string {
  return BADGE_LABELS[level];
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Score-Berechnung ─────────────────────────────────────────────────────────

async function fetchComponents(
  locationId: string,
  sb: ReturnType<typeof createServiceClient>,
): Promise<{ components: TransparencyComponents; stats: {
  avgDeliveryMin: number | null;
  onTimeRatePct:  number | null;
  satisfactionRate: number | null;
  totalDeliveries:  number;
  ordersLast30d:    number;
}}> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const today    = new Date().toISOString().slice(0, 10);
  const since7d  = new Date(Date.now() - 7 * 86400_000).toISOString();

  // ── 1. Pünktlichkeit (on_time_rate) aus delivery_performance ───────────────
  const { data: perfRows } = await sb
    .from('delivery_performance')
    .select('avg_delivery_min, on_time_rate')
    .eq('location_id', locationId)
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(50);

  const avgOnTimeRate = perfRows?.length
    ? perfRows.reduce((s, r) => s + (r.on_time_rate ?? 0), 0) / perfRows.length
    : null;
  const avgDeliveryMin = perfRows?.length
    ? perfRows.reduce((s, r) => s + (r.avg_delivery_min ?? 0), 0) / perfRows.length
    : null;

  const scoreOntime = avgOnTimeRate !== null
    ? clamp(avgOnTimeRate)
    : 50; // Neutral bei fehlendem Wert

  // ── 2. Kundenzufriedenheit aus customer_orders.kundenbewertung ──────────────
  const { data: ratingRows } = await sb
    .from('customer_orders')
    .select('kundenbewertung')
    .eq('location_id', locationId)
    .not('kundenbewertung', 'is', null)
    .gte('bestellt_am', since30d)
    .limit(500);

  const ratings = (ratingRows ?? [])
    .map((r) => r.kundenbewertung as number)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const avgRating = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
  // Rating 1–5 → Score 0–100
  const satisfactionRate = avgRating !== null ? clamp(((avgRating - 1) / 4) * 100) : 50;
  const scoreQuality = satisfactionRate;

  // ── 3. Liefergeschwindigkeit vs. Ziel ──────────────────────────────────────
  // Je näher avg_delivery_min an TARGET_DELIVERY_MIN, desto besser.
  // 10 Min unter Ziel → 100, 10 Min über Ziel → 0
  const scoreAccuracy = avgDeliveryMin !== null
    ? clamp(100 - ((avgDeliveryMin - TARGET_DELIVERY_MIN) / TARGET_DELIVERY_MIN) * 100)
    : 50;

  // ── 4. SLA-Compliance (niedrige Breach-Rate) ───────────────────────────────
  const { count: totalOrdersCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('bestellt_am', since30d);

  const ordersLast30d = totalOrdersCount ?? 0;

  const { count: breachCount } = await sb
    .from('sla_breach_events')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('resolved', false)
    .gte('detected_at', since30d)
    .limit(1000);

  const breachRate = ordersLast30d > 0
    ? ((breachCount ?? 0) / ordersLast30d) * 100
    : 0;
  // 0 % Breach → 100, 10 %+ Breach → 0
  const scoreSpeed = clamp(100 - breachRate * 10);

  // ── 5. Storno-Rate (niedrig = gut) ────────────────────────────────────────
  const { count: cancelCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['storniert', 'cancelled', 'abgebrochen'])
    .gte('bestellt_am', since30d);

  const cancelRate = ordersLast30d > 0
    ? ((cancelCount ?? 0) / ordersLast30d) * 100
    : 0;
  // 0 % Cancel → 100, 5 %+ Cancel → 0
  const scoreCare = clamp(100 - cancelRate * 20);

  // ── Gesamt-Deliveries (abgeschlossen) ─────────────────────────────────────
  const { count: deliveredCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'abgeholt', 'delivered', 'completed'])
    .gte('bestellt_am', since30d);

  const totalDeliveries = deliveredCount ?? 0;

  return {
    components: {
      scoreOntime,
      scoreQuality,
      scoreAccuracy,
      scoreSpeed,
      scoreCare,
    },
    stats: {
      avgDeliveryMin: avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
      onTimeRatePct:  avgOnTimeRate  !== null ? Math.round(avgOnTimeRate  * 10) / 10 : null,
      satisfactionRate: Math.round(satisfactionRate * 10) / 10,
      totalDeliveries,
      ordersLast30d,
    },
  };
}

function computeTrustScore(c: TransparencyComponents): number {
  const raw =
    c.scoreOntime   * WEIGHTS.ontime  +
    c.scoreQuality  * WEIGHTS.quality +
    c.scoreAccuracy * WEIGHTS.accuracy +
    c.scoreSpeed    * WEIGHTS.speed   +
    c.scoreCare     * WEIGHTS.care;
  return Math.round(raw * 10) / 10;
}

// ─── Haupt-Funktionen ─────────────────────────────────────────────────────────

export async function calculateTransparencyScore(locationId: string): Promise<{
  trustScore: number;
  badgeLevel: BadgeLevel;
  components: TransparencyComponents;
  stats: {
    avgDeliveryMin:   number | null;
    onTimeRatePct:    number | null;
    satisfactionRate: number | null;
    totalDeliveries:  number;
    ordersLast30d:    number;
  };
}> {
  const sb = createServiceClient();
  const { components, stats } = await fetchComponents(locationId, sb);
  const trustScore  = computeTrustScore(components);
  const badgeLevel  = getBadgeLevel(trustScore);
  return { trustScore, badgeLevel, components, stats };
}

export async function snapshotTransparency(
  locationId: string,
  date?: string,
): Promise<TransparencySnapshot> {
  const sb          = createServiceClient();
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const { components, stats } = await fetchComponents(locationId, sb);
  const trustScore  = computeTrustScore(components);
  const badgeLevel  = getBadgeLevel(trustScore);

  // Vortag laden für Delta
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const { data: prevRow } = await sb
    .from('delivery_transparency_snapshots')
    .select('trust_score, badge_level')
    .eq('location_id', locationId)
    .eq('snapshot_date', yesterday)
    .maybeSingle();

  const trustDelta    = prevRow ? Math.round((trustScore - Number(prevRow.trust_score)) * 10) / 10 : null;
  const previousBadge = (prevRow?.badge_level as BadgeLevel | null) ?? null;

  const row = {
    location_id:       locationId,
    snapshot_date:     snapshotDate,
    trust_score:       trustScore,
    badge_level:       badgeLevel,
    score_ontime:      Math.round(components.scoreOntime  * 10) / 10,
    score_quality:     Math.round(components.scoreQuality * 10) / 10,
    score_accuracy:    Math.round(components.scoreAccuracy * 10) / 10,
    score_speed:       Math.round(components.scoreSpeed   * 10) / 10,
    score_care:        Math.round(components.scoreCare    * 10) / 10,
    avg_delivery_min:  stats.avgDeliveryMin,
    on_time_rate_pct:  stats.onTimeRatePct,
    satisfaction_rate: stats.satisfactionRate,
    total_deliveries:  stats.totalDeliveries,
    orders_last_30d:   stats.ordersLast30d,
    trust_delta:       trustDelta,
    previous_badge:    previousBadge,
  };

  await sb
    .from('delivery_transparency_snapshots')
    .upsert(row, { onConflict: 'location_id,snapshot_date' });

  return {
    locationId,
    snapshotDate,
    trustScore,
    badgeLevel,
    components,
    avgDeliveryMin:   stats.avgDeliveryMin,
    onTimeRatePct:    stats.onTimeRatePct,
    satisfactionRate: stats.satisfactionRate,
    totalDeliveries:  stats.totalDeliveries,
    ordersLast30d:    stats.ordersLast30d,
    trustDelta,
    previousBadge,
  };
}

export async function snapshotTransparencyAllLocations(date?: string): Promise<{
  locations: number;
  saved:     number;
  errors:    number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => snapshotTransparency(l.id, date)),
  );

  return {
    locations: locs.length,
    saved:  results.filter((r) => r.status === 'fulfilled').length,
    errors: results.filter((r) => r.status === 'rejected').length,
  };
}

export async function getTransparencyDashboard(locationId: string): Promise<TransparencyDashboard> {
  const sb    = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const { data: rows } = await sb
    .from('delivery_transparency_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: false })
    .limit(31);

  const mapRow = (r: Record<string, unknown>): TransparencySnapshot => ({
    locationId:       locationId,
    snapshotDate:     r.snapshot_date as string,
    trustScore:       Number(r.trust_score),
    badgeLevel:       r.badge_level as BadgeLevel,
    components: {
      scoreOntime:   Number(r.score_ontime),
      scoreQuality:  Number(r.score_quality),
      scoreAccuracy: Number(r.score_accuracy),
      scoreSpeed:    Number(r.score_speed),
      scoreCare:     Number(r.score_care),
    },
    avgDeliveryMin:   r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    onTimeRatePct:    r.on_time_rate_pct != null ? Number(r.on_time_rate_pct) : null,
    satisfactionRate: r.satisfaction_rate != null ? Number(r.satisfaction_rate) : null,
    totalDeliveries:  Number(r.total_deliveries ?? 0),
    ordersLast30d:    Number(r.orders_last_30d ?? 0),
    trustDelta:       r.trust_delta != null ? Number(r.trust_delta) : null,
    previousBadge:    (r.previous_badge as BadgeLevel | null) ?? null,
  });

  const all   = (rows ?? []).map(mapRow);
  const todaySnap = all.find((r) => r.snapshotDate === today) ?? null;

  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const ySnap     = all.find((r) => r.snapshotDate === yesterday) ?? null;

  const weekRows  = all.slice(0, 7);
  const weeklyAvg = weekRows.length
    ? Math.round((weekRows.reduce((s, r) => s + r.trustScore, 0) / weekRows.length) * 10) / 10
    : null;

  const badgeHistory = all.slice(0, 14).map((r) => ({
    date:  r.snapshotDate,
    level: r.badgeLevel,
  }));

  return { today: todaySnap, yesterday: ySnap, trend: all, weeklyAvg, badgeHistory };
}

export async function getPublicTransparencyProfile(
  locationId: string,
): Promise<PublicTransparencyProfile> {
  const sb = createServiceClient();

  const { data: row } = await sb
    .from('delivery_transparency_snapshots')
    .select(
      'trust_score, badge_level, avg_delivery_min, on_time_rate_pct, satisfaction_rate, orders_last_30d, snapshot_date',
    )
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return {
      trustScore:       50,
      badgeLevel:       'bronze',
      badgeLabel:       getBadgeLabel('bronze'),
      avgDeliveryMin:   null,
      onTimeRatePct:    null,
      satisfactionRate: null,
      ordersLast30d:    0,
      snapshotDate:     null,
    };
  }

  const level = row.badge_level as BadgeLevel;
  return {
    trustScore:       Number(row.trust_score),
    badgeLevel:       level,
    badgeLabel:       getBadgeLabel(level),
    avgDeliveryMin:   row.avg_delivery_min != null ? Number(row.avg_delivery_min) : null,
    onTimeRatePct:    row.on_time_rate_pct != null ? Number(row.on_time_rate_pct) : null,
    satisfactionRate: row.satisfaction_rate != null ? Number(row.satisfaction_rate) : null,
    ordersLast30d:    Number(row.orders_last_30d ?? 0),
    snapshotDate:     row.snapshot_date as string,
  };
}

export async function pruneTransparencySnapshots(daysToKeep = 365): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_transparency_snapshots', { days_to_keep: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
