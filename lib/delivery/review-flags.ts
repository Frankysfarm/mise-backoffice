/**
 * lib/delivery/review-flags.ts
 *
 * Fahrer-Review-Flag Engine — Phase 111
 *
 * Analysiert Kunden-Bewertungen nach jeder Abgabe und flaggt Fahrer
 * automatisch für Admin-Review, wenn Schwellwerte überschritten werden.
 *
 * Trigger-Regeln:
 *  - low_avg_14d:       Durchschnitt < 3.0 bei ≥ 3 Ratings in 14 Tagen
 *  - one_star_burst_7d: ≥ 2 Einzel-Sterne-Ratings innerhalb von 7 Tagen
 *
 * Funktionen:
 *  - checkAndFlagDriver()        — Bewertungshistorie prüfen + ggf. flaggen
 *  - processRatingReviewCheck()  — Fire-and-forget nach Rating-Abgabe
 *  - getOpenFlags()              — Admin: alle offenen/in_review Flags
 *  - getFlagById()               — Einzelnen Flag laden
 *  - updateFlagStatus()          — Admin: Status ändern (resolve/dismiss/etc.)
 *  - createManualFlag()          — Admin: manuellen Flag anlegen
 *  - getFlagStats()              — Dashboard-KPIs
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type ReviewFlagReason = 'low_avg_14d' | 'one_star_burst_7d' | 'manual';
export type ReviewFlagStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export interface ReviewFlag {
  id: string;
  locationId: string;
  driverId: string;
  flagReason: ReviewFlagReason;
  badRatingCount: number;
  avgRatingWindow: number | null;
  windowDays: number;
  reviewStatus: ReviewFlagStatus;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFlagWithDriver extends ReviewFlag {
  driverName: string;
  driverVehicle: string;
  driverState: string;
  daysOpen: number;
}

export interface CheckFlagResult {
  flagged: boolean;
  reason: ReviewFlagReason | null;
  flagId: string | null;
  alreadyOpen: boolean;
}

export interface FlagStats {
  locationId: string;
  openCount: number;
  inReviewCount: number;
  resolved30d: number;
  dismissed30d: number;
  new7d: number;
  avgFlaggedRating: number | null;
}

// ── Schwellwerte ──────────────────────────────────────────────────────────────

const THRESHOLDS = {
  LOW_AVG_14D_MIN_RATINGS: 3,
  LOW_AVG_14D_MAX_AVG: 3.0,
  LOW_AVG_14D_WINDOW: 14,
  ONE_STAR_BURST_COUNT: 2,
  ONE_STAR_BURST_WINDOW: 7,
} as const;

// ── Kern-Logik ────────────────────────────────────────────────────────────────

/**
 * Prüft die letzten Ratings eines Fahrers und legt ggf. einen Review-Flag an.
 * Idempotent: wenn bereits ein offener Flag existiert, wird nichts angelegt.
 */
export async function checkAndFlagDriver(
  driverId: string,
  locationId: string,
): Promise<CheckFlagResult> {
  const sb = createServiceClient();

  // Bereits ein offener Flag? → abbrechen
  const { data: existing } = await sb
    .from('driver_review_flags')
    .select('id')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .in('review_status', ['open', 'in_review'])
    .maybeSingle();

  if (existing) {
    return { flagged: false, reason: null, flagId: existing.id as string, alreadyOpen: true };
  }

  // Ratings der letzten 14 Tage laden
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: ratings14d } = await sb
    .from('customer_delivery_ratings')
    .select('rating, created_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('created_at', since14d)
    .order('created_at', { ascending: false });

  if (!ratings14d?.length) {
    return { flagged: false, reason: null, flagId: null, alreadyOpen: false };
  }

  const ratingValues = (ratings14d as Array<{ rating: number; created_at: string }>)
    .map(r => r.rating);

  // Regel 1: Durchschnitt < 3.0 bei ≥ 3 Ratings in 14 Tagen
  if (ratingValues.length >= THRESHOLDS.LOW_AVG_14D_MIN_RATINGS) {
    const avg = ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length;
    if (avg < THRESHOLDS.LOW_AVG_14D_MAX_AVG) {
      const flagId = await insertFlag({
        driverId,
        locationId,
        reason: 'low_avg_14d',
        badRatingCount: ratingValues.filter(r => r <= 2).length,
        avgRating: avg,
        windowDays: THRESHOLDS.LOW_AVG_14D_WINDOW,
      });
      return { flagged: true, reason: 'low_avg_14d', flagId, alreadyOpen: false };
    }
  }

  // Regel 2: ≥ 2 Einzel-Sterne in 7 Tagen
  const oneStarsIn7d = (ratings14d as Array<{ rating: number; created_at: string }>)
    .filter(r => r.rating === 1 && r.created_at >= since7d)
    .length;

  if (oneStarsIn7d >= THRESHOLDS.ONE_STAR_BURST_COUNT) {
    const avg = ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length;
    const flagId = await insertFlag({
      driverId,
      locationId,
      reason: 'one_star_burst_7d',
      badRatingCount: oneStarsIn7d,
      avgRating: avg,
      windowDays: THRESHOLDS.ONE_STAR_BURST_WINDOW,
    });
    return { flagged: true, reason: 'one_star_burst_7d', flagId, alreadyOpen: false };
  }

  return { flagged: false, reason: null, flagId: null, alreadyOpen: false };
}

