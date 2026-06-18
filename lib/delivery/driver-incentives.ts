/**
 * lib/delivery/driver-incentives.ts — Phase 221
 *
 * Real-time Driver Incentive Engine
 *
 * Computes per-delivery incentives triggered by live conditions:
 *   - surge_multiplier:  extra % of liefergebuehr when surge pricing is active
 *   - quality_bonus:     flat EUR per delivery when location quality score ≥ threshold
 *   - shift_milestone:   bonus when driver reaches Nth delivery in current shift
 *   - rush_hour_flat:    flat EUR per delivery during configured peak hours
 *   - comeback_bonus:    flat EUR for first delivery after long offline absence
 *
 * Cron: evaluateIncentivesAllLocations() every 2-min tick (recent deliveries)
 *       approveIncentivesAllLocations()  daily 04:00 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getSurgeMultiplier } from '@/lib/delivery/surge';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type IncentiveType =
  | 'surge_multiplier'
  | 'quality_bonus'
  | 'shift_milestone'
  | 'rush_hour_flat'
  | 'comeback_bonus';

export type IncentiveStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface IncentiveConfig {
  id?: string;
  locationId: string;
  incentiveType: IncentiveType;
  label: string;
  isActive: boolean;
  // surge_multiplier
  extraPct: number;
  // quality_bonus
  qualityScoreMin: number;
  flatEur: number;
  // shift_milestone
  milestoneAt: number;
  milestoneBonusEur: number;
  // rush_hour_flat
  rushHourStart: number;
  rushHourEnd: number;
  // comeback_bonus
  minOfflineHours: number;
  comebackBonusEur: number;
}

export interface IncentiveEvent {
  id: string;
  locationId: string;
  driverId: string;
  orderId: string | null;
  incentiveType: IncentiveType;
  triggerLabel: string;
  baseValue: number;
  bonusEur: number;
  shiftDeliveryNr: number;
  status: IncentiveStatus;
  earnedAt: string;
  approvedAt: string | null;
}

export interface DriverIncentiveSummary {
  driverId: string;
  driverName: string | null;
  locationId: string;
  totalEurToday: number;
  pendingEur: number;
  confirmedEur: number;
  eventsToday: number;
  nextMilestoneAt: number | null;
  deliveriesToNextMilestone: number | null;
  recentEvents: IncentiveEvent[];
}

export interface IncentiveDashboard {
  totalPoolEurToday: number;
  approvedEurToday: number;
  pendingEurToday: number;
  activeDriversWithIncentives: number;
  totalEventsToday: number;
  topEarner: { driverName: string | null; bonusEur: number } | null;
  leaderboard: LeaderboardEntry[];
  recentEvents: IncentiveEvent[];
  configs: IncentiveConfig[];
}

export interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string | null;
  totalEurToday: number;
  confirmedEur: number;
  eventsToday: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Config CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function getConfigs(locationId: string): Promise<IncentiveConfig[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_incentive_configs')
    .select('*')
    .eq('location_id', locationId)
    .order('incentive_type');
  return (data ?? []).map(rowToConfig);
}

export async function upsertConfig(cfg: IncentiveConfig): Promise<IncentiveConfig> {
  const svc = createServiceClient();
  const row = {
    location_id:         cfg.locationId,
    incentive_type:      cfg.incentiveType,
    label:               cfg.label,
    is_active:           cfg.isActive,
    extra_pct:           cfg.extraPct,
    quality_score_min:   cfg.qualityScoreMin,
    flat_eur:            cfg.flatEur,
    milestone_at:        cfg.milestoneAt,
    milestone_bonus_eur: cfg.milestoneBonusEur,
    rush_hour_start:     cfg.rushHourStart,
    rush_hour_end:       cfg.rushHourEnd,
    min_offline_hours:   cfg.minOfflineHours,
    comeback_bonus_eur:  cfg.comebackBonusEur,
  };
  const { data, error } = await svc
    .from('driver_incentive_configs')
    .upsert(row, { onConflict: 'location_id,incentive_type' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToConfig(data);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core: evaluate incentives for a single recently-completed delivery
// ──────────────────────────────────────────────────────────────────────────────

export async function evaluateDeliveryIncentives(
  driverId: string,
  orderId: string,
  locationId: string,
): Promise<IncentiveEvent[]> {
  const svc = createServiceClient();

  // Load active configs + order details + driver context in parallel
  const [configsRes, orderRes, shiftRes, qualityRes] = await Promise.all([
    svc
      .from('driver_incentive_configs')
      .select('*')
      .eq('location_id', locationId)
      .eq('is_active', true),
    svc
      .from('customer_orders')
      .select('id, liefergebuehr, fertig_am, created_at')
      .eq('id', orderId)
      .maybeSingle(),
    // delivery count today for this driver (shift milestone)
    svc
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('mise_driver_id', driverId)
      .eq('status', 'geliefert')
      .gte('fertig_am', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    // today's quality score
    svc
      .from('delivery_quality_scores')
      .select('overall_score')
      .eq('location_id', locationId)
      .eq('score_date', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  const configs = configsRes.data ?? [];
  const order = orderRes.data;
  if (!order) return [];

  const shiftDeliveryNr = (shiftRes.count ?? 0);
  const qualityScore = qualityRes.data?.overall_score ? Number(qualityRes.data.overall_score) : null;
  const liefergebuehr = Number(order.liefergebuehr ?? 0);

  // Surge multiplier (async, independent)
  let surgeMultiplier = 1;
  try {
    surgeMultiplier = await getSurgeMultiplier(locationId);
  } catch {
    // non-fatal
  }

  const nowHour = new Date().getUTCHours();

  const earned: IncentiveEvent[] = [];

  for (const cfg of configs) {
    let bonusEur = 0;
    let triggerLabel = '';

    switch (cfg.incentive_type as IncentiveType) {
      case 'surge_multiplier': {
        if (surgeMultiplier <= 1) break;
        bonusEur = (liefergebuehr * Number(cfg.extra_pct)) / 100;
        if (bonusEur <= 0) break;
        triggerLabel = `Surge aktiv (${surgeMultiplier.toFixed(1)}×) +${cfg.extra_pct}% auf Liefergebühr`;
        break;
      }
      case 'quality_bonus': {
        if (qualityScore === null || qualityScore < Number(cfg.quality_score_min)) break;
        bonusEur = Number(cfg.flat_eur);
        if (bonusEur <= 0) break;
        triggerLabel = `Qualitäts-Bonus (Score ${qualityScore.toFixed(0)} ≥ ${cfg.quality_score_min})`;
        break;
      }
      case 'shift_milestone': {
        if (shiftDeliveryNr !== Number(cfg.milestone_at)) break;
        bonusEur = Number(cfg.milestone_bonus_eur);
        if (bonusEur <= 0) break;
        triggerLabel = `Meilenstein: ${cfg.milestone_at}. Lieferung in dieser Schicht`;
        break;
      }
      case 'rush_hour_flat': {
        const start = Number(cfg.rush_hour_start);
        const end = Number(cfg.rush_hour_end);
        const inRush = start <= end
          ? nowHour >= start && nowHour < end
          : nowHour >= start || nowHour < end; // overnight window
        if (!inRush) break;
        bonusEur = Number(cfg.flat_eur);
        if (bonusEur <= 0) break;
        triggerLabel = `Stoßzeit-Bonus (${start}–${end} Uhr UTC)`;
        break;
      }
      case 'comeback_bonus': {
        // First delivery after min_offline_hours absence
        const minOfflineMs = Number(cfg.min_offline_hours) * 3_600_000;
        const { data: prev } = await svc
          .from('customer_orders')
          .select('fertig_am')
          .eq('mise_driver_id', driverId)
          .eq('status', 'geliefert')
          .neq('id', orderId)
          .order('fertig_am', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!prev) break; // no prior delivery → not a comeback scenario
        const gapMs = new Date(order.fertig_am ?? order.created_at).getTime()
                    - new Date(prev.fertig_am).getTime();
        if (gapMs < minOfflineMs) break;
        bonusEur = Number(cfg.comeback_bonus_eur);
        if (bonusEur <= 0) break;
        const gapH = Math.round(gapMs / 3_600_000);
        triggerLabel = `Comeback-Bonus (${gapH}h Pause)`;
        break;
      }
    }

    if (bonusEur > 0) {
      const { data: inserted } = await svc
        .from('driver_incentive_events')
        .insert({
          location_id:       locationId,
          driver_id:         driverId,
          order_id:          orderId,
          incentive_type:    cfg.incentive_type,
          trigger_label:     triggerLabel,
          base_value:        liefergebuehr,
          bonus_eur:         Math.round(bonusEur * 100) / 100,
          shift_delivery_nr: shiftDeliveryNr,
          status:            'pending',
        })
        .select()
        .maybeSingle();
      if (inserted) earned.push(rowToEvent(inserted));
    }
  }

  return earned;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cron: evaluate incentives for recent deliveries (last 5 min)
// ──────────────────────────────────────────────────────────────────────────────

export async function evaluateIncentivesForLocation(
  locationId: string,
): Promise<{ evaluated: number; earned: number; errors: number }> {
  const svc = createServiceClient();

  // Recent deliveries without incentives evaluated yet
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: recentOrders } = await svc
    .from('customer_orders')
    .select('id, mise_driver_id, fertig_am')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .gte('fertig_am', since)
    .not('mise_driver_id', 'is', null);

  if (!recentOrders?.length) return { evaluated: 0, earned: 0, errors: 0 };

  let evaluated = 0;
  let earned = 0;
  let errors = 0;

  for (const order of recentOrders) {
    if (!order.mise_driver_id) continue;
    try {
      const events = await evaluateDeliveryIncentives(
        order.mise_driver_id,
        order.id,
        locationId,
      );
      evaluated++;
      earned += events.length;
    } catch {
      errors++;
    }
  }

  return { evaluated, earned, errors };
}

export async function evaluateIncentivesAllLocations(): Promise<{
  locations: number;
  evaluated: number;
  earned: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, evaluated: 0, earned: 0, errors: 0 };

  const results = await Promise.all(
    locations.map(l => evaluateIncentivesForLocation(l.id).catch(() => ({ evaluated: 0, earned: 0, errors: 1 }))),
  );

  return {
    locations: locations.length,
    evaluated: results.reduce((s, r) => s + r.evaluated, 0),
    earned:    results.reduce((s, r) => s + r.earned,    0),
    errors:    results.reduce((s, r) => s + r.errors,    0),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Cron: approve pending incentives (daily, after min grace period)
// ──────────────────────────────────────────────────────────────────────────────

export async function approvePendingIncentives(locationId?: string): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('approve_pending_incentives', {
    p_location_id: locationId ?? null,
  });
  return (data as number) ?? 0;
}

export async function approveIncentivesAllLocations(): Promise<number> {
  return approvePendingIncentives(undefined);
}

// ──────────────────────────────────────────────────────────────────────────────
// Driver-facing: summary for today
// ──────────────────────────────────────────────────────────────────────────────

export async function getDriverIncentiveSummary(
  driverId: string,
  locationId: string,
): Promise<DriverIncentiveSummary> {
  const svc = createServiceClient();

  const today = new Date().setHours(0, 0, 0, 0);

  const [summaryRes, eventsRes, configsRes] = await Promise.all([
    svc
      .from('v_driver_incentive_today')
      .select('*')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .maybeSingle(),
    svc
      .from('driver_incentive_events')
      .select('*')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('earned_at', new Date(today).toISOString())
      .order('earned_at', { ascending: false })
      .limit(10),
    svc
      .from('driver_incentive_configs')
      .select('milestone_at, is_active, incentive_type')
      .eq('location_id', locationId)
      .eq('incentive_type', 'shift_milestone')
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const s = summaryRes.data;
  const events = (eventsRes.data ?? []).map(rowToEvent);
  const milestoneCfg = configsRes.data;

  // Shift delivery count for milestone progress
  const { count: shiftCount } = await svc
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('mise_driver_id', driverId)
    .eq('status', 'geliefert')
    .gte('fertig_am', new Date(today).toISOString());

  const milestoneAt = milestoneCfg?.milestone_at ?? null;
  const deliveriesToMilestone = milestoneAt ? Math.max(0, milestoneAt - (shiftCount ?? 0)) : null;

  return {
    driverId,
    driverName: s?.driver_name ?? null,
    locationId,
    totalEurToday: Number(s?.total_eur_today ?? 0),
    pendingEur:    Number(s?.pending_eur ?? 0),
    confirmedEur:  Number(s?.confirmed_eur ?? 0),
    eventsToday:   Number(s?.events_today ?? 0),
    nextMilestoneAt: milestoneAt,
    deliveriesToNextMilestone: deliveriesToMilestone,
    recentEvents: events,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin dashboard
// ──────────────────────────────────────────────────────────────────────────────

export async function getIncentiveDashboard(locationId: string): Promise<IncentiveDashboard> {
  const svc = createServiceClient();
  const todayIso = new Date().setHours(0, 0, 0, 0);
  const todayStr = new Date(todayIso).toISOString();

  const [poolRes, leaderboardRes, recentRes, configsRes] = await Promise.all([
    svc
      .from('driver_incentive_events')
      .select('bonus_eur, status')
      .eq('location_id', locationId)
      .gte('earned_at', todayStr),
    svc
      .from('v_driver_incentive_leaderboard')
      .select('*')
      .eq('location_id', locationId)
      .order('rank')
      .limit(10),
    svc
      .from('driver_incentive_events')
      .select('*')
      .eq('location_id', locationId)
      .gte('earned_at', todayStr)
      .order('earned_at', { ascending: false })
      .limit(20),
    svc
      .from('driver_incentive_configs')
      .select('*')
      .eq('location_id', locationId)
      .order('incentive_type'),
  ]);

  const poolRows = poolRes.data ?? [];
  const totalPoolEurToday   = poolRows.reduce((s, r) => s + Number(r.bonus_eur), 0);
  const approvedEurToday    = poolRows.filter(r => r.status !== 'pending' && r.status !== 'cancelled').reduce((s, r) => s + Number(r.bonus_eur), 0);
  const pendingEurToday     = poolRows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.bonus_eur), 0);
  const totalEventsToday    = poolRows.length;

  const leaderboard = (leaderboardRes.data ?? []).map((r) => ({
    rank:          Number(r.rank),
    driverId:      r.driver_id as string,
    driverName:    r.driver_name as string | null,
    totalEurToday: Number(r.total_eur_today),
    confirmedEur:  Number(r.confirmed_eur),
    eventsToday:   Number(r.events_today),
  }));

  const topEarner = leaderboard[0]
    ? { driverName: leaderboard[0].driverName, bonusEur: leaderboard[0].totalEurToday }
    : null;

  const uniqueDrivers = new Set(poolRows.map(() => '')).size; // placeholder
  const activeDriversWithIncentives = leaderboard.length;

  return {
    totalPoolEurToday,
    approvedEurToday,
    pendingEurToday,
    activeDriversWithIncentives,
    totalEventsToday,
    topEarner,
    leaderboard,
    recentEvents: (recentRes.data ?? []).map(rowToEvent),
    configs: (configsRes.data ?? []).map(rowToConfig),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Prune
// ──────────────────────────────────────────────────────────────────────────────

export async function pruneOldIncentiveEvents(keepDays = 90): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_incentive_events', { keep_days: keepDays });
  return (data as number) ?? 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Row mappers
// ──────────────────────────────────────────────────────────────────────────────

function rowToConfig(r: Record<string, unknown>): IncentiveConfig {
  return {
    id:                r.id              as string,
    locationId:        r.location_id     as string,
    incentiveType:     r.incentive_type  as IncentiveType,
    label:             r.label           as string,
    isActive:          r.is_active       as boolean,
    extraPct:          Number(r.extra_pct),
    qualityScoreMin:   Number(r.quality_score_min),
    flatEur:           Number(r.flat_eur),
    milestoneAt:       Number(r.milestone_at),
    milestoneBonusEur: Number(r.milestone_bonus_eur),
    rushHourStart:     Number(r.rush_hour_start),
    rushHourEnd:       Number(r.rush_hour_end),
    minOfflineHours:   Number(r.min_offline_hours),
    comebackBonusEur:  Number(r.comeback_bonus_eur),
  };
}

function rowToEvent(r: Record<string, unknown>): IncentiveEvent {
  return {
    id:               r.id              as string,
    locationId:       r.location_id     as string,
    driverId:         r.driver_id       as string,
    orderId:          r.order_id        as string | null,
    incentiveType:    r.incentive_type  as IncentiveType,
    triggerLabel:     r.trigger_label   as string,
    baseValue:        Number(r.base_value),
    bonusEur:         Number(r.bonus_eur),
    shiftDeliveryNr:  Number(r.shift_delivery_nr),
    status:           r.status          as IncentiveStatus,
    earnedAt:         r.earned_at       as string,
    approvedAt:       r.approved_at     as string | null,
  };
}
