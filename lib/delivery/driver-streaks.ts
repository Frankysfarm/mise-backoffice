/**
 * lib/delivery/driver-streaks.ts
 *
 * Fahrer-Incentive Streak-Tracking V2 — Phase 194
 *
 * Trackt aufeinanderfolgende pünktliche Lieferungen (Streak).
 * Multiplikator erhöht sich bei Streak-Meilensteinen (5/10/20/50).
 * Reset bei verspäteter Lieferung.
 *
 * Funktionen:
 *   getStreakConfig()              — Konfig für eine Location
 *   upsertStreakConfig()           — Konfig speichern
 *   recordDelivery()              — Lieferung aufzeichnen + Streak aktualisieren
 *   getDriverStreak()             — Streak eines Fahrers
 *   getStreakLeaderboard()         — Rangliste nach aktuellem Streak
 *   getStreakMilestones()          — Meilenstein-Events
 *   getStreakDashboard()           — Dashboard-Daten
 *   computeMultiplier()           — Multiplikator für eine Streak-Länge
 *   buildStreakSummaryForDriver()  — Fahrer-App: kompakte Streak-Info
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface MultiplierTier {
  threshold:  number;
  multiplier: number;
}

export interface MilestoneBonusTier {
  milestone: number;
  bonus_eur: number;
}

export interface StreakConfig {
  id?: string;
  locationId:        string;
  multiplierTiers:   MultiplierTier[];
  milestoneBonusEur: MilestoneBonusTier[];
  enabled:           boolean;
}

export interface DriverStreak {
  id:               string;
  locationId:       string;
  driverId:         string;
  driverName:       string | null;
  currentStreak:    number;
  longestStreak:    number;
  totalOnTime:      number;
  totalDeliveries:  number;
  onTimeRatePct:    number;
  lastDeliveryAt:   string | null;
  lastStreakResetAt: string | null;
  currentMultiplier: number;
  nextMilestone:    number | null;
  stopsToNextMilestone: number | null;
  updatedAt:        string;
}

export interface StreakEvent {
  id:              string;
  locationId:      string;
  driverId:        string;
  driverName:      string | null;
  orderId:         string;
  wasOnTime:       boolean;
  streakBefore:    number;
  streakAfter:     number;
  bonusMultiplier: number;
  milestoneHit:    number | null;
  deliveredAt:     string;
}

export interface StreakLeaderboardEntry {
  driverId:         string;
  driverName:       string;
  currentStreak:    number;
  longestStreak:    number;
  onTimeRatePct:    number;
  currentMultiplier: number;
  streakRank:       number;
  alltimeRank:      number;
  lastDeliveryAt:   string | null;
}

export interface RecordDeliveryResult {
  streakBefore:     number;
  streakAfter:      number;
  wasOnTime:        boolean;
  multiplier:       number;
  milestoneHit:     number | null;
  milestoneBonusEur: number | null;
  streakBroken:     boolean;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const DEFAULT_TIERS: MultiplierTier[] = [
  { threshold: 5,  multiplier: 1.10 },
  { threshold: 10, multiplier: 1.25 },
  { threshold: 20, multiplier: 1.40 },
  { threshold: 50, multiplier: 1.60 },
];

const DEFAULT_MILESTONES: MilestoneBonusTier[] = [
  { milestone: 5,  bonus_eur: 2.00 },
  { milestone: 10, bonus_eur: 5.00 },
  { milestone: 20, bonus_eur: 10.00 },
  { milestone: 50, bonus_eur: 25.00 },
];

export function computeMultiplier(streak: number, tiers: MultiplierTier[]): number {
  let mult = 1.00;
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
  for (const tier of sorted) {
    if (streak >= tier.threshold) { mult = tier.multiplier; break; }
  }
  return mult;
}

function nextMilestoneInfo(
  streak: number,
  tiers: MultiplierTier[],
): { nextMilestone: number | null; stopsToNext: number | null } {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  for (const tier of sorted) {
    if (streak < tier.threshold) {
      return { nextMilestone: tier.threshold, stopsToNext: tier.threshold - streak };
    }
  }
  return { nextMilestone: null, stopsToNext: null };
}

function mapConfig(r: Record<string, unknown>): StreakConfig {
  return {
    id:                r.id as string,
    locationId:        r.location_id as string,
    multiplierTiers:   (r.multiplier_tiers as MultiplierTier[]) ?? DEFAULT_TIERS,
    milestoneBonusEur: (r.milestone_bonus_eur as MilestoneBonusTier[]) ?? DEFAULT_MILESTONES,
    enabled:           r.enabled as boolean,
  };
}

// ── Konfiguration ─────────────────────────────────────────────────────────────

export async function getStreakConfig(locationId: string): Promise<StreakConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_streak_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (!data) {
    return {
      locationId,
      multiplierTiers:   DEFAULT_TIERS,
      milestoneBonusEur: DEFAULT_MILESTONES,
      enabled:           true,
    };
  }
  return mapConfig(data as Record<string, unknown>);
}

export async function upsertStreakConfig(cfg: StreakConfig): Promise<StreakConfig> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_streak_config')
    .upsert({
      location_id:        cfg.locationId,
      multiplier_tiers:   cfg.multiplierTiers,
      milestone_bonus_eur: cfg.milestoneBonusEur,
      enabled:            cfg.enabled,
    }, { onConflict: 'location_id' })
    .select()
    .single();
  if (error) throw error;
  return mapConfig(data as Record<string, unknown>);
}

// ── Lieferung aufzeichnen ─────────────────────────────────────────────────────

/**
 * Zeichnet eine Lieferung auf und aktualisiert den Streak des Fahrers.
 * wasOnTime: TRUE wenn der Fahrer pünktlich geliefert hat.
 */
