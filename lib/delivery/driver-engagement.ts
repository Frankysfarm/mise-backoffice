/**
 * lib/delivery/driver-engagement.ts — Phase 350
 *
 * Fahrer-Engagement-Engine (Gamification)
 *
 * Punkte pro Lieferung, Pünktlichkeit, Top-Bewertung.
 * Abzeichen (Badges) mit automatischer Prüfung.
 * Wöchentliche Rangliste mit Reset montags.
 *
 * Öffentliche API:
 *   getConfig / upsertConfig
 *   awardPoints
 *   processDeliveryEngagement        — Haupt-Hook nach Lieferung
 *   processDeliveryEngagementAllLocations
 *   checkAndAwardBadges
 *   getDriverEngagementProfile
 *   getLeaderboard
 *   computeWeeklyLeaderboard
 *   computeWeeklyLeaderboardAllLocations
 *   weeklyReset
 *   weeklyResetAllLocations
 *   getDashboard
 *   pruneOldPoints / pruneOldLeaderboard
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface EngagementConfig {
  id: string;
  locationId: string;
  isEnabled: boolean;
  pointsPerDelivery: number;
  pointsPerOnTime: number;
  pointsPerTopRating: number;
  weeklyResetDay: number;
  weeklyResetHourUtc: number;
}

export interface EngagementBadge {
  id: string;
  locationId: string;
  name: string;
  description: string;
  icon: string;
  minDeliveries: number | null;
  minWeeklyPoints: number | null;
  minStreak: number | null;
  minOnTimeRatePct: number | null;
  bonusPoints: number;
  isActive: boolean;
}

export interface EarnedBadge {
  id: string;
  badge: EngagementBadge;
  earnedAt: string;
}

export interface DriverEngagementProfile {
  driverId: string;
  driverName: string | null;
  locationId: string;
  totalPointsAllTime: number;
  weeklyPoints: number;
  deliveriesAllTime: number;
  onTimeRatePct: number | null;
  earnedBadges: EarnedBadge[];
  weeklyRank: number | null;
  currentStreak: number;
}

export interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string | null;
  weeklyPoints: number;
  deliveries: number;
  onTimeRate: number | null;
  badgesCount: number;
}

export interface EngagementDashboard {
  config: EngagementConfig;
  weekStart: string;
  topDriver: LeaderboardEntry | null;
  leaderboard: LeaderboardEntry[];
  totalDriversWithPoints: number;
  totalPointsAwarded: number;
  totalBadgesEarned: number;
  avgWeeklyPoints: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function currentWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diffToMon);
  return mon.toISOString().slice(0, 10);
}

function dbToConfig(row: Record<string, unknown>): EngagementConfig {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    isEnabled: row.is_enabled as boolean,
    pointsPerDelivery: row.points_per_delivery as number,
    pointsPerOnTime: row.points_per_on_time as number,
    pointsPerTopRating: row.points_per_top_rating as number,
    weeklyResetDay: row.weekly_reset_day as number,
    weeklyResetHourUtc: row.weekly_reset_hour_utc as number,
  };
}

function dbToBadge(row: Record<string, unknown>): EngagementBadge {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    name: row.name as string,
    description: row.description as string,
    icon: row.icon as string,
    minDeliveries: row.min_deliveries as number | null,
    minWeeklyPoints: row.min_weekly_points as number | null,
    minStreak: row.min_streak as number | null,
    minOnTimeRatePct: row.min_on_time_rate_pct !== null ? Number(row.min_on_time_rate_pct) : null,
    bonusPoints: row.bonus_points as number,
    isActive: row.is_active as boolean,
  };
}

const DEFAULT_CONFIG: Omit<EngagementConfig, 'id' | 'locationId'> = {
  isEnabled: true,
  pointsPerDelivery: 10,
  pointsPerOnTime: 5,
  pointsPerTopRating: 15,
  weeklyResetDay: 1,
  weeklyResetHourUtc: 4,
};

// ── Config ─────────────────────────────────────────────────────────────────────

export async function getConfig(locationId: string): Promise<EngagementConfig> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_engagement_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (!data) {
    return { id: '', locationId, ...DEFAULT_CONFIG };
  }
  return dbToConfig(data as Record<string, unknown>);
}

export async function upsertConfig(
  locationId: string,
  update: Partial<Omit<EngagementConfig, 'id' | 'locationId'>>,
): Promise<EngagementConfig> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('driver_engagement_config')
    .upsert({
      location_id: locationId,
      ...(update.isEnabled !== undefined && { is_enabled: update.isEnabled }),
      ...(update.pointsPerDelivery !== undefined && { points_per_delivery: update.pointsPerDelivery }),
      ...(update.pointsPerOnTime !== undefined && { points_per_on_time: update.pointsPerOnTime }),
      ...(update.pointsPerTopRating !== undefined && { points_per_top_rating: update.pointsPerTopRating }),
      ...(update.weeklyResetDay !== undefined && { weekly_reset_day: update.weeklyResetDay }),
      ...(update.weeklyResetHourUtc !== undefined && { weekly_reset_hour_utc: update.weeklyResetHourUtc }),
    }, { onConflict: 'location_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return dbToConfig(data as Record<string, unknown>);
}

// ── Punkte ─────────────────────────────────────────────────────────────────────

export async function awardPoints(
  locationId: string,
  driverId: string,
  points: number,
  reason: string,
  orderId?: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc.from('driver_engagement_points').insert({
    location_id: locationId,
    driver_id: driverId,
    points,
    reason,
    ...(orderId ? { order_id: orderId } : {}),
  });
}

export async function getDriverWeeklyPoints(
  locationId: string,
  driverId: string,
): Promise<number> {
  const weekStart = currentWeekStart();
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_engagement_points')
    .select('points')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('created_at', weekStart + 'T00:00:00Z')
    .neq('reason', 'weekly_reset');
  return (data ?? []).reduce((s, r) => s + (r.points as number), 0);
}

// ── Abzeichen ──────────────────────────────────────────────────────────────────

export async function checkAndAwardBadges(
  locationId: string,
  driverId: string,
  deliveriesCount: number,
  onTimeRatePct: number | null,
  weeklyPoints: number,
  currentStreak: number,
  bonusPointsCallback: (pts: number, badgeName: string) => Promise<void>,
): Promise<string[]> {
  const svc = createServiceClient();

  const { data: badges } = await svc
    .from('driver_engagement_badges')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true);

  const { data: earned } = await svc
    .from('driver_engagement_earned_badges')
    .select('badge_id')
    .eq('location_id', locationId)
    .eq('driver_id', driverId);

  const earnedIds = new Set((earned ?? []).map((e) => e.badge_id as string));
  const newBadges: string[] = [];

  for (const row of badges ?? []) {
    const badge = dbToBadge(row as Record<string, unknown>);
    if (earnedIds.has(badge.id)) continue;

    const meetsDeliveries = badge.minDeliveries === null || deliveriesCount >= badge.minDeliveries;
    const meetsWeeklyPoints = badge.minWeeklyPoints === null || weeklyPoints >= badge.minWeeklyPoints;
    const meetsStreak = badge.minStreak === null || currentStreak >= badge.minStreak;
    const meetsOnTime =
      badge.minOnTimeRatePct === null ||
      (onTimeRatePct !== null && onTimeRatePct >= badge.minOnTimeRatePct);

    if (meetsDeliveries && meetsWeeklyPoints && meetsStreak && meetsOnTime) {
      const { error } = await svc.from('driver_engagement_earned_badges').insert({
        location_id: locationId,
        driver_id: driverId,
        badge_id: badge.id,
      });
      if (!error) {
        newBadges.push(badge.name);
        if (badge.bonusPoints > 0) {
          await bonusPointsCallback(badge.bonusPoints, badge.name);
        }
      }
    }
  }
  return newBadges;
}

// ── Haupt-Hook: nach Lieferung ─────────────────────────────────────────────────

export async function processDeliveryEngagement(
  locationId: string,
  driverId: string,
  orderId: string,
  wasOnTime: boolean,
  rating?: number | null,
): Promise<{ pointsAwarded: number; newBadges: string[] }> {
  const config = await getConfig(locationId);
  if (!config.isEnabled) return { pointsAwarded: 0, newBadges: [] };

  let total = config.pointsPerDelivery;
  await awardPoints(locationId, driverId, config.pointsPerDelivery, 'delivery', orderId);

  if (wasOnTime) {
    await awardPoints(locationId, driverId, config.pointsPerOnTime, 'on_time', orderId);
    total += config.pointsPerOnTime;
  }

  if (rating !== null && rating !== undefined && rating >= 5) {
    await awardPoints(locationId, driverId, config.pointsPerTopRating, 'top_rating', orderId);
    total += config.pointsPerTopRating;
  }

  // Deliver stats for badge check
  const svc = createServiceClient();
  const { count: deliveriesCount } = await svc
    .from('driver_engagement_points')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .eq('reason', 'delivery');

  const weeklyPts = await getDriverWeeklyPoints(locationId, driverId);

  // on_time_rate from driver_streaks if available
  const { data: streakRow } = await svc
    .from('driver_streaks')
    .select('on_time_rate_pct, current_streak')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .maybeSingle();

  const onTimeRatePct = streakRow?.on_time_rate_pct !== undefined
    ? Number(streakRow.on_time_rate_pct)
    : null;
  const currentStreak = streakRow?.current_streak ?? 0;

  const newBadges = await checkAndAwardBadges(
    locationId,
    driverId,
    deliveriesCount ?? 0,
    onTimeRatePct,
    weeklyPts,
    currentStreak,
    async (pts, badgeName) => {
      await awardPoints(locationId, driverId, pts, `badge_bonus:${badgeName}`);
    },
  );

  return { pointsAwarded: total, newBadges };
}

export async function processDeliveryEngagementAllLocations(): Promise<{
  locations: number;
  processed: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc.from('locations').select('id');
  if (!locations) return { locations: 0, processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    locations.map(async (loc) => {
      // Find recently completed orders (last 10 min) without engagement points
      const { data: orders } = await svc
        .from('customer_orders')
        .select('id, fahrer_id, lieferstatus, fertig_am')
        .eq('location_id', loc.id)
        .eq('lieferstatus', 'geliefert')
        .eq('typ', 'lieferung')
        .gte('fertig_am', new Date(Date.now() - 12 * 60 * 1000).toISOString())
        .not('fahrer_id', 'is', null);

      if (!orders?.length) return;

      for (const order of orders) {
        // Check if already processed
        const { count } = await svc
          .from('driver_engagement_points')
          .select('id', { count: 'exact', head: true })
          .eq('location_id', loc.id)
          .eq('driver_id', order.fahrer_id as string)
          .eq('order_id', order.id)
          .eq('reason', 'delivery');
        if ((count ?? 0) > 0) continue;

        // was on time?
        const { data: orderFull } = await svc
          .from('customer_orders')
          .select('fertig_am, eta_earliest, bewertung_gesamt')
          .eq('id', order.id)
          .maybeSingle();

        const wasOnTime =
          orderFull?.fertig_am && orderFull?.eta_earliest
            ? new Date(orderFull.fertig_am) <= new Date(orderFull.eta_earliest)
            : false;

        await processDeliveryEngagement(
          loc.id as string,
          order.fahrer_id as string,
          order.id as string,
          wasOnTime,
          orderFull?.bewertung_gesamt as number | null,
        );
        processed++;
      }
    }),
  );

  for (const r of results) if (r.status === 'rejected') errors++;
  return { locations: locations.length, processed, errors };
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

export async function getLeaderboard(locationId: string, limit = 10): Promise<LeaderboardEntry[]> {
  const weekStart = currentWeekStart();
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_engagement_leaderboard')
    .select('*')
    .eq('location_id', locationId)
    .eq('week_start', weekStart)
    .order('rank', { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => ({
    rank: row.rank as number,
    driverId: row.driver_id as string,
    driverName: row.driver_name as string | null,
    weeklyPoints: row.total_points as number,
    deliveries: row.deliveries as number,
    onTimeRate: row.on_time_rate !== null ? Number(row.on_time_rate) : null,
    badgesCount: row.badges_count as number,
  }));
}

export async function computeWeeklyLeaderboard(locationId: string): Promise<{
  computed: number;
  weekStart: string;
}> {
  const weekStart = currentWeekStart();
  const svc = createServiceClient();

  // Aggregate points this week per driver
  const { data: pointRows } = await svc
    .from('driver_engagement_points')
    .select('driver_id, points')
    .eq('location_id', locationId)
    .gte('created_at', weekStart + 'T00:00:00Z')
    .neq('reason', 'weekly_reset');

  if (!pointRows?.length) return { computed: 0, weekStart };

  const driverPoints: Record<string, number> = {};
  for (const row of pointRows) {
    const id = row.driver_id as string;
    driverPoints[id] = (driverPoints[id] ?? 0) + (row.points as number);
  }

  // Delivery count this week per driver
  const { data: deliveryRows } = await svc
    .from('driver_engagement_points')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('reason', 'delivery')
    .gte('created_at', weekStart + 'T00:00:00Z');

  const driverDeliveries: Record<string, number> = {};
  for (const row of deliveryRows ?? []) {
    const id = row.driver_id as string;
    driverDeliveries[id] = (driverDeliveries[id] ?? 0) + 1;
  }

  // Badge count per driver
  const { data: badgeRows } = await svc
    .from('driver_engagement_earned_badges')
    .select('driver_id')
    .eq('location_id', locationId);
  const driverBadges: Record<string, number> = {};
  for (const row of badgeRows ?? []) {
    const id = row.driver_id as string;
    driverBadges[id] = (driverBadges[id] ?? 0) + 1;
  }

  // Driver names from employees
  const driverIds = Object.keys(driverPoints);
  const { data: empRows } = await svc
    .from('employees')
    .select('id, name')
    .in('id', driverIds);
  const nameMap: Record<string, string> = {};
  for (const e of empRows ?? []) nameMap[e.id as string] = e.name as string;

  // Sort by points descending
  const sorted = driverIds.sort((a, b) => (driverPoints[b] ?? 0) - (driverPoints[a] ?? 0));

  // Upsert leaderboard rows
  const upsertRows = sorted.map((driverId, idx) => ({
    location_id: locationId,
    week_start: weekStart,
    driver_id: driverId,
    driver_name: nameMap[driverId] ?? null,
    rank: idx + 1,
    total_points: driverPoints[driverId] ?? 0,
    deliveries: driverDeliveries[driverId] ?? 0,
    badges_count: driverBadges[driverId] ?? 0,
  }));

  // Chunk into 50-row batches
  for (let i = 0; i < upsertRows.length; i += 50) {
    await svc
      .from('driver_engagement_leaderboard')
      .upsert(upsertRows.slice(i, i + 50), { onConflict: 'location_id,week_start,driver_id' });
  }

  return { computed: sorted.length, weekStart };
}

export async function computeWeeklyLeaderboardAllLocations(): Promise<{
  locations: number;
  computed: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc.from('locations').select('id');
  if (!locations) return { locations: 0, computed: 0, errors: 0 };

  let computed = 0;
  let errors = 0;
  const results = await Promise.allSettled(
    locations.map((loc) => computeWeeklyLeaderboard(loc.id as string)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') computed += r.value.computed;
    else errors++;
  }
  return { locations: locations.length, computed, errors };
}

// ── Wochen-Reset ───────────────────────────────────────────────────────────────

export async function weeklyReset(locationId: string): Promise<{ resetDrivers: number }> {
  const svc = createServiceClient();

  // Get distinct drivers who have non-reset points this week
  const weekStart = currentWeekStart();
  const { data: drivers } = await svc
    .from('driver_engagement_points')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('created_at', weekStart + 'T00:00:00Z')
    .neq('reason', 'weekly_reset');

  const uniqueDrivers = [...new Set((drivers ?? []).map((d) => d.driver_id as string))];

  // Insert a negative reset marker per driver
  for (const driverId of uniqueDrivers) {
    const pts = await getDriverWeeklyPoints(locationId, driverId);
    if (pts > 0) {
      await svc.from('driver_engagement_points').insert({
        location_id: locationId,
        driver_id: driverId,
        points: -pts,
        reason: 'weekly_reset',
      });
    }
  }

  return { resetDrivers: uniqueDrivers.length };
}

export async function weeklyResetAllLocations(): Promise<{
  locations: number;
  resetDrivers: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc.from('locations').select('id');
  if (!locations) return { locations: 0, resetDrivers: 0, errors: 0 };

  let resetDrivers = 0;
  let errors = 0;
  const results = await Promise.allSettled(
    locations.map((loc) => weeklyReset(loc.id as string)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') resetDrivers += r.value.resetDrivers;
    else errors++;
  }
  return { locations: locations.length, resetDrivers, errors };
}

// ── Driver Profile ─────────────────────────────────────────────────────────────

export async function getDriverEngagementProfile(
  locationId: string,
  driverId: string,
): Promise<DriverEngagementProfile> {
  const svc = createServiceClient();
  const weekStart = currentWeekStart();

  const [allPointsRes, weeklyPointsRes, badgesRes, leaderboardRes, empRes, streakRes] =
    await Promise.all([
      svc.from('driver_engagement_points').select('points').eq('location_id', locationId).eq('driver_id', driverId).neq('reason', 'weekly_reset'),
      svc.from('driver_engagement_points').select('points').eq('location_id', locationId).eq('driver_id', driverId).gte('created_at', weekStart + 'T00:00:00Z').neq('reason', 'weekly_reset'),
      svc.from('driver_engagement_earned_badges').select('id, badge_id, earned_at').eq('location_id', locationId).eq('driver_id', driverId),
      svc.from('driver_engagement_leaderboard').select('rank').eq('location_id', locationId).eq('driver_id', driverId).eq('week_start', weekStart).maybeSingle(),
      svc.from('employees').select('name').eq('id', driverId).maybeSingle(),
      svc.from('driver_streaks').select('on_time_rate_pct, current_streak').eq('location_id', locationId).eq('driver_id', driverId).maybeSingle(),
    ]);

  const totalPointsAllTime = (allPointsRes.data ?? []).reduce((s, r) => s + (r.points as number), 0);
  const weeklyPoints = (weeklyPointsRes.data ?? []).reduce((s, r) => s + (r.points as number), 0);

  const deliveriesAllTime = (allPointsRes.data ?? []).filter((r) => false).length; // placeholder — count delivery reason
  const { count: deliveryCount } = await svc
    .from('driver_engagement_points')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .eq('reason', 'delivery');

  const badgeIds = (badgesRes.data ?? []).map((b) => b.badge_id as string);
  let earnedBadges: EarnedBadge[] = [];
  if (badgeIds.length > 0) {
    const { data: badgeDetails } = await svc
      .from('driver_engagement_badges')
      .select('*')
      .in('id', badgeIds);
    earnedBadges = (badgesRes.data ?? []).map((eb) => {
      const detail = (badgeDetails ?? []).find((b) => b.id === eb.badge_id);
      return {
        id: eb.id as string,
        badge: detail ? dbToBadge(detail as Record<string, unknown>) : {
          id: eb.badge_id as string, locationId, name: 'Unbekannt', description: '',
          icon: 'medal', minDeliveries: null, minWeeklyPoints: null, minStreak: null,
          minOnTimeRatePct: null, bonusPoints: 0, isActive: false,
        },
        earnedAt: eb.earned_at as string,
      };
    });
  }

  return {
    driverId,
    driverName: (empRes.data?.name as string | null) ?? null,
    locationId,
    totalPointsAllTime: Math.max(0, totalPointsAllTime),
    weeklyPoints: Math.max(0, weeklyPoints),
    deliveriesAllTime: deliveryCount ?? 0,
    onTimeRatePct: streakRes.data?.on_time_rate_pct !== undefined ? Number(streakRes.data.on_time_rate_pct) : null,
    earnedBadges,
    weeklyRank: leaderboardRes.data?.rank ?? null,
    currentStreak: streakRes.data?.current_streak ?? 0,
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<EngagementDashboard> {
  const svc = createServiceClient();
  const weekStart = currentWeekStart();

  const [config, leaderboard, totalPointsRes, totalBadgesRes, driversWithPointsRes] =
    await Promise.all([
      getConfig(locationId),
      getLeaderboard(locationId, 10),
      svc.from('driver_engagement_points').select('points').eq('location_id', locationId).gte('created_at', weekStart + 'T00:00:00Z').neq('reason', 'weekly_reset'),
      svc.from('driver_engagement_earned_badges').select('id', { count: 'exact', head: true }).eq('location_id', locationId),
      svc.from('driver_engagement_points').select('driver_id').eq('location_id', locationId).gte('created_at', weekStart + 'T00:00:00Z').neq('reason', 'weekly_reset'),
    ]);

  const totalPointsAwarded = (totalPointsRes.data ?? []).reduce((s, r) => s + Math.max(0, r.points as number), 0);
  const uniqueDriverIds = new Set((driversWithPointsRes.data ?? []).map((r) => r.driver_id as string));
  const totalDriversWithPoints = uniqueDriverIds.size;
  const avgWeeklyPoints = totalDriversWithPoints > 0 ? Math.round(totalPointsAwarded / totalDriversWithPoints) : 0;

  return {
    config,
    weekStart,
    topDriver: leaderboard[0] ?? null,
    leaderboard,
    totalDriversWithPoints,
    totalPointsAwarded,
    totalBadgesEarned: totalBadgesRes.count ?? 0,
    avgWeeklyPoints,
  };
}

// ── Prune ──────────────────────────────────────────────────────────────────────

export async function pruneOldPoints(daysToKeep = 90): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_driver_engagement_points', { days_old: daysToKeep });
  const rows = data as { pruned: number }[] | null;
  return { pruned: rows?.[0]?.pruned ?? 0 };
}

export async function pruneOldLeaderboard(weeksToKeep = 12): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_driver_engagement_leaderboard', { weeks_old: weeksToKeep });
  const rows = data as { pruned: number }[] | null;
  return { pruned: rows?.[0]?.pruned ?? 0 };
}
