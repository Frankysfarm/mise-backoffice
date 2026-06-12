/**
 * lib/delivery/driver-reliability.ts
 *
 * Phase 93: Fahrer-Zuverlässigkeits-Score + No-Show-Handler
 *
 * Verfolgt Schicht-Qualitäts-Ereignisse je Fahrer (no_show, late_start,
 * early_end, perfect) und berechnet daraus einen aggregierten Score (0–100).
 *
 * Ablauf:
 *  1. Cron ruft detectAndHandleNoShowsAllLocations() alle 30 Min auf
 *  2. Missed shifts → event_type='no_show' → updateDriverReliabilityScore()
 *  3. Admin sieht Leaderboard via GET /api/delivery/admin/driver-reliability
 *  4. endShift() in shifts.ts ruft recordPerfectShiftIfClean() auf (fire-and-forget)
 *
 * Score-Formel:
 *   100 − (no_shows × 25) − (late_starts × 5) − (early_ends × 10) + (perfects × 2)
 *   Floor 0, Cap 100
 *
 * Funktionen:
 *  recordShiftEvent()                    — Ereignis persistieren
 *  updateDriverReliabilityScore()        — Score neu berechnen + upserten
 *  detectAndHandleNoShows()              — No-Shows einer Location erkennen + Broadcast
 *  detectAndHandleNoShowsAllLocations()  — Cron-Wrapper für alle Locations
 *  recordPerfectShiftIfClean()           — Perfect-Event wenn keine Mängel in dieser Schicht
 *  recordLateStart()                     — Late-Start-Event wenn Fahrer ≥15 Min zu spät
 *  getReliabilityLeaderboard()           — Sortiert nach Score absteigend
 *  getDriverReliabilityHistory()         — Ereignis-Verlauf eines Fahrers
 *  getReliabilityStats()                 — KPI-Summary für Admin-Dashboard
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ShiftEventType = 'no_show' | 'late_start' | 'early_end' | 'perfect';

export interface DriverShiftEvent {
  id: string;
  driver_id: string;
  location_id: string;
  shift_id: string | null;
  event_type: ShiftEventType;
  planned_start: string | null;
  actual_start: string | null;
  late_minutes: number | null;
  recorded_at: string;
  notes: string | null;
  driver_name?: string | null;
}

export interface ReliabilityScore {
  driver_id: string;
  location_id: string;
  score: number;
  total_shifts: number;
  no_shows: number;
  late_starts: number;
  early_ends: number;
  perfect_shifts: number;
  no_show_rate: number;
  updated_at: string;
  driver_name?: string | null;
  driver_vehicle?: string | null;
  reliability_tier?: 'excellent' | 'good' | 'medium' | 'critical';
}

export interface ReliabilityStats {
  avg_score: number;
  drivers_tracked: number;
  no_shows_this_month: number;
  perfect_shifts_this_month: number;
  reliable_drivers_count: number;
  critical_drivers_count: number;
}

export interface NoShowDetectionResult {
  location_id: string;
  detected: number;
  broadcast_sent: boolean;
  driver_names: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreFromCounts(
  noShows: number,
  lateStarts: number,
  earlyEnds: number,
  perfects: number,
): number {
  const raw = 100 - noShows * 25 - lateStarts * 5 - earlyEnds * 10 + perfects * 2;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

function reliabilityTier(score: number): ReliabilityScore['reliability_tier'] {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'medium';
  return 'critical';
}

async function isMigrationMissing(sb: ReturnType<typeof createServiceClient>): Promise<boolean> {
  const { error } = await sb.from('driver_shift_events').select('id').limit(0);
  return !!error && (error.code === '42P01' || error.message.includes('driver_shift_events'));
}

// ─── Öffentliche Funktionen ───────────────────────────────────────────────────

export async function recordShiftEvent(params: {
  driverId: string;
  locationId: string;
  shiftId?: string | null;
  eventType: ShiftEventType;
  plannedStart?: string | null;
  actualStart?: string | null;
  lateMinutes?: number | null;
  notes?: string | null;
}): Promise<{ id: string }> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return { id: 'migration-missing' };

  const { data, error } = await sb
    .from('driver_shift_events')
    .insert({
      driver_id:     params.driverId,
      location_id:   params.locationId,
      shift_id:      params.shiftId ?? null,
      event_type:    params.eventType,
      planned_start: params.plannedStart ?? null,
      actual_start:  params.actualStart ?? null,
      late_minutes:  params.lateMinutes ?? null,
      notes:         params.notes ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`recordShiftEvent: ${error.message}`);
  return { id: data.id as string };
}

export async function updateDriverReliabilityScore(
  driverId: string,
  locationId: string,
): Promise<ReliabilityScore> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) {
    return {
      driver_id: driverId, location_id: locationId, score: 100,
      total_shifts: 0, no_shows: 0, late_starts: 0, early_ends: 0,
      perfect_shifts: 0, no_show_rate: 0, updated_at: new Date().toISOString(),
    };
  }

  const { data: events } = await sb
    .from('driver_shift_events')
    .select('event_type')
    .eq('driver_id', driverId)
    .eq('location_id', locationId);

  const counts = { no_show: 0, late_start: 0, early_end: 0, perfect: 0 };
  for (const e of events ?? []) {
    const t = e.event_type as ShiftEventType;
    if (t in counts) counts[t]++;
  }

  const total = counts.no_show + counts.late_start + counts.early_end + counts.perfect;
  const score = scoreFromCounts(counts.no_show, counts.late_start, counts.early_end, counts.perfect);
  const noShowRate = total > 0 ? Math.round(counts.no_show / total * 1000) / 10 : 0;

  const row = {
    driver_id:      driverId,
    location_id:    locationId,
    score,
    total_shifts:   total,
    no_shows:       counts.no_show,
    late_starts:    counts.late_start,
    early_ends:     counts.early_end,
    perfect_shifts: counts.perfect,
    no_show_rate:   noShowRate,
    updated_at:     new Date().toISOString(),
  };

  await sb
    .from('driver_reliability_scores')
    .upsert(row, { onConflict: 'driver_id,location_id' });

  return { ...row, reliability_tier: reliabilityTier(score) };
}

/**
 * Erkennt No-Shows einer Location:
 * Schichten mit status='missed', planned_start 30–120 Min in der Vergangenheit,
 * für die noch kein no_show-Event existiert.
 * Schreibt Events + sendet Broadcast.
 */