export async function recordDelivery(
  locationId: string,
  driverId: string,
  orderId: string,
  wasOnTime: boolean,
): Promise<RecordDeliveryResult> {
  const sb = createServiceClient();

  // Config + aktuellen Streak laden
  const [config, { data: streakRow }] = await Promise.all([
    getStreakConfig(locationId),
    sb.from('driver_streaks').select('*').eq('driver_id', driverId).maybeSingle(),
  ]);

  if (!config.enabled) {
    return { streakBefore: 0, streakAfter: 0, wasOnTime, multiplier: 1, milestoneHit: null, milestoneBonusEur: null, streakBroken: false };
  }

  const streakBefore = streakRow ? Number(streakRow.current_streak) : 0;
  const longestBefore = streakRow ? Number(streakRow.longest_streak) : 0;
  const totalOnTimeBefore = streakRow ? Number(streakRow.total_on_time) : 0;
  const totalDeliveriesBefore = streakRow ? Number(streakRow.total_deliveries) : 0;

  let streakAfter: number;
  let streakBroken = false;
  let lastStreakResetAt: string | null = streakRow?.last_streak_reset_at as string | null;

  if (wasOnTime) {
    streakAfter = streakBefore + 1;
  } else {
    streakAfter = 0;
    streakBroken = streakBefore > 0;
    lastStreakResetAt = new Date().toISOString();
  }

  const longestAfter = Math.max(longestBefore, streakAfter);
  const multiplier = computeMultiplier(streakAfter, config.multiplierTiers);

  // Meilenstein prüfen (wird beim Übergang auf diesen Wert geprüft)
  let milestoneHit: number | null = null;
  let milestoneBonusEur: number | null = null;
  if (wasOnTime && streakAfter > streakBefore) {
    for (const m of config.milestoneBonusEur) {
      if (streakAfter === m.milestone) {
        milestoneHit = m.milestone;
        milestoneBonusEur = m.bonus_eur;
        break;
      }
    }
  }

  // Streak-Eintrag upserten
  await sb.from('driver_streaks').upsert({
    location_id:          locationId,
    driver_id:            driverId,
    current_streak:       streakAfter,
    longest_streak:       longestAfter,
    total_on_time:        totalOnTimeBefore + (wasOnTime ? 1 : 0),
    total_deliveries:     totalDeliveriesBefore + 1,
    last_delivery_at:     new Date().toISOString(),
    last_streak_reset_at: lastStreakResetAt,
  }, { onConflict: 'driver_id' });

  // Event aufzeichnen
  await sb.from('driver_streak_events').insert({
    location_id:      locationId,
    driver_id:        driverId,
    order_id:         orderId,
    was_on_time:      wasOnTime,
    streak_before:    streakBefore,
    streak_after:     streakAfter,
    bonus_multiplier: multiplier,
    milestone_hit:    milestoneHit,
  });

  return { streakBefore, streakAfter, wasOnTime, multiplier, milestoneHit, milestoneBonusEur, streakBroken };
}

// ── Abfragen ──────────────────────────────────────────────────────────────────

export async function getDriverStreak(
  driverId: string,
  locationId: string,
): Promise<DriverStreak | null> {
  const sb = createServiceClient();
  const [{ data: row }, config] = await Promise.all([
    sb.from('driver_streaks').select('*, employees(name)').eq('driver_id', driverId).maybeSingle(),
    getStreakConfig(locationId),
  ]);
  if (!row) return null;

  const current = Number(row.current_streak);
  const multiplier = computeMultiplier(current, config.multiplierTiers);
  const { nextMilestone, stopsToNext } = nextMilestoneInfo(current, config.multiplierTiers);
  const total = Number(row.total_deliveries);
  const onTime = Number(row.total_on_time);

  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    driverId:         row.driver_id as string,
    driverName:       (row.employees as { name?: string } | null)?.name ?? null,
    currentStreak:    current,
    longestStreak:    Number(row.longest_streak),
    totalOnTime:      onTime,
    totalDeliveries:  total,
    onTimeRatePct:    total > 0 ? Math.round((onTime / total) * 1000) / 10 : 0,
    lastDeliveryAt:   row.last_delivery_at as string | null,
    lastStreakResetAt: row.last_streak_reset_at as string | null,
    currentMultiplier: multiplier,
    nextMilestone,
    stopsToNextMilestone: stopsToNext,
    updatedAt:        row.updated_at as string,
  };
}

