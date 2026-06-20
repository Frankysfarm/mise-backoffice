/**
 * lib/delivery/driver-incentive-v2.ts — Phase 336
 *
 * Driver Incentive Engine V2
 *
 * Echtzeit-Bonuspunkte für Fahrer:
 *   - base_delivery:   Basispunkte je Lieferung
 *   - peak_hour:       Multiplikator während Stoßzeiten (11-13, 18-20 Uhr)
 *   - loyalty_streak:  Treue-Multiplikator nach N konsekutiven Schichten
 *   - on_time_bonus:   Extrapunkte für pünktliche Lieferungen
 *
 * Cron: evaluateRecentDeliveriesAllLocations() jeden 2-Min-Tick
 *       approvePointsAllLocations()            täglich 04:30 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type PointReason = 'base_delivery' | 'peak_hour' | 'loyalty_streak' | 'on_time_bonus';
export type PointStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface IncentiveV2Config {
  locationId: string;
  enabled: boolean;
  basePointsPerDelivery: number;
  peakHours: number[];
  peakMultiplier: number;
  loyaltyMinShifts: number;
  loyaltyMultiplier: number;
  pointsToEurRate: number;
  minPayoutPoints: number;
  autoApprove: boolean;
}

export interface LoyaltyStreak {
  driverId: string;
  locationId: string;
  currentStreak: number;
  longestStreak: number;
  lastShiftDate: string | null;
}

export interface PointEvent {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  orderId: string | null;
  reason: PointReason;
  basePoints: number;
  multiplier: number;
  totalPoints: number;
  eurEquivalent: number;
  peakHour: boolean;
  streakApplied: boolean;
  status: PointStatus;
  earnedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface DriverPointsSummary {
  driverId: string;
  driverName: string | null;
  totalPointsAllTime: number;
  totalPointsThisWeek: number;
  pendingPoints: number;
  approvedPoints: number;
  paidEur: number;
  pendingEur: number;
  currentStreak: number;
  longestStreak: number;
  eventsToday: number;
  nextLoyaltyAt: number | null;
  shiftsToNextLoyalty: number | null;
}

export interface IncentiveV2Dashboard {
  config: IncentiveV2Config;
  totalPointsToday: number;
  totalEurPending: number;
  totalEurPaid: number;
  driversWithPoints: number;
  peakHourEventsToday: number;
  loyaltyEventsToday: number;
  leaderboard: Array<{
    driverId: string;
    driverName: string | null;
    pointsToday: number;
    eurEquivalent: number;
    currentStreak: number;
    isPeakActive: boolean;
  }>;
  recentEvents: PointEvent[];
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<IncentiveV2Config, 'locationId'> = {
  enabled: true,
  basePointsPerDelivery: 10,
  peakHours: [11, 12, 13, 18, 19, 20],
  peakMultiplier: 2.0,
  loyaltyMinShifts: 3,
  loyaltyMultiplier: 1.5,
  pointsToEurRate: 0.01,
  minPayoutPoints: 500,
  autoApprove: false,
};

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(locationId: string): Promise<IncentiveV2Config> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_incentive_v2_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_CONFIG, locationId };
  return {
    locationId,
    enabled: data.enabled ?? true,
    basePointsPerDelivery: data.base_points_per_delivery ?? DEFAULT_CONFIG.basePointsPerDelivery,
    peakHours: (data.peak_hours as number[] | null) ?? DEFAULT_CONFIG.peakHours,
    peakMultiplier: Number(data.peak_multiplier ?? DEFAULT_CONFIG.peakMultiplier),
    loyaltyMinShifts: data.loyalty_min_shifts ?? DEFAULT_CONFIG.loyaltyMinShifts,
    loyaltyMultiplier: Number(data.loyalty_multiplier ?? DEFAULT_CONFIG.loyaltyMultiplier),
    pointsToEurRate: Number(data.points_to_eur_rate ?? DEFAULT_CONFIG.pointsToEurRate),
    minPayoutPoints: data.min_payout_points ?? DEFAULT_CONFIG.minPayoutPoints,
    autoApprove: data.auto_approve ?? DEFAULT_CONFIG.autoApprove,
  };
}

export async function updateConfig(
  locationId: string,
  input: Partial<Omit<IncentiveV2Config, 'locationId'>>,
): Promise<IncentiveV2Config> {
  const svc = createServiceClient();
  const row: Record<string, unknown> = { location_id: locationId };
  if (input.enabled !== undefined)              row.enabled = input.enabled;
  if (input.basePointsPerDelivery !== undefined) row.base_points_per_delivery = input.basePointsPerDelivery;
  if (input.peakHours !== undefined)             row.peak_hours = input.peakHours;
  if (input.peakMultiplier !== undefined)        row.peak_multiplier = input.peakMultiplier;
  if (input.loyaltyMinShifts !== undefined)      row.loyalty_min_shifts = input.loyaltyMinShifts;
  if (input.loyaltyMultiplier !== undefined)     row.loyalty_multiplier = input.loyaltyMultiplier;
  if (input.pointsToEurRate !== undefined)       row.points_to_eur_rate = input.pointsToEurRate;
  if (input.minPayoutPoints !== undefined)       row.min_payout_points = input.minPayoutPoints;
  if (input.autoApprove !== undefined)           row.auto_approve = input.autoApprove;

  await svc.from('driver_incentive_v2_config').upsert(row, { onConflict: 'location_id' });
  return getConfig(locationId);
}

// ── Streak-Verwaltung ─────────────────────────────────────────────────────────

export async function getLoyaltyStreak(
  driverId: string,
  locationId: string,
): Promise<LoyaltyStreak> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_loyalty_streaks')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { driverId, locationId, currentStreak: 0, longestStreak: 0, lastShiftDate: null };
  return {
    driverId,
    locationId,
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    lastShiftDate: data.last_shift_date ?? null,
  };
}

export async function updateLoyaltyStreak(
  driverId: string,
  locationId: string,
  shiftDate: string,
): Promise<LoyaltyStreak> {
  const svc = createServiceClient();
  const current = await getLoyaltyStreak(driverId, locationId);

  const lastDate = current.lastShiftDate ? new Date(current.lastShiftDate) : null;
  const newDate = new Date(shiftDate);

  let newStreak = current.currentStreak;

  if (!lastDate) {
    newStreak = 1;
  } else {
    const diffDays = Math.floor(
      (newDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 2) {
      // Konsekutiv (bis zu 1 Tag Pause erlaubt — z.B. Mo/Mi)
      newStreak = current.currentStreak + 1;
    } else {
      // Streak gebrochen
      newStreak = 1;
    }
  }

  const newLongest = Math.max(newStreak, current.longestStreak);

  await svc.from('driver_loyalty_streaks').upsert(
    {
      location_id: locationId,
      driver_id: driverId,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_shift_date: shiftDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'location_id,driver_id' },
  );

  return { driverId, locationId, currentStreak: newStreak, longestStreak: newLongest, lastShiftDate: shiftDate };
}

// ── Punkte vergeben ───────────────────────────────────────────────────────────

export async function awardPointsForDelivery(
  driverId: string,
  locationId: string,
  orderId: string,
  deliveredAt: Date,
  wasOnTime: boolean,
): Promise<PointEvent | null> {
  const svc = createServiceClient();

  // Doppel-Award verhindern: wurde diese Order bereits belohnt?
  const { data: existing } = await svc
    .from('driver_incentive_v2_points')
    .select('id')
    .eq('order_id', orderId)
    .eq('driver_id', driverId)
    .not('reason', 'eq', 'on_time_bonus')
    .maybeSingle();

  if (existing) return null;

  const cfg = await getConfig(locationId);
  if (!cfg.enabled) return null;

  const deliveryHour = deliveredAt.getHours();
  const isPeak = cfg.peakHours.includes(deliveryHour);

  const streak = await getLoyaltyStreak(driverId, locationId);
  const streakApplied = streak.currentStreak >= cfg.loyaltyMinShifts;

  let multiplier = 1.0;
  if (isPeak) multiplier *= cfg.peakMultiplier;
  if (streakApplied) multiplier *= cfg.loyaltyMultiplier;

  const basePoints = cfg.basePointsPerDelivery;
  const totalPoints = Math.round(basePoints * multiplier);
  const eurEquivalent = totalPoints * cfg.pointsToEurRate;

  const reason: PointReason = isPeak ? 'peak_hour' : streakApplied ? 'loyalty_streak' : 'base_delivery';
  const status: PointStatus = cfg.autoApprove ? 'approved' : 'pending';

  const { data: inserted, error } = await svc
    .from('driver_incentive_v2_points')
    .insert({
      location_id: locationId,
      driver_id: driverId,
      order_id: orderId,
      reason,
      base_points: basePoints,
      multiplier,
      total_points: totalPoints,
      eur_equivalent: eurEquivalent,
      peak_hour: isPeak,
      streak_applied: streakApplied,
      status,
      earned_at: deliveredAt.toISOString(),
      approved_at: cfg.autoApprove ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (error || !inserted) return null;

  // Pünktlichkeits-Bonus separat (10% extra Punkte)
  if (wasOnTime) {
    const onTimePoints = Math.round(basePoints * 0.1);
    await svc.from('driver_incentive_v2_points').insert({
      location_id: locationId,
      driver_id: driverId,
      order_id: orderId,
      reason: 'on_time_bonus',
      base_points: onTimePoints,
      multiplier: 1.0,
      total_points: onTimePoints,
      eur_equivalent: onTimePoints * cfg.pointsToEurRate,
      peak_hour: false,
      streak_applied: false,
      status,
      earned_at: deliveredAt.toISOString(),
      approved_at: cfg.autoApprove ? new Date().toISOString() : null,
    });
  }

  return rowToEvent(inserted, null);
}

// ── Cron: Letzte Lieferungen scannen ──────────────────────────────────────────

export async function evaluateRecentDeliveries(locationId: string): Promise<{
  processed: number;
  awarded: number;
}> {
  const svc = createServiceClient();

  // Letzte 5 Minuten abgeschlossene Lieferungen
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: orders } = await svc
    .from('customer_orders')
    .select('id, assigned_driver_id, geliefert_am, eta_latest, typ')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['abgeschlossen', 'geliefert'])
    .not('geliefert_am', 'is', null)
    .not('assigned_driver_id', 'is', null)
    .gte('geliefert_am', since);

  if (!orders?.length) return { processed: 0, awarded: 0 };

  let awarded = 0;
  for (const order of orders) {
    const deliveredAt = new Date(order.geliefert_am as string);
    const wasOnTime = order.eta_latest
      ? deliveredAt <= new Date(order.eta_latest as string)
      : false;

    const result = await awardPointsForDelivery(
      order.assigned_driver_id as string,
      locationId,
      order.id,
      deliveredAt,
      wasOnTime,
    );
    if (result) awarded++;
  }

  return { processed: orders.length, awarded };
}

export async function evaluateRecentDeliveriesAllLocations(): Promise<{
  locations: number;
  totalAwarded: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('driver_incentive_v2_config')
    .select('location_id')
    .eq('enabled', true);

  if (!locations?.length) return { locations: 0, totalAwarded: 0 };

  let totalAwarded = 0;
  await Promise.all(
    locations.map(async (row) => {
      const res = await evaluateRecentDeliveries(row.location_id as string);
      totalAwarded += res.awarded;
    }),
  );
  return { locations: locations.length, totalAwarded };
}

// ── Auto-Genehmigung ──────────────────────────────────────────────────────────

export async function approvePointsAllLocations(): Promise<{ approved: number }> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_incentive_v2_points')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('earned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select('id');
  return { approved: data?.length ?? 0 };
}

// ── Fahrer-Zusammenfassung (Driver-App) ───────────────────────────────────────

export async function getDriverPointsSummary(
  driverId: string,
  locationId: string,
): Promise<DriverPointsSummary> {
  const svc = createServiceClient();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: allPoints }, streakData, cfg] = await Promise.all([
    svc
      .from('driver_incentive_v2_points')
      .select('total_points, eur_equivalent, status, earned_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId),
    getLoyaltyStreak(driverId, locationId),
    getConfig(locationId),
  ]);

  const points = allPoints ?? [];
  const weekPoints = points.filter((p) => new Date(p.earned_at as string) >= weekStart);
  const todayPoints = points.filter((p) => new Date(p.earned_at as string) >= todayStart);

  const totalPointsAllTime = points.reduce((s, p) => s + (p.total_points as number), 0);
  const totalPointsThisWeek = weekPoints.reduce((s, p) => s + (p.total_points as number), 0);
  const pendingPoints = points.filter((p) => p.status === 'pending').reduce((s, p) => s + (p.total_points as number), 0);
  const approvedPoints = points.filter((p) => p.status === 'approved').reduce((s, p) => s + (p.total_points as number), 0);
  const paidEur = points.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.eur_equivalent), 0);
  const pendingEur = points.filter((p) => p.status !== 'paid' && p.status !== 'cancelled').reduce((s, p) => s + Number(p.eur_equivalent), 0);

  const shiftsToNextLoyalty =
    streakData.currentStreak < cfg.loyaltyMinShifts
      ? cfg.loyaltyMinShifts - streakData.currentStreak
      : null;

  return {
    driverId,
    driverName: null,
    totalPointsAllTime,
    totalPointsThisWeek,
    pendingPoints,
    approvedPoints,
    paidEur,
    pendingEur,
    currentStreak: streakData.currentStreak,
    longestStreak: streakData.longestStreak,
    eventsToday: todayPoints.length,
    nextLoyaltyAt: cfg.loyaltyMinShifts,
    shiftsToNextLoyalty,
  };
}

// ── Admin-Dashboard ───────────────────────────────────────────────────────────

export async function getIncentiveV2Dashboard(
  locationId: string,
): Promise<IncentiveV2Dashboard> {
  const svc = createServiceClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [cfg, { data: todayEventsRaw }, { data: allPendingRaw }, { data: allPaidRaw }, { data: streaksRaw }] =
    await Promise.all([
      getConfig(locationId),
      svc
        .from('driver_incentive_v2_points')
        .select('driver_id, total_points, eur_equivalent, reason, peak_hour, streak_applied, status, earned_at, order_id')
        .eq('location_id', locationId)
        .gte('earned_at', todayStart.toISOString()),
      svc
        .from('driver_incentive_v2_points')
        .select('eur_equivalent')
        .eq('location_id', locationId)
        .in('status', ['pending', 'approved']),
      svc
        .from('driver_incentive_v2_points')
        .select('eur_equivalent')
        .eq('location_id', locationId)
        .eq('status', 'paid'),
      svc
        .from('driver_loyalty_streaks')
        .select('driver_id, current_streak')
        .eq('location_id', locationId),
    ]);

  const todayEvents = todayEventsRaw ?? [];
  const streakMap = new Map<string, number>(
    (streaksRaw ?? []).map((s) => [s.driver_id as string, s.current_streak as number]),
  );

  const totalPointsToday = todayEvents.reduce((s, e) => s + (e.total_points as number), 0);
  const totalEurPending = (allPendingRaw ?? []).reduce((s, e) => s + Number(e.eur_equivalent), 0);
  const totalEurPaid = (allPaidRaw ?? []).reduce((s, e) => s + Number(e.eur_equivalent), 0);
  const peakHourEventsToday = todayEvents.filter((e) => e.peak_hour).length;
  const loyaltyEventsToday = todayEvents.filter((e) => e.streak_applied).length;

  // Leaderboard: Punkte-Summe je Fahrer heute
  const lbMap = new Map<string, { points: number; eur: number }>();
  for (const e of todayEvents) {
    const dId = e.driver_id as string;
    const cur = lbMap.get(dId) ?? { points: 0, eur: 0 };
    cur.points += e.total_points as number;
    cur.eur += Number(e.eur_equivalent);
    lbMap.set(dId, cur);
  }

  // Fahrernamen laden
  const driverIds = [...lbMap.keys()];
  const driverNames = new Map<string, string | null>();
  if (driverIds.length > 0) {
    const { data: drivers } = await svc
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    for (const d of drivers ?? []) {
      driverNames.set(d.id as string, (d.name as string | null) ?? null);
    }
  }

  const now = new Date();
  const currentHour = now.getHours();

  const leaderboard = [...lbMap.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10)
    .map(([dId, { points, eur }]) => ({
      driverId: dId,
      driverName: driverNames.get(dId) ?? null,
      pointsToday: points,
      eurEquivalent: eur,
      currentStreak: streakMap.get(dId) ?? 0,
      isPeakActive: cfg.peakHours.includes(currentHour),
    }));

  const recentEvents = todayEvents
    .sort((a, b) => new Date(b.earned_at as string).getTime() - new Date(a.earned_at as string).getTime())
    .slice(0, 20)
    .map((e) => rowToEvent(e, driverNames.get(e.driver_id as string) ?? null));

  return {
    config: cfg,
    totalPointsToday,
    totalEurPending: Math.round(totalEurPending * 100) / 100,
    totalEurPaid: Math.round(totalEurPaid * 100) / 100,
    driversWithPoints: lbMap.size,
    peakHourEventsToday,
    loyaltyEventsToday,
    leaderboard,
    recentEvents,
  };
}

// ── Auszahlung genehmigen ─────────────────────────────────────────────────────

export async function approveDriverPoints(
  driverId: string,
  locationId: string,
): Promise<{ approved: number; eurTotal: number }> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_incentive_v2_points')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .select('eur_equivalent');
  const eurTotal = (data ?? []).reduce((s, r) => s + Number(r.eur_equivalent), 0);
  return { approved: data?.length ?? 0, eurTotal };
}

export async function markDriverPointsPaid(
  driverId: string,
  locationId: string,
): Promise<{ paid: number; eurTotal: number }> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_incentive_v2_points')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('status', 'approved')
    .select('eur_equivalent');
  const eurTotal = (data ?? []).reduce((s, r) => s + Number(r.eur_equivalent), 0);
  return { paid: data?.length ?? 0, eurTotal };
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function rowToEvent(
  row: Record<string, unknown>,
  driverName: string | null,
): PointEvent {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    driverId: row.driver_id as string,
    driverName,
    orderId: (row.order_id as string | null) ?? null,
    reason: row.reason as PointReason,
    basePoints: row.base_points as number,
    multiplier: Number(row.multiplier),
    totalPoints: row.total_points as number,
    eurEquivalent: Number(row.eur_equivalent),
    peakHour: row.peak_hour as boolean,
    streakApplied: row.streak_applied as boolean,
    status: row.status as PointStatus,
    earnedAt: row.earned_at as string,
    approvedAt: (row.approved_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  };
}