export async function detectAndHandleNoShows(locationId: string): Promise<NoShowDetectionResult> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) {
    return { location_id: locationId, detected: 0, broadcast_sent: false, driver_names: [] };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 120 * 60_000).toISOString(); // max 2h zurück
  const threshold   = new Date(now.getTime() - 30  * 60_000).toISOString(); // mind. 30 Min

  const { data: missed } = await sb
    .from('driver_shifts')
    .select('id, driver_id, location_id, planned_start, mise_drivers!driver_id(name)')
    .eq('location_id', locationId)
    .eq('status', 'missed')
    .gte('planned_start', windowStart)
    .lte('planned_start', threshold)
    .limit(10);

  if (!missed || missed.length === 0) {
    return { location_id: locationId, detected: 0, broadcast_sent: false, driver_names: [] };
  }

  const driverNames: string[] = [];

  for (const shift of missed) {
    // Duplikat-Guard: no_show für diese Schicht bereits vorhanden?
    const { data: existing } = await sb
      .from('driver_shift_events')
      .select('id')
      .eq('shift_id', shift.id as string)
      .eq('event_type', 'no_show')
      .maybeSingle();

    if (existing) continue;

    const driverArr = shift.mise_drivers;
    const driver = (Array.isArray(driverArr) ? driverArr[0] : driverArr) as { name?: string | null } | null;
    const name = driver?.name ?? 'Unbekannt';

    await recordShiftEvent({
      driverId:     shift.driver_id as string,
      locationId,
      shiftId:      shift.id as string,
      eventType:    'no_show',
      plannedStart: shift.planned_start as string,
      notes:        'Auto-erkannt: Fahrer hat sich nicht innerhalb von 30 Min eingecheckt.',
    });

    await updateDriverReliabilityScore(shift.driver_id as string, locationId);
    driverNames.push(name);
  }

  if (driverNames.length === 0) {
    return { location_id: locationId, detected: 0, broadcast_sent: false, driver_names: [] };
  }

  let broadcastSent = false;
  try {
    const { sendBroadcast } = await import('./messaging');
    const n = driverNames.length;
    await sendBroadcast({
      locationId,
      message: `⚠️ Fahrermangel: ${n} Fahrer ${n === 1 ? 'ist' : 'sind'} nicht erschienen (${driverNames.join(', ')}). Kann jemand einspringen?`,
      priority:    'urgent',
      sentByName:  'System',
      expiresInHours: 2,
    });
    broadcastSent = true;
  } catch {
    // messaging-Migration ggf. fehlt — ignorieren
  }

  return { location_id: locationId, detected: driverNames.length, broadcast_sent: broadcastSent, driver_names: driverNames };
}

/** Cron-Wrapper: No-Show-Erkennung für alle aktiven Locations. */
export async function detectAndHandleNoShowsAllLocations(): Promise<{
  locations: number;
  total_detected: number;
  broadcasts_sent: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(20);

  let totalDetected = 0;
  let broadcastsSent = 0;

  for (const loc of locs ?? []) {
    const r = await detectAndHandleNoShows(loc.id as string).catch(() => ({
      detected: 0, broadcast_sent: false, driver_names: [], location_id: loc.id as string,
    }));
    totalDetected  += r.detected;
    if (r.broadcast_sent) broadcastsSent++;
  }

  return { locations: (locs ?? []).length, total_detected: totalDetected, broadcasts_sent: broadcastsSent };
}

/**
 * Schreibt ein 'perfect'-Event für eine Schicht, wenn dort noch keine
 * negativen Events (no_show / late_start / early_end) existieren.
 * Wird nach endShift() als fire-and-forget aufgerufen.
 */