export async function getStreakLeaderboard(
  locationId: string,
  limit = 20,
): Promise<StreakLeaderboardEntry[]> {
  const sb = createServiceClient();
  const [{ data: rows }, config] = await Promise.all([
    sb.from('v_driver_streak_leaderboard')
      .select('*')
      .eq('location_id', locationId)
      .order('current_streak', { ascending: false })
      .limit(limit),
    getStreakConfig(locationId),
  ]);

  return (rows ?? []).map((r) => {
    const current = Number(r.current_streak);
    return {
      driverId:          r.driver_id as string,
      driverName:        (r.driver_name as string) ?? '—',
      currentStreak:     current,
      longestStreak:     Number(r.longest_streak),
      onTimeRatePct:     Number(r.on_time_rate_pct),
      currentMultiplier: computeMultiplier(current, config.multiplierTiers),
      streakRank:        Number(r.streak_rank),
      alltimeRank:       Number(r.alltime_rank),
      lastDeliveryAt:    r.last_delivery_at as string | null,
    };
  });
}

export async function getStreakMilestones(
  locationId: string,
  limit = 50,
): Promise<StreakEvent[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_driver_streak_milestones')
    .select('*')
    .eq('location_id', locationId)
    .limit(limit);

  return (data ?? []).map((r) => ({
    id:              r.id as string ?? '',
    locationId:      r.location_id as string,
    driverId:        r.driver_id as string,
    driverName:      (r.driver_name as string) ?? null,
    orderId:         r.order_id as string,
    wasOnTime:       true,
    streakBefore:    0,
    streakAfter:     Number(r.streak_after),
    bonusMultiplier: 1,
    milestoneHit:    Number(r.milestone_hit),
    deliveredAt:     r.delivered_at as string,
  }));
}

export async function getDriverStreakEvents(
  driverId: string,
  limit = 30,
): Promise<StreakEvent[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_streak_events')
    .select('*, employees(name)')
    .eq('driver_id', driverId)
    .order('delivered_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id:              r.id as string,
    locationId:      r.location_id as string,
    driverId:        r.driver_id as string,
    driverName:      (r.employees as { name?: string } | null)?.name ?? null,
    orderId:         r.order_id as string,
    wasOnTime:       r.was_on_time as boolean,
    streakBefore:    Number(r.streak_before),
    streakAfter:     Number(r.streak_after),
    bonusMultiplier: Number(r.bonus_multiplier),
    milestoneHit:    r.milestone_hit != null ? Number(r.milestone_hit) : null,
    deliveredAt:     r.delivered_at as string,
  }));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface StreakDashboard {
  config:            StreakConfig;
  leaderboard:       StreakLeaderboardEntry[];
  milestones:        StreakEvent[];
  activeStreakers:   number;    // Fahrer mit Streak ≥ 1
  avgStreak:         number;
  topStreakDriver:   StreakLeaderboardEntry | null;
  totalMilestones:   number;
}

export async function getStreakDashboard(locationId: string): Promise<StreakDashboard> {
  const [config, leaderboard, milestones] = await Promise.all([
    getStreakConfig(locationId),
    getStreakLeaderboard(locationId, 50),
    getStreakMilestones(locationId, 20),
  ]);

  const activeStreakers = leaderboard.filter((e) => e.currentStreak >= 1).length;
  const avgStreak = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((s, e) => s + e.currentStreak, 0) / leaderboard.length * 10) / 10
    : 0;

  return {
    config,
    leaderboard,
    milestones,
    activeStreakers,
    avgStreak,
    topStreakDriver: leaderboard[0] ?? null,
    totalMilestones: milestones.length,
  };
}

// ── Fahrer-App: Kompakte Streak-Info ─────────────────────────────────────────

export interface DriverStreakSummary {
  currentStreak:       number;
  multiplier:          number;
  nextMilestone:       number | null;
  stopsToNextMilestone: number | null;
  longestStreak:       number;
  isOnFire:            boolean;  // Streak ≥ 10
}

export async function buildStreakSummaryForDriver(
  driverId: string,
  locationId: string,
): Promise<DriverStreakSummary> {
  const [streak, config] = await Promise.all([
    getDriverStreak(driverId, locationId),
    getStreakConfig(locationId),
  ]);

  if (!streak || !config.enabled) {
    return { currentStreak: 0, multiplier: 1, nextMilestone: null, stopsToNextMilestone: null, longestStreak: 0, isOnFire: false };
  }

  const { nextMilestone, stopsToNext } = nextMilestoneInfo(streak.currentStreak, config.multiplierTiers);
  return {
    currentStreak:       streak.currentStreak,
    multiplier:          streak.currentMultiplier,
    nextMilestone,
    stopsToNextMilestone: stopsToNext,
    longestStreak:       streak.longestStreak,
    isOnFire:            streak.currentStreak >= 10,
  };
}