async function insertFlag(params: {
  driverId: string;
  locationId: string;
  reason: ReviewFlagReason;
  badRatingCount: number;
  avgRating: number;
  windowDays: number;
}): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_review_flags')
    .insert({
      driver_id:          params.driverId,
      location_id:        params.locationId,
      flag_reason:        params.reason,
      bad_rating_count:   params.badRatingCount,
      avg_rating_window:  Math.round(params.avgRating * 100) / 100,
      window_days:        params.windowDays,
      review_status:      'open',
    })
    .select('id')
    .single();

  if (error || !data) {
    // Wenn UNIQUE-Constraint greift (race condition), ist das kein Fehler
    if (error?.code === '23505') return '';
    throw new Error(`[review-flags] insertFlag failed: ${error?.message}`);
  }
  return data.id as string;
}

/**
 * Fire-and-forget Einstiegspunkt nach Rating-Abgabe.
 * Liest den Fahrer aus der Bestellung und delegiert an checkAndFlagDriver().
 */
export async function processRatingReviewCheck(
  orderId: string,
  locationId: string,
): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data: order } = await sb
      .from('customer_orders')
      .select('mise_driver_id')
      .eq('id', orderId)
      .maybeSingle();

    const driverId = (order?.mise_driver_id as string | null) ?? null;
    if (!driverId) return;

    await checkAndFlagDriver(driverId, locationId);
  } catch (err) {
    // Fire-and-forget: niemals Fehler nach oben propagieren
    console.warn('[review-flags] processRatingReviewCheck failed:', err);
  }
}

// ── Admin-Abfragen ─────────────────────────────────────────────────────────────

/**
 * Gibt alle offenen und in_review Flags für eine Location zurück,
 * inkl. Fahrerdaten (aus v_drivers_needing_review).
 */