export async function recordPerfectShiftIfClean(
  shiftId: string,
  driverId: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return;

  const { data: existing } = await sb
    .from('driver_shift_events')
    .select('id, event_type')
    .eq('shift_id', shiftId)
    .limit(5);

  if ((existing ?? []).length > 0) return; // bereits Ereignisse für diese Schicht

  await recordShiftEvent({
    driverId,
    locationId,
    shiftId,
    eventType: 'perfect',
    notes:     'Schicht pünktlich gestartet und vollständig abgeschlossen.',
  }).catch(() => {});

  await updateDriverReliabilityScore(driverId, locationId).catch(() => {});
}

/**
 * Schreibt ein 'late_start'-Event wenn Fahrer ≥15 Min nach planned_start eingecheckt hat.
 * Wird von startShift() als fire-and-forget aufgerufen.
 */
export async function recordLateStartIfDelayed(
  shiftId: string,
  driverId: string,
  locationId: string,
  plannedStart: string,
  actualStart: string,
): Promise<void> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return;

  const lateMin = Math.round((new Date(actualStart).getTime() - new Date(plannedStart).getTime()) / 60_000);
  if (lateMin < 15) return; // unter 15 Min → kein Event

  const { data: existing } = await sb
    .from('driver_shift_events')
    .select('id')
    .eq('shift_id', shiftId)
    .in('event_type', ['no_show', 'late_start'])
    .maybeSingle();

  if (existing) return; // bereits ein negativeres Event vorhanden

  await recordShiftEvent({
    driverId,
    locationId,
    shiftId,
    eventType:    'late_start',
    plannedStart,
    actualStart,
    lateMinutes:  lateMin,
    notes:        `Fahrer ${lateMin} Minuten nach Schichtbeginn eingecheckt.`,
  }).catch(() => {});

  await updateDriverReliabilityScore(driverId, locationId).catch(() => {});
}

/** Zuverlässigkeits-Leaderboard — sortiert nach Score absteigend. */
export async function getReliabilityLeaderboard(
  locationId: string,
  limit = 20,
): Promise<ReliabilityScore[]> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return [];

  const { data } = await sb
    .from('driver_reliability_scores')
    .select('driver_id, location_id, score, total_shifts, no_shows, late_starts, early_ends, perfect_shifts, no_show_rate, updated_at, mise_drivers!driver_id(name, vehicle)')
    .eq('location_id', locationId)
    .gt('total_shifts', 0)
    .order('score', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const dArr = row.mise_drivers;
    const d = (Array.isArray(dArr) ? dArr[0] : dArr) as { name?: string | null; vehicle?: string | null } | null;
    const score = row.score as number;
    return {
      driver_id:       row.driver_id as string,
      location_id:     row.location_id as string,
      score,
      total_shifts:    row.total_shifts as number,
      no_shows:        row.no_shows as number,
      late_starts:     row.late_starts as number,
      early_ends:      row.early_ends as number,
      perfect_shifts:  row.perfect_shifts as number,
      no_show_rate:    row.no_show_rate as number,
      updated_at:      row.updated_at as string,
      driver_name:     d?.name ?? null,
      driver_vehicle:  d?.vehicle ?? null,
      reliability_tier: reliabilityTier(score),
    };
  });
}

/** Ereignis-Verlauf eines einzelnen Fahrers. */
export async function getDriverReliabilityHistory(
  driverId: string,
  locationId: string,
  limit = 30,
): Promise<DriverShiftEvent[]> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) return [];

  const { data } = await sb
    .from('driver_shift_events')
    .select('id, driver_id, location_id, shift_id, event_type, planned_start, actual_start, late_minutes, recorded_at, notes')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as DriverShiftEvent[];
}

/** KPI-Summary für Admin-Dashboard. */
export async function getReliabilityStats(locationId: string): Promise<ReliabilityStats> {
  const sb = createServiceClient();
  if (await isMigrationMissing(sb)) {
    return { avg_score: 0, drivers_tracked: 0, no_shows_this_month: 0, perfect_shifts_this_month: 0, reliable_drivers_count: 0, critical_drivers_count: 0 };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [scoresRes, monthRes] = await Promise.all([
    sb
      .from('driver_reliability_scores')
      .select('score')
      .eq('location_id', locationId)
      .gt('total_shifts', 0),
    sb
      .from('driver_shift_events')
      .select('event_type')
      .eq('location_id', locationId)
      .gte('recorded_at', monthStart.toISOString()),
  ]);

  const scores = (scoresRes.data ?? []).map((r) => r.score as number);
  const monthEvents = (monthRes.data ?? []).map((r) => r.event_type as string);

  return {
    avg_score:                 scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    drivers_tracked:           scores.length,
    no_shows_this_month:       monthEvents.filter((e) => e === 'no_show').length,
    perfect_shifts_this_month: monthEvents.filter((e) => e === 'perfect').length,
    reliable_drivers_count:    scores.filter((s) => s >= 80).length,
    critical_drivers_count:    scores.filter((s) => s < 50).length,
  };
}
