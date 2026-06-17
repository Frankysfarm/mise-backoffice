/**
 * lib/delivery/quality-score.ts
 *
 * Smart Delivery Quality Score Engine (Phase 214)
 * Composite daily score (0–100) per location built from 5 weighted dimensions.
 *
 * Weights: on-time 30%, satisfaction 25%, accuracy 20%, SLA 15%, low-cancel 10%
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface QualityComponents {
  scoreOntime:       number; // 0–100
  scoreSatisfaction: number; // 0–100
  scoreAccuracy:     number; // 0–100
  scoreSla:          number; // 0–100
  scoreCancel:       number; // 0–100
}

export interface QualitySnapshot {
  locationId:        string;
  scoreDate:         string;
  overallScore:      number;
  grade:             string;
  components:        QualityComponents;
  weakestDimension:  string;
  totalOrders:       number;
  ontimeOrders:      number;
  avgRating:         number | null;
  complaintRatePct:  number | null;
  slaBreachRatePct:  number | null;
  cancelRatePct:     number | null;
}

export interface QualityTrendRow {
  scoreDate:         string;
  overallScore:      number;
  grade:             string;
  scoreOntime:       number;
  scoreSatisfaction: number;
  scoreAccuracy:     number;
  scoreSla:          number;
  scoreCancel:       number;
  totalOrders:       number;
}

export interface QualityDashboard {
  today:              QualitySnapshot | null;
  yesterday:          QualitySnapshot | null;
  trend:              QualityTrendRow[];
  weeklyAvg:          number;
  improvement:        string | null; // top recommendation
}

// ──────────────────────────────────────────────────────────────────────────────
// Weights
// ──────────────────────────────────────────────────────────────────────────────

const W_ONTIME       = 0.30;
const W_SATISFACTION = 0.25;
const W_ACCURACY     = 0.20;
const W_SLA          = 0.15;
const W_CANCEL       = 0.10;

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// ──────────────────────────────────────────────────────────────────────────────
// Core computation
// ──────────────────────────────────────────────────────────────────────────────

export async function computeQualityScore(
  locationId: string,
  forDate: string, // YYYY-MM-DD
): Promise<QualitySnapshot> {
  const sb = createServiceClient();

  const dayStart = `${forDate}T00:00:00.000Z`;
  const dayEnd   = `${forDate}T23:59:59.999Z`;

  // Parallel data fetching
  const [
    { data: orders },
    { data: ratings },
    { data: slaBreaches },
  ] = await Promise.all([
    // All delivery orders for the day
    sb.from('customer_orders')
      .select('id, status, fertig_am, eta_earliest, created_at, bestellart')
      .eq('tenant_id', locationId)
      .eq('bestellart', 'lieferung')
      .gte('bestellt_am', dayStart)
      .lte('bestellt_am', dayEnd),

    // Driver ratings for orders delivered that day
    sb.from('driver_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),

    // SLA breaches: delay_monitor events that day
    sb.from('delivery_delay_events')
      .select('id, severity')
      .eq('location_id', locationId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .eq('severity', 'critical'),
  ]);

  const allOrders = (orders ?? []) as Array<{
    id: string;
    status: string;
    fertig_am: string | null;
    eta_earliest: string | null;
    created_at: string;
    bestellart: string;
  }>;

  const totalOrders = allOrders.length;

  // ── 1. On-time score (30%) ────────────────────────────────────────────────
  const deliveredOrders = allOrders.filter((o) => o.status === 'geliefert');
  const ontimeOrders = deliveredOrders.filter((o) => {
    if (!o.fertig_am || !o.eta_earliest) return false;
    return new Date(o.fertig_am) <= new Date(o.eta_earliest);
  }).length;

  const ontimeRate = deliveredOrders.length > 0
    ? ontimeOrders / deliveredOrders.length
    : null;
  const scoreOntime = ontimeRate !== null ? clamp(ontimeRate * 100) : 70; // neutral fallback

  // ── 2. Satisfaction score (25%) ───────────────────────────────────────────
  const ratingRows = (ratings ?? []) as Array<{ rating: number }>;
  const avgRating = ratingRows.length > 0
    ? ratingRows.reduce((s, r) => s + Number(r.rating), 0) / ratingRows.length
    : null;
  // Map 1–5 star rating to 0–100: (avgRating - 1) / 4 * 100
  const scoreSatisfaction = avgRating !== null
    ? clamp(((avgRating - 1) / 4) * 100)
    : 70; // neutral fallback

  // ── 3. Accuracy score (20%) — based on cancellations with complaint cause ──
  const cancelledOrders = allOrders.filter((o) =>
    ['storniert', 'abgebrochen'].includes(o.status),
  );
  const cancelRatePct = totalOrders > 0
    ? (cancelledOrders.length / totalOrders) * 100
    : 0;
  // Low cancel = high accuracy: 0% cancel → 100, 20%+ cancel → 0
  const scoreAccuracy = clamp(Math.max(0, 100 - cancelRatePct * 5));

  // ── 4. SLA score (15%) ────────────────────────────────────────────────────
  const criticalBreaches = (slaBreaches ?? []).length;
  const slaBreachRatePct = totalOrders > 0
    ? (criticalBreaches / totalOrders) * 100
    : 0;
  // 0% breach → 100, 10%+ breach → 0
  const scoreSla = clamp(Math.max(0, 100 - slaBreachRatePct * 10));

  // ── 5. Cancel score (10%) ─────────────────────────────────────────────────
  // Low cancellation rate: 0% → 100, 15%+ → 0
  const scoreCancel = clamp(Math.max(0, 100 - cancelRatePct * 6.67));

  // ── Composite score ───────────────────────────────────────────────────────
  const overallScore = clamp(
    scoreOntime       * W_ONTIME       +
    scoreSatisfaction * W_SATISFACTION +
    scoreAccuracy     * W_ACCURACY     +
    scoreSla          * W_SLA          +
    scoreCancel       * W_CANCEL,
  );

  // ── Grade ─────────────────────────────────────────────────────────────────
  const grade = overallScore >= 90 ? 'A'
    : overallScore >= 75 ? 'B'
    : overallScore >= 60 ? 'C'
    : overallScore >= 45 ? 'D'
    : 'F';

  // ── Weakest dimension ─────────────────────────────────────────────────────
  const dimensions: [string, number][] = [
    ['Pünktlichkeit',        scoreOntime],
    ['Kundenzufriedenheit',  scoreSatisfaction],
    ['Bestellgenauigkeit',   scoreAccuracy],
    ['SLA-Einhaltung',       scoreSla],
    ['Stornierungsrate',     scoreCancel],
  ];
  dimensions.sort((a, b) => a[1] - b[1]);
  const weakestDimension = dimensions[0][0];

  return {
    locationId,
    scoreDate:         forDate,
    overallScore:      Math.round(overallScore * 100) / 100,
    grade,
    components: {
      scoreOntime:       Math.round(scoreOntime * 100) / 100,
      scoreSatisfaction: Math.round(scoreSatisfaction * 100) / 100,
      scoreAccuracy:     Math.round(scoreAccuracy * 100) / 100,
      scoreSla:          Math.round(scoreSla * 100) / 100,
      scoreCancel:       Math.round(scoreCancel * 100) / 100,
    },
    weakestDimension,
    totalOrders,
    ontimeOrders,
    avgRating:           avgRating !== null ? Math.round(avgRating * 100) / 100 : null,
    complaintRatePct:    Math.round(cancelRatePct * 100) / 100,
    slaBreachRatePct:    Math.round(slaBreachRatePct * 100) / 100,
    cancelRatePct:       Math.round(cancelRatePct * 100) / 100,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Snapshot persistence
// ──────────────────────────────────────────────────────────────────────────────

export async function snapshotQualityScore(
  locationId: string,
  forDate?: string,
): Promise<QualitySnapshot> {
  const dateStr = forDate ?? new Date().toISOString().slice(0, 10);
  const snapshot = await computeQualityScore(locationId, dateStr);
  const sb = createServiceClient();

  await sb.from('delivery_quality_scores').upsert({
    location_id:        locationId,
    score_date:         snapshot.scoreDate,
    overall_score:      snapshot.overallScore,
    score_ontime:       snapshot.components.scoreOntime,
    score_satisfaction: snapshot.components.scoreSatisfaction,
    score_accuracy:     snapshot.components.scoreAccuracy,
    score_sla:          snapshot.components.scoreSla,
    score_cancel:       snapshot.components.scoreCancel,
    total_orders:       snapshot.totalOrders,
    ontime_orders:      snapshot.ontimeOrders,
    avg_rating:         snapshot.avgRating,
    complaint_rate_pct: snapshot.complaintRatePct,
    sla_breach_rate_pct: snapshot.slaBreachRatePct,
    cancel_rate_pct:    snapshot.cancelRatePct,
    weakest_dimension:  snapshot.weakestDimension,
    snapshotted_at:     new Date().toISOString(),
  }, { onConflict: 'location_id,score_date' });

  return snapshot;
}

export async function snapshotAllLocations(forDate?: string): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: tenants } = await sb.from('tenants').select('id').eq('lieferung_aktiv', true);
  const locationIds = (tenants ?? []).map((t: { id: string }) => t.id);

  let snapshots = 0;
  let errors = 0;

  await Promise.all(
    locationIds.map(async (id) => {
      try {
        await snapshotQualityScore(id, forDate);
        snapshots++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locationIds.length, snapshots, errors };
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────────────────────

function rowToTrendRow(r: Record<string, unknown>): QualityTrendRow {
  return {
    scoreDate:         r.score_date as string,
    overallScore:      Number(r.overall_score),
    grade:             r.grade as string,
    scoreOntime:       Number(r.score_ontime),
    scoreSatisfaction: Number(r.score_satisfaction),
    scoreAccuracy:     Number(r.score_accuracy),
    scoreSla:          Number(r.score_sla),
    scoreCancel:       Number(r.score_cancel),
    totalOrders:       Number(r.total_orders),
  };
}

function rowToSnapshot(r: Record<string, unknown>): QualitySnapshot {
  return {
    locationId:        r.location_id as string,
    scoreDate:         r.score_date as string,
    overallScore:      Number(r.overall_score),
    grade:             r.grade as string,
    components: {
      scoreOntime:       Number(r.score_ontime),
      scoreSatisfaction: Number(r.score_satisfaction),
      scoreAccuracy:     Number(r.score_accuracy),
      scoreSla:          Number(r.score_sla),
      scoreCancel:       Number(r.score_cancel),
    },
    weakestDimension:  (r.weakest_dimension as string) ?? '',
    totalOrders:       Number(r.total_orders),
    ontimeOrders:      Number(r.ontime_orders),
    avgRating:         r.avg_rating != null ? Number(r.avg_rating) : null,
    complaintRatePct:  r.complaint_rate_pct != null ? Number(r.complaint_rate_pct) : null,
    slaBreachRatePct:  r.sla_breach_rate_pct != null ? Number(r.sla_breach_rate_pct) : null,
    cancelRatePct:     r.cancel_rate_pct != null ? Number(r.cancel_rate_pct) : null,
  };
}

const IMPROVEMENT_TIPS: Record<string, string> = {
  'Pünktlichkeit':        'Fahrerkapazität zu Stoßzeiten erhöhen und Küchen-Timing optimieren.',
  'Kundenzufriedenheit':  'Fahrer-Schulungen intensivieren und Trinkgeld-Anreize stärken.',
  'Bestellgenauigkeit':   'Küchenprozesse überprüfen und Stornierungsgründe analysieren.',
  'SLA-Einhaltung':       'SLA-Eskalationsregeln schärfen und Kapazitätslücken schließen.',
  'Stornierungsrate':     'Ursachen für Stornierungen analysieren (Küche / Fahrer / Kunde).',
};

export async function getQualityDashboard(locationId: string): Promise<QualityDashboard> {
  const sb = createServiceClient();
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [{ data: trend }, { data: todayRow }, { data: yestRow }] = await Promise.all([
    sb.from('delivery_quality_scores')
      .select('score_date,overall_score,grade,score_ontime,score_satisfaction,score_accuracy,score_sla,score_cancel,total_orders')
      .eq('location_id', locationId)
      .gte('score_date', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
      .order('score_date', { ascending: false })
      .limit(30),
    sb.from('delivery_quality_scores')
      .select('*')
      .eq('location_id', locationId)
      .eq('score_date', today)
      .maybeSingle(),
    sb.from('delivery_quality_scores')
      .select('*')
      .eq('location_id', locationId)
      .eq('score_date', yesterday)
      .maybeSingle(),
  ]);

  const trendRows = ((trend ?? []) as Record<string, unknown>[]).map(rowToTrendRow);

  const weeklyAvg = trendRows.slice(0, 7).length > 0
    ? trendRows.slice(0, 7).reduce((s, r) => s + r.overallScore, 0) / trendRows.slice(0, 7).length
    : 0;

  const todaySnapshot = todayRow ? rowToSnapshot(todayRow as Record<string, unknown>) : null;
  const yestSnapshot  = yestRow  ? rowToSnapshot(yestRow  as Record<string, unknown>) : null;

  const weakest = todaySnapshot?.weakestDimension ?? yestSnapshot?.weakestDimension ?? null;
  const improvement = weakest ? (IMPROVEMENT_TIPS[weakest] ?? null) : null;

  return {
    today:       todaySnapshot,
    yesterday:   yestSnapshot,
    trend:       trendRows,
    weeklyAvg:   Math.round(weeklyAvg * 100) / 100,
    improvement,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Maintenance
// ──────────────────────────────────────────────────────────────────────────────

export async function pruneOldScores(keepDays = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_quality_scores', { keep_days: keepDays });
  return (data as number | null) ?? 0;
}
