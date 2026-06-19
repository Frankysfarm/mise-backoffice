/**
 * lib/delivery/driver-ramp-up.ts
 *
 * Phase 250 — Driver Ramp-Up Intelligence Engine
 *
 * Verfolgt die Performance neuer Fahrer in den ersten 60 Tagen und berechnet
 * einen gewichteten Ramp-Up-Score (0–100). Identifiziert automatisch Fahrer,
 * die Coaching benötigen, und prognostiziert langfristige Retention.
 *
 * Score-Formel (0–100):
 *   f_punctuality  (0–35): Pünktlichkeitsrate (on_time_rate_pct)
 *   f_volume       (0–25): Liefervolumen in Periode (max: 100 Stopps)
 *   f_quality      (0–25): Ø Kundenbewertung (1–5 → 0–25)
 *   f_reliability  (0–15): Umgekehrte Stornierungsrate
 *
 * Tier-Grenzen:
 *   graduated  — 60+ Tage ODER 200+ Lieferungen (Ramp-Up abgeschlossen)
 *   promising  — Score ≥ 70
 *   developing — Score 40–69
 *   struggling — Score < 40
 *
 * Öffentliche API:
 *   computeRampUpProfile(driverId, locationId)  — Einzelnen Fahrer berechnen + upserten
 *   computeRampUpForLocation(locationId)        — Alle neuen Fahrer einer Location
 *   computeRampUpAllLocations()                 — Cron-Batch
 *   getRampUpDashboard(locationId)              — Dashboard-Daten
 *   getRampUpProfile(driverId, locationId)      — Einzelprofil
 *   flagForCoaching(driverId, locationId, reason, flaggedBy) — Coaching-Flag setzen
 *   clearCoachingFlag(driverId, locationId)     — Flag zurücksetzen
 *   graduateDriver(driverId, locationId)        — Fahrer als abgeschlossen markieren
 *   pruneOldProfiles(days?)                     — Abgeschlossene Einträge bereinigen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type RampUpTier = 'struggling' | 'developing' | 'promising' | 'graduated';
export type PredictedRetention = 'high' | 'medium' | 'low';

export interface RampUpProfile {
  id: string;
  driverId: string;
  locationId: string;
  driverName: string | null;
  vehicleType: string | null;
  firstDeliveryAt: string | null;
  rampUpDay: number;
  deliveriesInPeriod: number;
  onTimeRatePct: number | null;
  avgDeliveryMin: number | null;
  avgRating: number | null;
  cancellationRatePct: number | null;
  rampUpScore: number;
  rampUpTier: RampUpTier;
  coachingFlag: boolean;
  coachingReason: string | null;
  coachingFlaggedAt: string | null;
  predictedRetention: PredictedRetention | null;
  graduatedAt: string | null;
  computedAt: string;
}

export interface RampUpKpis {
  locationId: string;
  activeNewHires: number;
  graduatingSoon: number;
  atRiskCount: number;
  avgCohortScore: number;
  graduatedLast7d: number;
  coachingFlagged: number;
  computedAt: string;
}

export interface RampUpDashboard {
  kpis: RampUpKpis;
  profiles: RampUpProfile[];
  recentGraduates: RampUpProfile[];
}

export interface RampUpComputeResult {
  locationId: string;
  computed: number;
  graduated: number;
  errors: number;
}

// ── Score-Berechnung ──────────────────────────────────────────────────────────

function computeScore(
  onTimeRatePct: number | null,
  deliveriesInPeriod: number,
  avgRating: number | null,
  cancellationRatePct: number | null,
  hasData: boolean,
): number {
  if (!hasData) return 0;

  // f_punctuality (0–35): Pünktlichkeitsrate
  const fPunctuality =
    onTimeRatePct != null ? (onTimeRatePct / 100) * 35 : 17.5;

  // f_volume (0–25): 100 Stopps in 60 Tagen = Maximum
  const fVolume = Math.min(deliveriesInPeriod / 100, 1) * 25;

  // f_quality (0–25): Kundenbewertung 1–5 → 0–25
  const fQuality =
    avgRating != null ? ((avgRating - 1) / 4) * 25 : 12.5;

  // f_reliability (0–15): Niedrige Stornierungsrate besser
  // 0 % → 15 Punkte, 20 %+ → 0 Punkte
  const cancelRate = cancellationRatePct ?? 5;
  const fReliability = Math.max(0, (1 - cancelRate / 20)) * 15;

  return Math.min(100, Math.max(0, Math.round(fPunctuality + fVolume + fQuality + fReliability)));
}

function deriveTier(
  score: number,
  rampUpDay: number,
  deliveriesInPeriod: number,
  graduatedAt: string | null,
): RampUpTier {
  if (graduatedAt || rampUpDay >= 60 || deliveriesInPeriod >= 200) return 'graduated';
  if (score >= 70) return 'promising';
  if (score >= 40) return 'developing';
  return 'struggling';
}

function derivePredictedRetention(
  score: number,
  avgRating: number | null,
): PredictedRetention {
  if (score >= 70 && (avgRating == null || avgRating >= 4.0)) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ── computeRampUpProfile ──────────────────────────────────────────────────────

export async function computeRampUpProfile(
  driverId: string,
  locationId: string,
): Promise<RampUpProfile | null> {
  const sb = createServiceClient();

  // 1. Alle Performance-Snapshots für diesen Fahrer laden (chronologisch)
  const { data: snapshots, error: snapErr } = await sb
    .from('driver_performance_snapshots')
    .select('snapshot_date, stops_completed, on_time_rate, avg_rating, avg_delivery_min')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: true });

  if (snapErr) {
    if (snapErr.message.includes('driver_performance_snapshots')) return null;
    console.warn('[driver-ramp-up] snapshots error:', snapErr.message);
    return null;
  }

  if (!snapshots || snapshots.length === 0) return null;

  // 2. Ramp-Up-Zeitraum: erste 60 Tage ab erstem Snapshot
  const firstDate = new Date(snapshots[0].snapshot_date as string);
  const periodCutoff = new Date(firstDate.getTime() + 60 * 86_400_000);
  const now = new Date();
  const rampUpDay = Math.floor((now.getTime() - firstDate.getTime()) / 86_400_000);

  const periodSnaps = snapshots.filter(
    (s) => new Date(s.snapshot_date as string) <= periodCutoff,
  );

  // 3. Aggregation der Perioden-Snapshots
  let deliveriesInPeriod = 0;
  let onTimeSum = 0;
  let onTimeCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let deliveryMinSum = 0;
  let deliveryMinCount = 0;

  for (const s of periodSnaps) {
    deliveriesInPeriod += Number(s.stops_completed ?? 0);
    if (s.on_time_rate != null) {
      onTimeSum += Number(s.on_time_rate) * 100;
      onTimeCount++;
    }
    if (s.avg_rating != null) {
      ratingSum += Number(s.avg_rating);
      ratingCount++;
    }
    if (s.avg_delivery_min != null) {
      deliveryMinSum += Number(s.avg_delivery_min);
      deliveryMinCount++;
    }
  }

  const onTimeRatePct = onTimeCount > 0 ? Math.round((onTimeSum / onTimeCount) * 10) / 10 : null;
  const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : null;
  const avgDeliveryMin =
    deliveryMinCount > 0 ? Math.round((deliveryMinSum / deliveryMinCount) * 10) / 10 : null;

  // 4. Stornierungen in der Ramp-Up-Periode
  const { count: cancelCount } = await sb
    .from('mise_delivery_batches')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('state', 'cancelled')
    .gte('created_at', firstDate.toISOString())
    .lte('created_at', periodCutoff.toISOString());

  const totalBatchesInPeriod = deliveriesInPeriod + (cancelCount ?? 0);
  const cancellationRatePct =
    totalBatchesInPeriod > 0
      ? Math.round((((cancelCount ?? 0) / totalBatchesInPeriod) * 100) * 10) / 10
      : null;

  // 5. Namen aus employees-Tabelle
  const { data: driverRow } = await sb
    .from('mise_drivers')
    .select('auth_user_id, vehicle_type')
    .eq('id', driverId)
    .maybeSingle();

  let driverName: string | null = null;
  let vehicleType: string | null = (driverRow?.vehicle_type as string | null) ?? null;

  if (driverRow?.auth_user_id) {
    const { data: emp } = await sb
      .from('employees')
      .select('vorname, nachname')
      .eq('auth_user_id', driverRow.auth_user_id as string)
      .eq('location_id', locationId)
      .maybeSingle();
    if (emp) {
      driverName = `${emp.vorname ?? ''} ${emp.nachname ?? ''}`.trim() || null;
    }
  }

  // 6. Bestehendes Profil für coaching_flag / graduated_at
  const { data: existing } = await sb
    .from('driver_ramp_up_profiles')
    .select('coaching_flag, coaching_reason, coaching_flagged_at, graduated_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  const hasData = periodSnaps.length >= 3;
  const score = computeScore(
    onTimeRatePct,
    deliveriesInPeriod,
    avgRating,
    cancellationRatePct,
    hasData,
  );
  const graduatedAt = (existing?.graduated_at as string | null) ?? null;
  const tier = deriveTier(score, rampUpDay, deliveriesInPeriod, graduatedAt);
  const predictedRetention = derivePredictedRetention(score, avgRating);

  // Auto-Graduated: Ramp-Up abgeschlossen
  const autoGraduate = !graduatedAt && (rampUpDay >= 60 || deliveriesInPeriod >= 200);

  // Auto-Coaching: struggling nach ≥14 Tagen ohne bestehendes manuelles Flag
  const existingCoachingFlag = (existing?.coaching_flag as boolean | null) ?? false;
  const autoCoachingFlag =
    !existingCoachingFlag && tier === 'struggling' && rampUpDay >= 14 && hasData;
  const coachingFlag = existingCoachingFlag || autoCoachingFlag;
  const coachingReason = autoCoachingFlag
    ? 'Automatisch: Score unter 40 nach 14+ Tagen'
    : ((existing?.coaching_reason as string | null) ?? null);
  const coachingFlaggedAt = autoCoachingFlag
    ? new Date().toISOString()
    : ((existing?.coaching_flagged_at as string | null) ?? null);

  // 7. Upsert
  const upsertRow = {
    driver_id:             driverId,
    location_id:           locationId,
    driver_name:           driverName,
    vehicle_type:          vehicleType,
    first_delivery_at:     firstDate.toISOString(),
    ramp_up_day:           Math.max(0, rampUpDay),
    deliveries_in_period:  deliveriesInPeriod,
    on_time_rate_pct:      onTimeRatePct,
    avg_delivery_min:      avgDeliveryMin,
    avg_rating:            avgRating,
    cancellation_rate_pct: cancellationRatePct,
    ramp_up_score:         score,
    ramp_up_tier:          tier,
    coaching_flag:         coachingFlag,
    coaching_reason:       coachingReason,
    coaching_flagged_at:   coachingFlaggedAt,
    predicted_retention:   predictedRetention,
    graduated_at:          autoGraduate ? new Date().toISOString() : (graduatedAt ?? null),
    computed_at:           new Date().toISOString(),
  };

  const { data: upserted, error: upsertErr } = await sb
    .from('driver_ramp_up_profiles')
    .upsert(upsertRow, { onConflict: 'driver_id,location_id' })
    .select()
    .maybeSingle();

  if (upsertErr) {
    if (upsertErr.message.includes('driver_ramp_up_profiles')) return null;
    console.warn('[driver-ramp-up] upsert error:', upsertErr.message);
    return null;
  }

  return mapRow(upserted ?? upsertRow);
}

// ── computeRampUpForLocation ──────────────────────────────────────────────────

export async function computeRampUpForLocation(
  locationId: string,
): Promise<RampUpComputeResult> {
  const sb = createServiceClient();

  // Fahrer mit Snapshots in den letzten 90 Tagen (neu oder kürzlich abgeschlossen)
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('snapshot_date', since);

  if (error) {
    if (error.message.includes('driver_performance_snapshots'))
      return { locationId, computed: 0, graduated: 0, errors: 0 };
    return { locationId, computed: 0, graduated: 0, errors: 1 };
  }

  const uniqueDriverIds = [...new Set((rows ?? []).map((r) => r.driver_id as string))];
  let computed = 0;
  let graduated = 0;
  let errors = 0;

  for (const driverId of uniqueDriverIds) {
    const profile = await computeRampUpProfile(driverId, locationId);
    if (profile) {
      computed++;
      if (profile.rampUpTier === 'graduated') graduated++;
    } else {
      errors++;
    }
  }

  return { locationId, computed, graduated, errors };
}

// ── computeRampUpAllLocations ─────────────────────────────────────────────────

export async function computeRampUpAllLocations(): Promise<{
  total: number;
  computed: number;
  graduated: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let total = 0;
  let computed = 0;
  let graduated = 0;
  let errors = 0;

  for (const loc of locations ?? []) {
    const result = await computeRampUpForLocation(loc.id as string).catch(() => null);
    if (result) {
      total++;
      computed += result.computed;
      graduated += result.graduated;
      errors += result.errors;
    }
  }

  return { total, computed, graduated, errors };
}

// ── getRampUpDashboard ────────────────────────────────────────────────────────

export async function getRampUpDashboard(locationId: string): Promise<RampUpDashboard> {
  const sb = createServiceClient();
  const now = new Date().toISOString();

  const [profilesRes, recentGradRes] = await Promise.all([
    // Aktive neue Fahrer (noch nicht abgeschlossen)
    sb
      .from('driver_ramp_up_profiles')
      .select('*')
      .eq('location_id', locationId)
      .is('graduated_at', null)
      .order('ramp_up_score', { ascending: false }),

    // Kürzlich abgeschlossen (letzte 7 Tage)
    sb
      .from('driver_ramp_up_profiles')
      .select('*')
      .eq('location_id', locationId)
      .not('graduated_at', 'is', null)
      .gte('graduated_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('graduated_at', { ascending: false })
      .limit(10),
  ]);

  const profiles = (profilesRes.data ?? []).map(mapRow);
  const recentGraduates = (recentGradRes.data ?? []).map(mapRow);

  const activeNewHires = profiles.length;
  const atRiskCount = profiles.filter((p) => p.rampUpTier === 'struggling').length;
  const graduatingSoon = profiles.filter(
    (p) => p.rampUpDay >= 50 && p.rampUpDay < 60 && p.rampUpTier !== 'graduated',
  ).length;
  const coachingFlagged = profiles.filter((p) => p.coachingFlag).length;
  const avgCohortScore =
    profiles.length > 0
      ? Math.round(profiles.reduce((s, p) => s + p.rampUpScore, 0) / profiles.length)
      : 0;

  return {
    kpis: {
      locationId,
      activeNewHires,
      graduatingSoon,
      atRiskCount,
      avgCohortScore,
      graduatedLast7d: recentGraduates.length,
      coachingFlagged,
      computedAt: now,
    },
    profiles,
    recentGraduates,
  };
}

// ── getRampUpProfile ──────────────────────────────────────────────────────────

export async function getRampUpProfile(
  driverId: string,
  locationId: string,
): Promise<RampUpProfile | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_ramp_up_profiles')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

// ── flagForCoaching ───────────────────────────────────────────────────────────

export async function flagForCoaching(
  driverId: string,
  locationId: string,
  reason: string,
  flaggedBy?: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_ramp_up_profiles')
    .update({
      coaching_flag:       true,
      coaching_reason:     reason,
      coaching_flagged_at: new Date().toISOString(),
      coaching_flagged_by: flaggedBy ?? null,
    })
    .eq('driver_id', driverId)
    .eq('location_id', locationId);
}

// ── clearCoachingFlag ─────────────────────────────────────────────────────────

export async function clearCoachingFlag(
  driverId: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_ramp_up_profiles')
    .update({
      coaching_flag:       false,
      coaching_reason:     null,
      coaching_flagged_at: null,
      coaching_flagged_by: null,
    })
    .eq('driver_id', driverId)
    .eq('location_id', locationId);
}

// ── graduateDriver ────────────────────────────────────────────────────────────

export async function graduateDriver(
  driverId: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_ramp_up_profiles')
    .update({
      graduated_at: new Date().toISOString(),
      ramp_up_tier: 'graduated',
    })
    .eq('driver_id', driverId)
    .eq('location_id', locationId);
}

// ── pruneOldProfiles ──────────────────────────────────────────────────────────

export async function pruneOldProfiles(days = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { count } = await sb
    .from('driver_ramp_up_profiles')
    .delete({ count: 'exact' })
    .not('graduated_at', 'is', null)
    .lt('graduated_at', cutoff);

  return { pruned: count ?? 0 };
}

// ── Hilfsfunktion: DB-Zeile → RampUpProfile ──────────────────────────────────

function mapRow(r: Record<string, unknown>): RampUpProfile {
  return {
    id:                    r.id as string,
    driverId:              r.driver_id as string,
    locationId:            r.location_id as string,
    driverName:            (r.driver_name as string | null) ?? null,
    vehicleType:           (r.vehicle_type as string | null) ?? null,
    firstDeliveryAt:       (r.first_delivery_at as string | null) ?? null,
    rampUpDay:             Number(r.ramp_up_day ?? 0),
    deliveriesInPeriod:    Number(r.deliveries_in_period ?? 0),
    onTimeRatePct:         r.on_time_rate_pct != null ? Number(r.on_time_rate_pct) : null,
    avgDeliveryMin:        r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    avgRating:             r.avg_rating != null ? Number(r.avg_rating) : null,
    cancellationRatePct:   r.cancellation_rate_pct != null ? Number(r.cancellation_rate_pct) : null,
    rampUpScore:           Number(r.ramp_up_score ?? 0),
    rampUpTier:            (r.ramp_up_tier as RampUpTier) ?? 'developing',
    coachingFlag:          Boolean(r.coaching_flag),
    coachingReason:        (r.coaching_reason as string | null) ?? null,
    coachingFlaggedAt:     (r.coaching_flagged_at as string | null) ?? null,
    predictedRetention:    (r.predicted_retention as PredictedRetention | null) ?? null,
    graduatedAt:           (r.graduated_at as string | null) ?? null,
    computedAt:            (r.computed_at as string) ?? new Date().toISOString(),
  };
}
