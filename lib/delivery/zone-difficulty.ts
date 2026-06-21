/**
 * lib/delivery/zone-difficulty.ts
 *
 * Phase 356 — Zone Difficulty Cache
 *
 * Aggregiert Tour-Feedback nach Lieferzone (A/B/C/D) und berechnet
 * Schwierigkeits-Modifikatoren für den Dispatch-Algorithmus:
 *
 *  stopCountModifier (0.5–1.0): reduziert max. Bundle-Kapazität bei schwierigen Zonen
 *  detourModifier    (0.5–1.0): reduziert Detour-Toleranz bei hoher Issue-Rate
 *
 * checkAndSendFeedbackPushes(): Cron-Check — sendet Feedback-Push nach Tour-Abschluss.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneDifficultyModifiers {
  stopCountModifier: number;
  detourModifier: number;
  avgDifficulty: number;
  sampleCount: number;
}

type ZoneKey = 'A' | 'B' | 'C' | 'D';
export type ZoneDifficultyMap = Record<ZoneKey, ZoneDifficultyModifiers>;

export interface ZoneDifficultyCacheRow {
  zone: string;
  avg_difficulty: number;
  avg_traffic: number;
  issue_rate_parking: number;
  issue_rate_nav: number;
  issue_rate_address: number;
  stop_count_modifier: number;
  detour_modifier: number;
  sample_count: number;
  computed_at: string;
}

function defaultModifiers(): ZoneDifficultyModifiers {
  return { stopCountModifier: 1.0, detourModifier: 1.0, avgDifficulty: 0, sampleCount: 0 };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Liest gecachete Zone-Schwierigkeits-Modifikatoren.
 * Graceful fallback auf 1.0 wenn Tabelle fehlt oder kein Cache.
 */
export async function getZoneDifficultyModifiers(locationId: string): Promise<ZoneDifficultyMap> {
  const result: ZoneDifficultyMap = {
    A: defaultModifiers(),
    B: defaultModifiers(),
    C: defaultModifiers(),
    D: defaultModifiers(),
  };
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from('zone_difficulty_cache')
      .select('zone, stop_count_modifier, detour_modifier, avg_difficulty, sample_count')
      .eq('location_id', locationId);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const z = String(row.zone ?? '').toUpperCase() as ZoneKey;
      if (z in result) {
        result[z] = {
          stopCountModifier: Number(row.stop_count_modifier) || 1.0,
          detourModifier:    Number(row.detour_modifier) || 1.0,
          avgDifficulty:     Number(row.avg_difficulty) || 0,
          sampleCount:       Number(row.sample_count) || 0,
        };
      }
    }
  } catch { /* graceful fallback */ }
  return result;
}

export async function getZoneDifficultyCache(locationId: string): Promise<ZoneDifficultyCacheRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('zone_difficulty_cache')
    .select('*')
    .eq('location_id', locationId)
    .order('zone', { ascending: true });
  return (data ?? []) as ZoneDifficultyCacheRow[];
}

// ── Compute ───────────────────────────────────────────────────────────────────

function computeModifiers(
  avgDifficulty: number,
  avgTraffic: number,
  maxIssueRatePct: number,
): { stopCountModifier: number; detourModifier: number } {
  // difficulty 1→1.0, difficulty 5→0.70
  const diffFactor  = 1.0 - ((Math.max(1, avgDifficulty) - 1) / 4) * 0.30;
  // traffic 1→0, traffic 5→−0.15 on detour
  const trafficPenalty = ((Math.max(1, avgTraffic) - 1) / 4) * 0.15;
  // max issue-rate 100 %→−0.20 on detour
  const issuePenalty = (maxIssueRatePct / 100) * 0.20;

  return {
    stopCountModifier: Math.max(0.50, Math.min(1.0, Math.round(diffFactor * 100) / 100)),
    detourModifier:    Math.max(0.50, Math.min(1.0, Math.round((1 - trafficPenalty - issuePenalty) * 100) / 100)),
  };
}

/**
 * Aggregiert Tour-Feedback der letzten `days` Tage nach Zone und
 * schreibt Schwierigkeits-Modifikatoren in zone_difficulty_cache.
 */