export async function getOpenFlags(
  locationId: string,
  includeInReview = true,
): Promise<ReviewFlagWithDriver[]> {
  const sb = createServiceClient();
  const statuses = includeInReview ? ['open', 'in_review'] : ['open'];

  const { data, error } = await sb
    .from('v_drivers_needing_review')
    .select('*')
    .eq('location_id', locationId)
    .in('review_status', statuses)
    .order('flagged_at', { ascending: true });

  if (error) throw new Error(`[review-flags] getOpenFlags: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => mapFlagRow(row));
}

/**
 * Einzelnen Flag per ID laden (mit Fahrerdaten wenn offen/in_review, sonst direkt).
 */
export async function getFlagById(
  flagId: string,
  locationId: string,
): Promise<ReviewFlag | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_review_flags')
    .select('*')
    .eq('id', flagId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) throw new Error(`[review-flags] getFlagById: ${error.message}`);
  if (!data) return null;

  return mapBaseRow(data);
}

/**
 * Admin-Aktion: Status eines Flags ändern.
 * resolved/dismissed → setzt resolved_at.
 */
export async function updateFlagStatus(
  flagId: string,
  locationId: string,
  newStatus: ReviewFlagStatus,
  adminNotes?: string,
): Promise<ReviewFlag> {
  const sb = createServiceClient();

  const update: Record<string, unknown> = { review_status: newStatus };
  if (adminNotes !== undefined) update.admin_notes = adminNotes;
  if (newStatus === 'resolved' || newStatus === 'dismissed') {
    update.resolved_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('driver_review_flags')
    .update(update)
    .eq('id', flagId)
    .eq('location_id', locationId)
    .select('*')
    .single();

  if (error || !data) throw new Error(`[review-flags] updateFlagStatus: ${error?.message}`);
  return mapBaseRow(data);
}

/**
 * Admin: manuellen Review-Flag für einen Fahrer anlegen.
 */
export async function createManualFlag(
  driverId: string,
  locationId: string,
  adminNotes?: string,
): Promise<ReviewFlag> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('driver_review_flags')
    .insert({
      driver_id:         driverId,
      location_id:       locationId,
      flag_reason:       'manual',
      bad_rating_count:  0,
      avg_rating_window: null,
      window_days:       0,
      review_status:     'open',
      admin_notes:       adminNotes ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new Error('[review-flags] Fahrer hat bereits einen offenen Review-Flag.');
    }
    throw new Error(`[review-flags] createManualFlag: ${error?.message}`);
  }
  return mapBaseRow(data);
}

/**
 * Dashboard-KPIs für eine Location (aus v_review_flag_stats).
 */
export async function getFlagStats(locationId: string): Promise<FlagStats> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_review_flag_stats')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) throw new Error(`[review-flags] getFlagStats: ${error.message}`);

  if (!data) {
    return {
      locationId,
      openCount: 0,
      inReviewCount: 0,
      resolved30d: 0,
      dismissed30d: 0,
      new7d: 0,
      avgFlaggedRating: null,
    };
  }

  return {
    locationId,
    openCount:         Number(data.open_count ?? 0),
    inReviewCount:     Number(data.in_review_count ?? 0),
    resolved30d:       Number(data.resolved_30d ?? 0),
    dismissed30d:      Number(data.dismissed_30d ?? 0),
    new7d:             Number(data.new_7d ?? 0),
    avgFlaggedRating:  data.avg_flagged_rating != null
                         ? Number(data.avg_flagged_rating)
                         : null,
  };
}

// ── Cron: Alle Fahrer scannen ─────────────────────────────────────────────────

/**
 * Täglicher Cron-Job: Alle Fahrer die in den letzten 14 Tagen Ratings erhalten haben,
 * werden auf Review-Würdigkeit geprüft. Idempotent dank UNIQUE-Partial-Index.
 */
export async function checkAllDrivers(): Promise<{
  locations: number;
  driversChecked: number;
  flagged: number;
  alreadyFlagged: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Distinct (driver_id, location_id) Paare der letzten 14 Tage
  const { data: pairs } = await sb
    .from('customer_delivery_ratings')
    .select('driver_id, location_id')
    .gte('created_at', since14d)
    .not('driver_id', 'is', null)
    .limit(500);

  if (!pairs?.length) {
    return { locations: 0, driversChecked: 0, flagged: 0, alreadyFlagged: 0, errors: 0 };
  }

  // Deduplizieren
  const seen = new Set<string>();
  const uniquePairs: Array<{ driver_id: string; location_id: string }> = [];
  for (const p of pairs) {
    const key = `${p.driver_id as string}:${p.location_id as string}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePairs.push({ driver_id: p.driver_id as string, location_id: p.location_id as string });
    }
  }

  const locationSet = new Set(uniquePairs.map((p) => p.location_id));
  let driversChecked = 0;
  let flagged = 0;
  let alreadyFlagged = 0;
  let errors = 0;

  for (const pair of uniquePairs) {
    try {
      const result = await checkAndFlagDriver(pair.driver_id, pair.location_id);
      driversChecked++;
      if (result.flagged) flagged++;
      if (result.alreadyOpen) alreadyFlagged++;
    } catch {
      errors++;
    }
  }

  return {
    locations: locationSet.size,
    driversChecked,
    flagged,
    alreadyFlagged,
    errors,
  };
}

// ── Row-Mapper ────────────────────────────────────────────────────────────────

function mapBaseRow(row: Record<string, unknown>): ReviewFlag {
  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    driverId:         row.driver_id as string,
    flagReason:       row.flag_reason as ReviewFlagReason,
    badRatingCount:   Number(row.bad_rating_count ?? 0),
    avgRatingWindow:  row.avg_rating_window != null ? Number(row.avg_rating_window) : null,
    windowDays:       Number(row.window_days ?? 0),
    reviewStatus:     row.review_status as ReviewFlagStatus,
    adminNotes:       (row.admin_notes as string | null) ?? null,
    resolvedAt:       (row.resolved_at as string | null) ?? null,
    createdAt:        row.created_at as string,
    updatedAt:        row.updated_at as string,
  };
}

function mapFlagRow(row: Record<string, unknown>): ReviewFlagWithDriver {
  return {
    id:               row.flag_id as string,
    locationId:       row.location_id as string,
    driverId:         row.driver_id as string,
    flagReason:       row.flag_reason as ReviewFlagReason,
    badRatingCount:   Number(row.bad_rating_count ?? 0),
    avgRatingWindow:  row.avg_rating_window != null ? Number(row.avg_rating_window) : null,
    windowDays:       Number(row.window_days ?? 0),
    reviewStatus:     row.review_status as ReviewFlagStatus,
    adminNotes:       (row.admin_notes as string | null) ?? null,
    resolvedAt:       null,
    createdAt:        row.flagged_at as string,
    updatedAt:        row.updated_at as string,
    driverName:       (row.driver_name as string | null) ?? '',
    driverVehicle:    (row.driver_vehicle as string | null) ?? '',
    driverState:      (row.driver_state as string | null) ?? '',
    daysOpen:         Number(row.days_open ?? 0),
  };
}
