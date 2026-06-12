/**
 * lib/delivery/challenges.ts
 *
 * Driver Incentive Challenge Engine — Phase 97
 *
 * Admins erstellen zeitbegrenzte Challenges (z.B. "8 Lieferungen heute → €10 Bonus").
 * Fortschritt wird per Cron alle 5 Min neu berechnet. Fahrer sehen ihre aktiven
 * Challenges + Fortschrittsbalken in der Fahrer-App.
 *
 * Challenge-Typen:
 *   deliveries_count — X Lieferungen abschließen
 *   on_time_rate     — X% Pünktlichkeitsrate erreichen
 *   avg_rating       — Ø X Sterne in der Challenge-Periode
 *   revenue_total    — Bestellwert ≥ €X liefern
 *
 * Funktionen:
 *   listChallenges()                      — Admin-Liste (mit Status-Filter)
 *   getChallenge()                        — Detail + Leaderboard
 *   createChallenge()                     — Neue Challenge anlegen + Fahrer einschreiben
 *   deleteChallenge()                     — Challenge stornieren
 *   updateProgressForDriver()             — Einzelnen Fahrer-Fortschritt neu berechnen
 *   checkAndAwardChallenges()             — Cron-Helfer: Status-Übergänge + Fortschritt
 *   checkAndAwardChallengesAllLocations() — Cron-Batch über alle Locations
 *   getDriverActiveChallenges()           — Fahrer-App: aktive Challenges mit Fortschritt
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export type ChallengeType =
  | 'deliveries_count'
  | 'on_time_rate'
  | 'avg_rating'
  | 'revenue_total';

export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface DriverChallenge {
  id: string;
  locationId: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  targetValue: number;
  rewardEur: number;
  rewardNote: string | null;
  startsAt: string;
  endsAt: string;
  status: ChallengeStatus;
  maxWinners: number | null;
  winnerCount: number;
  createdAt: string;
}

export interface ChallengeParticipation {
  id: string;
  challengeId: string;
  driverId: string;
  driverName: string;
  currentValue: number;
  progressPct: number;
  completed: boolean;
  completedAt: string | null;
  rewardPaid: boolean;
  rank: number;
}

export interface CreateChallengeInput {
  locationId: string;
  title: string;
  description?: string;
  challengeType: ChallengeType;
  targetValue: number;
  rewardEur: number;
  rewardNote?: string;
  startsAt: string;
  endsAt: string;
  maxWinners?: number;
  createdBy?: string;
}

export interface ChallengeDetail {
  challenge: DriverChallenge;
  participations: ChallengeParticipation[];
}

export interface CheckResult {
  checked: number;
  progressUpdated: number;
  autoCompleted: number;
  autoActivated: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────────────────────

function mapChallenge(row: Record<string, unknown>): DriverChallenge {
  return {
    id:            row.id            as string,
    locationId:    row.location_id   as string,
    title:         row.title         as string,
    description:   row.description   as string | null,
    challengeType: row.challenge_type as ChallengeType,
    targetValue:   Number(row.target_value),
    rewardEur:     Number(row.reward_eur),
    rewardNote:    row.reward_note   as string | null,
    startsAt:      row.starts_at     as string,
    endsAt:        row.ends_at       as string,
    status:        row.status        as ChallengeStatus,
    maxWinners:    row.max_winners != null ? Number(row.max_winners) : null,
    winnerCount:   Number(row.winner_count ?? 0),
    createdAt:     row.created_at    as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// listChallenges
// ─────────────────────────────────────────────────────────────────────────────

export async function listChallenges(
  locationId: string,
  status?: ChallengeStatus,
): Promise<DriverChallenge[]> {
  const sb = createServiceClient();
  let q = sb
    .from('driver_challenges')
    .select('id, location_id, title, description, challenge_type, target_value, reward_eur, reward_note, starts_at, ends_at, status, max_winners, winner_count, created_at')
    .eq('location_id', locationId)
    .order('starts_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapChallenge(r as Record<string, unknown>));
}

// ─────────────────────────────────────────────────────────────────────────────
// getChallenge — Detail + Leaderboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getChallenge(
  id: string,
  locationId: string,
): Promise<ChallengeDetail | null> {
  const sb = createServiceClient();

  const [challengeRes, lbRes] = await Promise.all([
    sb.from('driver_challenges')
      .select('id, location_id, title, description, challenge_type, target_value, reward_eur, reward_note, starts_at, ends_at, status, max_winners, winner_count, created_at')
      .eq('id', id)
      .eq('location_id', locationId)
      .maybeSingle(),
    sb.from('v_challenge_leaderboard')
      .select('id, challenge_id, driver_id, location_id, current_value, completed, completed_at, reward_paid, progress_pct, rank')
      .eq('challenge_id', id)
      .order('rank', { ascending: true })
      .limit(50),
  ]);

  if (!challengeRes.data) return null;

  // Enrich driver names
  const rows = lbRes.data ?? [];
  const driverIds = rows.map(r => r.driver_id as string);
  const nameMap: Record<string, string> = {};

  if (driverIds.length > 0) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, employee_id')
      .in('id', driverIds);
    const empIds = (drivers ?? []).map(d => d.employee_id).filter(Boolean) as string[];
    if (empIds.length > 0) {
      const { data: emps } = await sb
        .from('employees')
        .select('id, name')
        .in('id', empIds);
      const empMap: Record<string, string> = {};
      (emps ?? []).forEach(e => { empMap[e.id as string] = e.name as string; });
      (drivers ?? []).forEach(d => {
        if (d.employee_id) nameMap[d.id as string] = empMap[d.employee_id as string] ?? 'Fahrer';
      });
    }
  }

  const participations: ChallengeParticipation[] = rows.map(r => ({
    id:           r.id           as string,
    challengeId:  r.challenge_id as string,
    driverId:     r.driver_id    as string,
    driverName:   nameMap[r.driver_id as string] ?? 'Fahrer',
    currentValue: Number(r.current_value ?? 0),
    progressPct:  Number(r.progress_pct  ?? 0),
    completed:    r.completed    as boolean,
    completedAt:  r.completed_at as string | null,
    rewardPaid:   r.reward_paid  as boolean,
    rank:         Number(r.rank  ?? 0),
  }));

  return {
    challenge: mapChallenge(challengeRes.data as Record<string, unknown>),
    participations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// createChallenge
// ─────────────────────────────────────────────────────────────────────────────

export async function createChallenge(input: CreateChallengeInput): Promise<DriverChallenge> {
  const sb = createServiceClient();
  const now = new Date();
  const status: ChallengeStatus = new Date(input.startsAt) <= now ? 'active' : 'draft';

  const { data, error } = await sb
    .from('driver_challenges')
    .insert({
      location_id:    input.locationId,
      title:          input.title,
      description:    input.description   ?? null,
      challenge_type: input.challengeType,
      target_value:   input.targetValue,
      reward_eur:     input.rewardEur,
      reward_note:    input.rewardNote    ?? null,
      starts_at:      input.startsAt,
      ends_at:        input.endsAt,
      status,
      max_winners:    input.maxWinners    ?? null,
      created_by:     input.createdBy     ?? null,
    })
    .select('id, location_id, title, description, challenge_type, target_value, reward_eur, reward_note, starts_at, ends_at, status, max_winners, winner_count, created_at')
    .single();

  if (error) throw error;
  const challenge = mapChallenge(data as Record<string, unknown>);

  // Auto-enroll all active drivers for this location
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('active', true);

  if (drivers && drivers.length > 0) {
    await sb.from('driver_challenge_participations').insert(
      drivers.map(d => ({
        challenge_id: challenge.id,
        location_id:  input.locationId,
        driver_id:    d.id as string,
      })),
    );
  }

  return challenge;
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteChallenge — soft cancel
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteChallenge(id: string, locationId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_challenges')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('location_id', locationId);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateProgressForDriver — recompute one driver's metrics for all active challenges
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProgressForDriver(
  locationId: string,
  driverId: string,
): Promise<void> {
  const sb = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: challenges } = await sb
    .from('driver_challenges')
    .select('id, challenge_type, target_value, max_winners, winner_count, starts_at, ends_at')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso);

  if (!challenges || challenges.length === 0) return;

  // Aggregate per-challenge window metrics
  for (const ch of challenges) {
    const windowStart = ch.starts_at as string;

    let currentValue = 0;

    if (ch.challenge_type === 'deliveries_count') {
      const { count } = await sb
        .from('mise_delivery_batches')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', driverId)
        .eq('location_id', locationId)
        .eq('state', 'completed')
        .gte('completed_at', windowStart);
      currentValue = count ?? 0;

    } else if (ch.challenge_type === 'on_time_rate') {
      const { data: perf } = await sb
        .from('delivery_performance')
        .select('delivered_on_time')
        .eq('driver_id', driverId)
        .eq('location_id', locationId)
        .gte('delivered_at', windowStart);
      const total = (perf ?? []).length;
      const onTime = (perf ?? []).filter(p => p.delivered_on_time).length;
      currentValue = total > 0 ? Math.round((onTime / total) * 100) : 0;

    } else if (ch.challenge_type === 'avg_rating') {
      const { data: perf } = await sb
        .from('delivery_performance')
        .select('rating')
        .eq('driver_id', driverId)
        .eq('location_id', locationId)
        .not('rating', 'is', null)
        .gte('delivered_at', windowStart);
      const ratings = (perf ?? []).map(p => Number(p.rating)).filter(r => r > 0);
      currentValue = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;

    } else if (ch.challenge_type === 'revenue_total') {
      const { data: orders } = await sb
        .from('customer_orders')
        .select('gesamtbetrag')
        .eq('mise_driver_id', driverId)
        .eq('location_id', locationId)
        .eq('status', 'geliefert')
        .gte('updated_at', windowStart);
      currentValue = Math.round(
        (orders ?? []).reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0) * 100,
      ) / 100;
    }

    const target = Number(ch.target_value);
    const maxWinners = ch.max_winners as number | null;
    const winnerCount = Number(ch.winner_count ?? 0);
    const canWin = maxWinners == null || winnerCount < maxWinners;
    const isNewlyCompleted = currentValue >= target && canWin;

    // Check previous completion state
    const { data: existing } = await sb
      .from('driver_challenge_participations')
      .select('completed, current_value')
      .eq('challenge_id', ch.id)
      .eq('driver_id', driverId)
      .maybeSingle();

    const wasCompleted = existing?.completed ?? false;

    await sb
      .from('driver_challenge_participations')
      .upsert(
        {
          challenge_id: ch.id,
          location_id:  locationId,
          driver_id:    driverId,
          current_value: currentValue,
          completed:     isNewlyCompleted || wasCompleted,
          completed_at:  isNewlyCompleted && !wasCompleted ? nowIso : (existing ? null : null),
          updated_at:    nowIso,
        },
        { onConflict: 'challenge_id,driver_id' },
      );

    // Increment winner_count on first completion
    if (isNewlyCompleted && !wasCompleted) {
      await sb
        .from('driver_challenges')
        .update({ winner_count: winnerCount + 1, updated_at: nowIso })
        .eq('id', ch.id)
        .eq('location_id', locationId);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkAndAwardChallenges — Cron-Helfer für eine Location
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAndAwardChallenges(locationId: string): Promise<CheckResult> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();

  // 1. Auto-activate draft challenges whose start time has passed
  const { data: toActivate } = await sb
    .from('driver_challenges')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'draft')
    .lte('starts_at', nowIso);

  let autoActivated = 0;
  if (toActivate && toActivate.length > 0) {
    await sb
      .from('driver_challenges')
      .update({ status: 'active', updated_at: nowIso })
      .in('id', toActivate.map(c => c.id as string));
    autoActivated = toActivate.length;
  }

  // 2. Auto-complete expired active challenges
  const { data: toComplete } = await sb
    .from('driver_challenges')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .lt('ends_at', nowIso);

  let autoCompleted = 0;
  if (toComplete && toComplete.length > 0) {
    await sb
      .from('driver_challenges')
      .update({ status: 'completed', updated_at: nowIso })
      .in('id', toComplete.map(c => c.id as string));
    autoCompleted = toComplete.length;
  }

  // 3. Refresh progress for all drivers in active challenges
  const { data: activeChallenges } = await sb
    .from('driver_challenges')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'active');

  if (!activeChallenges || activeChallenges.length === 0) {
    return { checked: toActivate?.length ?? 0, progressUpdated: 0, autoCompleted, autoActivated };
  }

  const challengeIds = activeChallenges.map(c => c.id as string);
  const { data: participants } = await sb
    .from('driver_challenge_participations')
    .select('driver_id')
    .eq('location_id', locationId)
    .in('challenge_id', challengeIds);

  const uniqueDriverIds = [...new Set((participants ?? []).map(p => p.driver_id as string))];

  await Promise.all(
    uniqueDriverIds.map(driverId =>
      updateProgressForDriver(locationId, driverId).catch(() => { /* silent per driver */ }),
    ),
  );

  return {
    checked:         activeChallenges.length,
    progressUpdated: uniqueDriverIds.length,
    autoCompleted,
    autoActivated,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// checkAndAwardChallengesAllLocations — Cron-Batch
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAndAwardChallengesAllLocations(): Promise<{
  locations: number;
  checked: number;
  progressUpdated: number;
  autoCompleted: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb.from('locations').select('id');
  if (!locations || locations.length === 0) {
    return { locations: 0, checked: 0, progressUpdated: 0, autoCompleted: 0 };
  }

  const results = await Promise.all(
    locations.map(loc =>
      checkAndAwardChallenges(loc.id as string).catch(() => ({
        checked: 0, progressUpdated: 0, autoCompleted: 0, autoActivated: 0,
      })),
    ),
  );

  return {
    locations:       locations.length,
    checked:         results.reduce((s, r) => s + r.checked, 0),
    progressUpdated: results.reduce((s, r) => s + r.progressUpdated, 0),
    autoCompleted:   results.reduce((s, r) => s + r.autoCompleted, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDriverActiveChallenges — Fahrer-App Endpoint
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverChallengeEntry {
  challenge: DriverChallenge;
  participation: ChallengeParticipation;
}

export async function getDriverActiveChallenges(
  driverId: string,
  locationId: string,
): Promise<DriverChallengeEntry[]> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data } = await sb
    .from('v_challenge_leaderboard')
    .select('id, challenge_id, driver_id, location_id, current_value, completed, completed_at, reward_paid, progress_pct, rank, target_value, reward_eur, challenge_type, title, ends_at, challenge_status')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('ends_at', nowIso)
    .order('ends_at', { ascending: true })
    .limit(5);

  if (!data || data.length === 0) return [];

  const challengeIds = data.map(d => d.challenge_id as string);
  const { data: challenges } = await sb
    .from('driver_challenges')
    .select('id, location_id, title, description, challenge_type, target_value, reward_eur, reward_note, starts_at, ends_at, status, max_winners, winner_count, created_at')
    .in('id', challengeIds)
    .eq('location_id', locationId)
    .eq('status', 'active');

  const cMap: Record<string, DriverChallenge> = {};
  (challenges ?? []).forEach(c => {
    cMap[c.id as string] = mapChallenge(c as Record<string, unknown>);
  });

  return data
    .filter(d => cMap[d.challenge_id as string])
    .map(d => ({
      challenge: cMap[d.challenge_id as string],
      participation: {
        id:           d.id           as string,
        challengeId:  d.challenge_id as string,
        driverId:     d.driver_id    as string,
        driverName:   'Du',
        currentValue: Number(d.current_value ?? 0),
        progressPct:  Number(d.progress_pct  ?? 0),
        completed:    d.completed    as boolean,
        completedAt:  d.completed_at as string | null,
        rewardPaid:   d.reward_paid  as boolean,
        rank:         Number(d.rank  ?? 0),
      },
    }));
}