export async function refreshZoneDifficultyCache(
  locationId: string,
  days = 14,
): Promise<{ updated: number }> {
  const svc = createServiceClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data: rows } = await svc
    .from('tour_feedback')
    .select('difficulty_rating, traffic_rating, had_parking_issue, had_nav_issue, had_address_issue, mise_delivery_batches!batch_id(zone)')
    .eq('location_id', locationId)
    .gte('submitted_at', since.toISOString());

  if (!rows || rows.length === 0) return { updated: 0 };

  type Agg = {
    diffSum: number; diffCount: number;
    trafficSum: number; trafficCount: number;
    parking: number; nav: number; address: number; total: number;
  };
  const aggMap = new Map<string, Agg>();

  for (const r of rows as Array<Record<string, unknown>>) {
    const meta = r.mise_delivery_batches as { zone?: string | null } | null;
    const zone = String(meta?.zone ?? '').toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(zone)) continue;
    if (!aggMap.has(zone)) {
      aggMap.set(zone, { diffSum: 0, diffCount: 0, trafficSum: 0, trafficCount: 0, parking: 0, nav: 0, address: 0, total: 0 });
    }
    const a = aggMap.get(zone)!;
    a.total++;
    if (typeof r.difficulty_rating === 'number') { a.diffSum += r.difficulty_rating; a.diffCount++; }
    if (typeof r.traffic_rating === 'number')    { a.trafficSum += r.traffic_rating; a.trafficCount++; }
    if (r.had_parking_issue === true) a.parking++;
    if (r.had_nav_issue     === true) a.nav++;
    if (r.had_address_issue === true) a.address++;
  }

  let updated = 0;
  for (const [zone, a] of aggMap.entries()) {
    const avgDiff    = a.diffCount    > 0 ? a.diffSum    / a.diffCount    : 0;
    const avgTraffic = a.trafficCount > 0 ? a.trafficSum / a.trafficCount : 0;
    const rParking   = a.total > 0 ? (a.parking / a.total) * 100 : 0;
    const rNav       = a.total > 0 ? (a.nav     / a.total) * 100 : 0;
    const rAddress   = a.total > 0 ? (a.address / a.total) * 100 : 0;
    const mods = computeModifiers(avgDiff, avgTraffic, Math.max(rParking, rNav, rAddress));

    const { error } = await svc.from('zone_difficulty_cache').upsert({
      location_id:         locationId,
      zone,
      avg_difficulty:      Math.round(avgDiff    * 100) / 100,
      avg_traffic:         Math.round(avgTraffic * 100) / 100,
      issue_rate_parking:  Math.round(rParking   * 100) / 100,
      issue_rate_nav:      Math.round(rNav       * 100) / 100,
      issue_rate_address:  Math.round(rAddress   * 100) / 100,
      stop_count_modifier: mods.stopCountModifier,
      detour_modifier:     mods.detourModifier,
      sample_count:        a.total,
      computed_at:         new Date().toISOString(),
    }, { onConflict: 'location_id,zone' });

    if (!error) updated++;
  }
  return { updated };
}

export async function refreshZoneDifficultyCacheAllLocations(
  days = 14,
): Promise<{ locations: number; zones: number; errors: number }> {
  const svc = createServiceClient();
  const { data: locs } = await svc.from('locations').select('id').eq('is_active', true);
  let zones = 0, errors = 0;
  const results = await Promise.allSettled(
    (locs ?? []).map((l) => refreshZoneDifficultyCache(l.id as string, days)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') zones += r.value.updated;
    else errors++;
  }
  return { locations: (locs ?? []).length, zones, errors };
}

// ── Feedback Push After Tour ──────────────────────────────────────────────────

export async function enqueueFeedbackRequestPush(driverId: string, batchId: string): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('mise_push_outbox').insert({
      driver_id: driverId,
      type:      'feedback_request',
      title:     'Tour abgeschlossen! Wie war\'s?',
      body:      'Bewerte deine Tour kurz — dauert nur 30 Sekunden.',
      sound:     'default',
      priority:  'normal',
      data:      { batch_id: batchId, action: 'open_feedback' },
    });
  } catch { /* fire-and-forget */ }
}

/**
 * Cron-Check: findet kürzlich abgeschlossene Batches ohne Feedback-Push
 * und sendet Feedback-Anfragen an die Fahrer.
 */
export async function checkAndSendFeedbackPushes(locationId: string): Promise<{ sent: number }> {
  const svc = createServiceClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const tenMinAgo   = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: completedBatches } = await svc
    .from('mise_delivery_batches')
    .select('id, driver_id, updated_at')
    .eq('location_id', locationId)
    .in('state', ['completed', 'delivered', 'returned'])
    .gte('updated_at', twoHoursAgo)
    .lte('updated_at', tenMinAgo)
    .limit(20);

  if (!completedBatches || completedBatches.length === 0) return { sent: 0 };

  const batchIds = completedBatches.map((b) => b.id as string);

  const [{ data: existingFeedback }, { data: existingPushes }] = await Promise.all([
    svc.from('tour_feedback').select('batch_id').in('batch_id', batchIds),
    svc.from('mise_push_outbox').select('data').eq('type', 'feedback_request').gte('created_at', twoHoursAgo),
  ]);

  const feedbackSet = new Set((existingFeedback ?? []).map((f) => f.batch_id as string));
  const pushedSet   = new Set(
    (existingPushes ?? [])
      .map((p) => (p.data as Record<string, unknown>)?.batch_id as string | undefined)
      .filter(Boolean) as string[],
  );

  let sent = 0;
  for (const batch of completedBatches) {
    const batchId  = batch.id as string;
    const driverId = batch.driver_id as string | null;
    if (!driverId || feedbackSet.has(batchId) || pushedSet.has(batchId)) continue;
    await enqueueFeedbackRequestPush(driverId, batchId);
    sent++;
  }
  return { sent };
}

export async function checkFeedbackPushesAllLocations(): Promise<{
  locations: number; sent: number; errors: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc.from('locations').select('id').eq('is_active', true);
  let sent = 0, errors = 0;
  const results = await Promise.allSettled(
    (locs ?? []).map((l) => checkAndSendFeedbackPushes(l.id as string)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') sent += r.value.sent;
    else errors++;
  }
  return { locations: (locs ?? []).length, sent, errors };
}
