/**
 * lib/delivery/driver-ranking.ts
 *
 * Phase 329 — Fahrer-Ranking-Engine
 *
 * Wöchentliches automatisches Fahrer-Ranking auf Basis des Composite-Scores
 * plus rohe Leistungsdaten (Touren, Pünktlichkeit, Bewertung, Verdienst).
 *
 * Funktionen:
 *  computeWeeklyRanking()           — Wochenranking berechnen + in DB speichern
 *  autoTriggerRewards()             — Top-3-Prämien automatisch auslösen
 *  getWeeklyRankingDashboard()      — Admin-Dashboard-Daten
 *  getRankingHistory()              — Letzte N Wochen
 *  approveReward()                  — Manuelle Genehmigung
 *  rejectReward()                   — Ablehnung mit Notiz
 *  computeWeeklyRankingAllLocations() — Cron-Batch
 *  pruneOldRankings()               — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ─────────────────────────────────────────────────────────────────────

export interface WeeklyRankingEntry {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  initials: string;
  weekStart: string;
  weekEnd: string;
  rank: number;
  compositeScore: number;
  grade: string;
  toursCompleted: number;
  stopsCompleted: number;
  onTimeRate: number | null;
  avgRating: number | null;
  totalEarningsEur: number;
  activeMinutes: number;
  kmTotal: number;
  isTop3: boolean;
}

export interface RankingReward {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  initials: string;
  rankingId: string;
  weekStart: string;
  rank: number;
  bonusEur: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  autoTriggered: boolean;
  adminNote: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface RewardConfig {
  rank1BonusEur: number;
  rank2BonusEur: number;
  rank3BonusEur: number;
  minToursRequired: number;
  autoApprove: boolean;
  notifyDriver: boolean;
  active: boolean;
}

export interface RankingDashboard {
  weekStart: string;
  weekEnd: string;
  totalDrivers: number;
  avgScore: number;
  pendingRewards: number;
  pendingRewardsEur: number;
  topDriver: { name: string | null; score: number; grade: string } | null;
  currentRanking: WeeklyRankingEntry[];
  pendingRewardList: RankingReward[];
  rewardConfig: RewardConfig | null;
  lastComputedAt: string | null;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function weekBounds(offsetWeeks = 0): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday - offsetWeeks * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function initials(name: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

// ─── Ranking berechnen ────────────────────────────────────────────────────────

export async function computeWeeklyRanking(locationId: string): Promise<{
  computed: number;
  rewardTriggered: number;
  errors: string[];
}> {
  const sb = createServiceClient();
  const errors: string[] = [];
  const { weekStart, weekEnd } = weekBounds(0);

  // 1. Alle aktiven Fahrer dieser Location laden
  const { data: drivers, error: driverErr } = await sb
    .from('employees')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('rolle', 'fahrer')
    .eq('aktiv', true);

  if (driverErr || !drivers?.length) return { computed: 0, rewardTriggered: 0, errors: [] };

  // 2. Performance-Daten aus DB aggregieren
  const rangeStart = weekStart + 'T00:00:00.000Z';
  const rangeEnd = weekEnd + 'T23:59:59.999Z';

  const [toursRes, stopsRes, ratingsRes, earningsRes, compositeRes] = await Promise.all([
    // Abgeschlossene Touren je Fahrer
    sb.from('mise_delivery_batches')
      .select('driver_id, id, km_total, started_at, completed_at')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('completed_at', rangeStart)
      .lte('completed_at', rangeEnd),

    // Stops je Fahrer
    sb.from('mise_delivery_stops')
      .select('batch_id, status, arrived_at, eta_latest')
      .eq('location_id', locationId)
      .in('status', ['delivered', 'failed'])
      .gte('arrived_at', rangeStart)
      .lte('arrived_at', rangeEnd),

    // Bewertungen
    sb.from('customer_ratings')
      .select('driver_id, sterne')
      .eq('location_id', locationId)
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd),

    // Trinkgelder + Schicht-Stunden als Proxy für Verdienst
    sb.from('driver_shifts')
      .select('driver_id, planned_start, planned_end, base_wage_eur')
      .eq('location_id', locationId)
      .gte('planned_start', rangeStart)
      .lte('planned_start', rangeEnd),

    // Composite Scores für diese Woche
    sb.from('driver_composite_scores')
      .select('driver_id, composite_score, grade')
      .eq('location_id', locationId)
      .eq('period', 'week')
      .gte('period_start', weekStart)
      .order('composite_score', { ascending: false }),
  ]);

  const tours = (toursRes.data ?? []) as {
    driver_id: string; id: string; km_total: number | null;
    started_at: string | null; completed_at: string | null;
  }[];
  const stops = (stopsRes.data ?? []) as {
    batch_id: string; status: string;
    arrived_at: string | null; eta_latest: string | null;
  }[];
  const ratings = (ratingsRes.data ?? []) as { driver_id: string; sterne: number }[];
  const shifts = (earningsRes.data ?? []) as {
    driver_id: string; planned_start: string; planned_end: string; base_wage_eur: number | null;
  }[];
  const compositeScores = new Map(
    (compositeRes.data ?? []).map((r: { driver_id: string; composite_score: number; grade: string }) =>
      [r.driver_id, { score: Number(r.composite_score), grade: r.grade }]
    )
  );

  // Batch-ID → driver_id mapping
  const batchToDriver = new Map(tours.map((t) => [t.id, t.driver_id]));

  // Per-driver aggregation
  interface DriverAgg {
    toursCompleted: number;
    stopsCompleted: number;
    stopsOnTime: number;
    totalStopsWithEta: number;
    totalKm: number;
    activeMinutes: number;
    ratingSum: number;
    ratingCount: number;
    earningsEur: number;
  }

  const agg = new Map<string, DriverAgg>();
  for (const d of drivers) {
    agg.set(d.id, {
      toursCompleted: 0, stopsCompleted: 0, stopsOnTime: 0,
      totalStopsWithEta: 0, totalKm: 0, activeMinutes: 0,
      ratingSum: 0, ratingCount: 0, earningsEur: 0,
    });
  }

  for (const t of tours) {
    const a = agg.get(t.driver_id);
    if (!a) continue;
    a.toursCompleted++;
    a.totalKm += Number(t.km_total ?? 0);
    if (t.started_at && t.completed_at) {
      a.activeMinutes += Math.round(
        (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60_000
      );
    }
  }

  for (const s of stops) {
    const driverId = batchToDriver.get(s.batch_id);
    if (!driverId) continue;
    const a = agg.get(driverId);
    if (!a) continue;
    if (s.status === 'delivered') {
      a.stopsCompleted++;
      if (s.arrived_at && s.eta_latest) {
        a.totalStopsWithEta++;
        if (new Date(s.arrived_at) <= new Date(s.eta_latest)) a.stopsOnTime++;
      }
    }
  }

  for (const r of ratings) {
    const a = agg.get(r.driver_id);
    if (!a) continue;
    a.ratingSum += Number(r.sterne);
    a.ratingCount++;
  }

  for (const sh of shifts) {
    const a = agg.get(sh.driver_id);
    if (!a) continue;
    const hourlyWage = Number(sh.base_wage_eur ?? 12);
    const start = new Date(sh.planned_start);
    const end = new Date(sh.planned_end);
    const hours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
    a.earningsEur += hours * hourlyWage;
  }

  // 3. Ranking erstellen (nach compositeScore, Fallback: toursCompleted)
  const ranked = drivers
    .map((d) => {
      const a = agg.get(d.id)!;
      const cs = compositeScores.get(d.id);
      const score = cs?.score ?? (a.toursCompleted > 0 ? Math.min(100, a.toursCompleted * 5) : 0);
      return {
        driverId: d.id,
        driverName: d.name ?? null,
        compositeScore: score,
        grade: cs?.grade ?? gradeFromScore(score),
        toursCompleted: a.toursCompleted,
        stopsCompleted: a.stopsCompleted,
        onTimeRate: a.totalStopsWithEta > 0 ? a.stopsOnTime / a.totalStopsWithEta : null,
        avgRating: a.ratingCount > 0 ? a.ratingSum / a.ratingCount : null,
        totalEarningsEur: a.earningsEur,
        activeMinutes: a.activeMinutes,
        kmTotal: a.totalKm,
      };
    })
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      return b.toursCompleted - a.toursCompleted;
    });

  // 4. Upsert rankings
  const upsertRows = ranked.map((r, i) => ({
    location_id: locationId,
    driver_id: r.driverId,
    week_start: weekStart,
    week_end: weekEnd,
    rank: i + 1,
    composite_score: r.compositeScore,
    grade: r.grade,
    tours_completed: r.toursCompleted,
    stops_completed: r.stopsCompleted,
    on_time_rate: r.onTimeRate,
    avg_rating: r.avgRating,
    total_earnings_eur: r.totalEarningsEur,
    active_minutes: r.activeMinutes,
    km_total: r.kmTotal,
    is_top3: i < 3,
  }));

  const { error: upsertErr } = await sb
    .from('driver_weekly_rankings')
    .upsert(upsertRows, { onConflict: 'location_id,driver_id,week_start' });

  if (upsertErr) errors.push(`upsert: ${upsertErr.message}`);

  // 5. Automatische Prämien für Top-3 auslösen
  const rewardTriggered = await autoTriggerRewards(locationId, weekStart);

  return { computed: upsertRows.length, rewardTriggered, errors };
}

// ─── Prämien auto-triggern ────────────────────────────────────────────────────

export async function autoTriggerRewards(locationId: string, weekStart: string): Promise<number> {
  const sb = createServiceClient();

  // Konfiguration laden (oder Defaults verwenden)
  const { data: cfg } = await sb
    .from('driver_ranking_reward_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (cfg && !cfg.active) return 0;

  const bonusMap: Record<number, number> = {
    1: Number(cfg?.rank1_bonus_eur ?? 20),
    2: Number(cfg?.rank2_bonus_eur ?? 12),
    3: Number(cfg?.rank3_bonus_eur ?? 7),
  };
  const minTours = Number(cfg?.min_tours_required ?? 5);
  const autoApprove = Boolean(cfg?.auto_approve ?? false);

  // Top-3 Fahrer dieser Woche laden
  const { data: top3 } = await sb
    .from('driver_weekly_rankings')
    .select('id, driver_id, rank, tours_completed')
    .eq('location_id', locationId)
    .eq('week_start', weekStart)
    .eq('is_top3', true)
    .lte('rank', 3)
    .order('rank');

  if (!top3?.length) return 0;

  let triggered = 0;
  for (const entry of top3) {
    if (Number(entry.tours_completed) < minTours) continue;

    const bonusEur = bonusMap[entry.rank as 1 | 2 | 3];
    if (!bonusEur) continue;

    const status = autoApprove ? 'approved' : 'pending';
    const { error } = await sb
      .from('driver_ranking_rewards')
      .upsert({
        location_id: locationId,
        driver_id: entry.driver_id,
        ranking_id: entry.id,
        week_start: weekStart,
        rank: entry.rank,
        bonus_eur: bonusEur,
        status,
        auto_triggered: true,
        approved_at: autoApprove ? new Date().toISOString() : null,
      }, { onConflict: 'ranking_id,driver_id' });

    if (!error) triggered++;
  }

  return triggered;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getWeeklyRankingDashboard(locationId: string): Promise<RankingDashboard> {
  const sb = createServiceClient();
  const { weekStart, weekEnd } = weekBounds(0);

  const [rankingRes, rewardsRes, configRes] = await Promise.all([
    sb.from('driver_weekly_rankings')
      .select(`
        id, driver_id, rank, composite_score, grade,
        tours_completed, stops_completed, on_time_rate, avg_rating,
        total_earnings_eur, active_minutes, km_total, is_top3,
        week_start, week_end,
        employees!driver_id(name)
      `)
      .eq('location_id', locationId)
      .eq('week_start', weekStart)
      .order('rank'),

    sb.from('driver_ranking_rewards')
      .select(`
        id, driver_id, ranking_id, week_start, rank, bonus_eur,
        status, auto_triggered, admin_note, approved_at, paid_at, created_at,
        employees!driver_id(name)
      `)
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('rank'),

    sb.from('driver_ranking_reward_config')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  type RawRankRow = {
    id: string; driver_id: string; rank: number; composite_score: number; grade: string;
    tours_completed: number; stops_completed: number; on_time_rate: number | null;
    avg_rating: number | null; total_earnings_eur: number; active_minutes: number;
    km_total: number; is_top3: boolean; week_start: string; week_end: string;
    employees: { name: string | null } | null;
  };

  type RawRewardRow = {
    id: string; driver_id: string; ranking_id: string; week_start: string; rank: number;
    bonus_eur: number; status: string; auto_triggered: boolean; admin_note: string | null;
    approved_at: string | null; paid_at: string | null; created_at: string;
    employees: { name: string | null } | null;
  };

  const currentRanking: WeeklyRankingEntry[] = ((rankingRes.data ?? []) as unknown as RawRankRow[]).map((r) => ({
    id: r.id,
    locationId,
    driverId: r.driver_id,
    driverName: r.employees?.name ?? null,
    initials: initials(r.employees?.name ?? null),
    weekStart: r.week_start,
    weekEnd: r.week_end,
    rank: r.rank,
    compositeScore: Number(r.composite_score),
    grade: r.grade,
    toursCompleted: r.tours_completed,
    stopsCompleted: r.stops_completed,
    onTimeRate: r.on_time_rate != null ? Number(r.on_time_rate) : null,
    avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
    totalEarningsEur: Number(r.total_earnings_eur),
    activeMinutes: r.active_minutes,
    kmTotal: Number(r.km_total),
    isTop3: r.is_top3,
  }));

  const pendingRewardList: RankingReward[] = ((rewardsRes.data ?? []) as unknown as RawRewardRow[]).map((r) => ({
    id: r.id,
    locationId,
    driverId: r.driver_id,
    driverName: r.employees?.name ?? null,
    initials: initials(r.employees?.name ?? null),
    rankingId: r.ranking_id,
    weekStart: r.week_start,
    rank: r.rank,
    bonusEur: Number(r.bonus_eur),
    status: r.status as RankingReward['status'],
    autoTriggered: r.auto_triggered,
    adminNote: r.admin_note,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    createdAt: r.created_at,
  }));

  const cfg = configRes.data;
  const rewardConfig: RewardConfig | null = cfg
    ? {
        rank1BonusEur: Number(cfg.rank1_bonus_eur),
        rank2BonusEur: Number(cfg.rank2_bonus_eur),
        rank3BonusEur: Number(cfg.rank3_bonus_eur),
        minToursRequired: Number(cfg.min_tours_required),
        autoApprove: Boolean(cfg.auto_approve),
        notifyDriver: Boolean(cfg.notify_driver),
        active: Boolean(cfg.active),
      }
    : null;

  const totalDrivers = currentRanking.length;
  const avgScore = totalDrivers > 0
    ? currentRanking.reduce((s, r) => s + r.compositeScore, 0) / totalDrivers
    : 0;
  const pendingRewardsEur = pendingRewardList.reduce((s, r) => s + r.bonusEur, 0);
  const topDriver = currentRanking[0]
    ? { name: currentRanking[0].driverName, score: currentRanking[0].compositeScore, grade: currentRanking[0].grade }
    : null;

  return {
    weekStart,
    weekEnd,
    totalDrivers,
    avgScore: Math.round(avgScore * 10) / 10,
    pendingRewards: pendingRewardList.length,
    pendingRewardsEur,
    topDriver,
    currentRanking,
    pendingRewardList,
    rewardConfig,
    lastComputedAt: currentRanking.length > 0 ? new Date().toISOString() : null,
  };
}

// ─── Ranking-Verlauf ──────────────────────────────────────────────────────────

export async function getRankingHistory(locationId: string, weeks = 8): Promise<{
  weekStart: string;
  weekEnd: string;
  entries: WeeklyRankingEntry[];
}[]> {
  const sb = createServiceClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);

  const { data } = await sb
    .from('driver_weekly_rankings')
    .select(`
      id, driver_id, rank, composite_score, grade,
      tours_completed, stops_completed, on_time_rate, avg_rating,
      total_earnings_eur, active_minutes, km_total, is_top3,
      week_start, week_end,
      employees!driver_id(name)
    `)
    .eq('location_id', locationId)
    .gte('week_start', cutoff.toISOString().slice(0, 10))
    .order('week_start', { ascending: false })
    .order('rank');

  type RawRow = {
    id: string; driver_id: string; rank: number; composite_score: number; grade: string;
    tours_completed: number; stops_completed: number; on_time_rate: number | null;
    avg_rating: number | null; total_earnings_eur: number; active_minutes: number;
    km_total: number; is_top3: boolean; week_start: string; week_end: string;
    employees: { name: string | null } | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];
  const byWeek = new Map<string, { weekStart: string; weekEnd: string; entries: WeeklyRankingEntry[] }>();

  for (const r of rows) {
    if (!byWeek.has(r.week_start)) {
      byWeek.set(r.week_start, { weekStart: r.week_start, weekEnd: r.week_end, entries: [] });
    }
    byWeek.get(r.week_start)!.entries.push({
      id: r.id,
      locationId,
      driverId: r.driver_id,
      driverName: r.employees?.name ?? null,
      initials: initials(r.employees?.name ?? null),
      weekStart: r.week_start,
      weekEnd: r.week_end,
      rank: r.rank,
      compositeScore: Number(r.composite_score),
      grade: r.grade,
      toursCompleted: r.tours_completed,
      stopsCompleted: r.stops_completed,
      onTimeRate: r.on_time_rate != null ? Number(r.on_time_rate) : null,
      avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
      totalEarningsEur: Number(r.total_earnings_eur),
      activeMinutes: r.active_minutes,
      kmTotal: Number(r.km_total),
      isTop3: r.is_top3,
    });
  }

  return Array.from(byWeek.values());
}

// ─── Prämie genehmigen / ablehnen ─────────────────────────────────────────────

export async function approveReward(rewardId: string, adminId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_ranking_rewards')
    .update({ status: 'approved', approved_by: adminId, approved_at: new Date().toISOString() })
    .eq('id', rewardId)
    .eq('status', 'pending');
  return !error;
}

export async function rejectReward(rewardId: string, adminId: string, note: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_ranking_rewards')
    .update({ status: 'rejected', approved_by: adminId, approved_at: new Date().toISOString(), admin_note: note })
    .eq('id', rewardId)
    .eq('status', 'pending');
  return !error;
}

export async function markRewardPaid(rewardId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_ranking_rewards')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', rewardId)
    .eq('status', 'approved');
  return !error;
}

// ─── Reward-Konfiguration upserten ────────────────────────────────────────────

export async function upsertRewardConfig(locationId: string, config: Partial<RewardConfig>): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_ranking_reward_config')
    .upsert({
      location_id: locationId,
      ...(config.rank1BonusEur != null && { rank1_bonus_eur: config.rank1BonusEur }),
      ...(config.rank2BonusEur != null && { rank2_bonus_eur: config.rank2BonusEur }),
      ...(config.rank3BonusEur != null && { rank3_bonus_eur: config.rank3BonusEur }),
      ...(config.minToursRequired != null && { min_tours_required: config.minToursRequired }),
      ...(config.autoApprove != null && { auto_approve: config.autoApprove }),
      ...(config.notifyDriver != null && { notify_driver: config.notifyDriver }),
      ...(config.active != null && { active: config.active }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'location_id' });
  return !error;
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export async function computeWeeklyRankingAllLocations(): Promise<{
  locations: number;
  computed: number;
  rewardTriggered: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb.from('tenants').select('id').eq('lieferung_aktiv', true);
  if (!locations?.length) return { locations: 0, computed: 0, rewardTriggered: 0, errors: 0 };

  let computed = 0;
  let rewardTriggered = 0;
  let errors = 0;

  await Promise.allSettled(
    locations.map(async (loc: { id: string }) => {
      const result = await computeWeeklyRanking(loc.id);
      computed += result.computed;
      rewardTriggered += result.rewardTriggered;
      errors += result.errors.length;
    })
  );

  return { locations: locations.length, computed, rewardTriggered, errors };
}

export async function pruneOldRankings(days = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { error, count } = await sb
    .from('driver_weekly_rankings')
    .delete({ count: 'exact' })
    .lt('week_start', new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10));
  if (error) return { pruned: 0 };
  return { pruned: count ?? 0 };
}
