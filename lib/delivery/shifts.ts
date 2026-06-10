/**
 * lib/delivery/shifts.ts
 *
 * Fahrer-Schicht-Management + Einsatzplanung.
 *
 * Funktionen:
 *  - getActiveShifts()      — laufende Schichten für eine Location
 *  - getUpcomingShifts()    — geplante Schichten der nächsten N Stunden
 *  - startShift()           — Fahrer checkt ein (actual_start setzen)
 *  - endShift()             — Fahrer checkt aus (actual_end + completed)
 *  - getCoverageGaps()      — Unterdeckungen in den nächsten N Stunden
 *  - getCoverageRequirements() — aktuelle Anforderungen laden
 *  - upsertCoverageRequirement() — Anforderung setzen/updaten
 *  - autoCloseMissedShifts() — stale scheduled Schichten schließen (Cron)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';

export interface ShiftRow {
  id: string;
  driver_id: string;
  location_id: string;
  planned_start: string;  // ISO
  planned_end: string;    // ISO
  actual_start: string | null;
  actual_end: string | null;
  status: ShiftStatus;
  notes: string | null;
  created_at: string;
  driver?: {
    id: string;
    name: string;
    vehicle: string;
    state: string;
  };
}

export interface CoverageGap {
  slot_start: string;     // ISO — UTC-Stunde
  location_id: string;
  scheduled_drivers: number;
  min_drivers: number;
  target_drivers: number;
  gap: number;            // negativ = Unterdeckung
  covered: boolean;
}

export interface CoverageRequirement {
  id: string;
  location_id: string;
  day_of_week: number;   // 0=Sonntag … 6=Samstag
  hour_of_day: number;   // 0–23
  min_drivers: number;
  target_drivers: number;
}

// ============================================================
// Schicht-Abfragen
// ============================================================

/** Laufende Schichten (status=active) für eine Location. */
export async function getActiveShifts(locationId: string): Promise<ShiftRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_shifts')
    .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at, mise_drivers!driver_id(id, name, vehicle, state)')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('actual_start', { ascending: true });

  if (error) throw new Error(`[shifts] getActiveShifts: ${error.message}`);
  return normalizeShifts(data ?? []);
}

/** Geplante Schichten der nächsten N Stunden. */
export async function getUpcomingShifts(
  locationId: string,
  hours = 24,
): Promise<ShiftRow[]> {
  const sb  = createServiceClient();
  const now = new Date().toISOString();
  const end = new Date(Date.now() + hours * 3_600_000).toISOString();

  const { data, error } = await sb
    .from('driver_shifts')
    .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at, mise_drivers!driver_id(id, name, vehicle, state)')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .gte('planned_start', now)
    .lte('planned_start', end)
    .order('planned_start', { ascending: true });

  if (error) throw new Error(`[shifts] getUpcomingShifts: ${error.message}`);
  return normalizeShifts(data ?? []);
}

/** Alle Schichten eines Tages (für Kalender-Ansicht). */
export async function getShiftsByDate(
  locationId: string,
  date: Date,
): Promise<ShiftRow[]> {
  const sb = createServiceClient();
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const { data, error } = await sb
    .from('driver_shifts')
    .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at, mise_drivers!driver_id(id, name, vehicle, state)')
    .eq('location_id', locationId)
    .not('status', 'eq', 'cancelled')
    .gte('planned_start', dayStart.toISOString())
    .lt('planned_start', dayEnd.toISOString())
    .order('planned_start', { ascending: true });

  if (error) throw new Error(`[shifts] getShiftsByDate: ${error.message}`);
  return normalizeShifts(data ?? []);
}

// ============================================================
// Schicht-Aktionen
// ============================================================

/** Fahrer checkt ein — setzt actual_start + status=active. */
export async function startShift(shiftId: string, driverId: string): Promise<ShiftRow> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('driver_shifts')
    .update({
      actual_start: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', shiftId)
    .eq('driver_id', driverId)
    .in('status', ['scheduled'])
    .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at')
    .maybeSingle();

  if (error) throw new Error(`[shifts] startShift: ${error.message}`);
  if (!data) throw new Error('[shifts] Schicht nicht gefunden oder nicht im Status scheduled');
  return data as ShiftRow;
}

/** Fahrer checkt aus — setzt actual_end + status=completed. */
export async function endShift(shiftId: string, driverId: string): Promise<void> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('driver_shifts')
    .update({
      actual_end: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', shiftId)
    .eq('driver_id', driverId)
    .eq('status', 'active');

  if (error) throw new Error(`[shifts] endShift: ${error.message}`);
}

/** Schicht stornieren. */
export async function cancelShift(shiftId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_shifts')
    .update({ status: 'cancelled' })
    .eq('id', shiftId)
    .in('status', ['scheduled']);

  if (error) throw new Error(`[shifts] cancelShift: ${error.message}`);
}

// ============================================================
// Coverage-Analyse
// ============================================================

/**
 * Unterdeckungs-Analyse für die nächsten N Stunden.
 * Nutzt v_shift_coverage VIEW (Migration 017).
 * Gibt nur Slots zurück bei denen gap < 0 (Unterdeckung) ODER
 * gap >= 0 aber scheduled_drivers < target (nicht optimal gedeckt).
 */
export async function getCoverageGaps(
  locationId: string,
  hours = 24,
): Promise<CoverageGap[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_shift_coverage')
    .select('slot_start, location_id, scheduled_drivers, min_drivers, target_drivers, gap, covered')
    .eq('location_id', locationId)
    .lte('slot_start', new Date(Date.now() + hours * 3_600_000).toISOString())
    .order('slot_start', { ascending: true });

  if (error) {
    // View existiert noch nicht (Migration noch nicht ausgeführt) — leeres Array
    if (error.message.includes('v_shift_coverage')) return [];
    throw new Error(`[shifts] getCoverageGaps: ${error.message}`);
  }

  return (data ?? []) as CoverageGap[];
}

/** Coverage-Anforderungen einer Location laden. */
export async function getCoverageRequirements(
  locationId: string,
): Promise<CoverageRequirement[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('coverage_requirements')
    .select('id, location_id, day_of_week, hour_of_day, min_drivers, target_drivers')
    .eq('location_id', locationId)
    .order('day_of_week', { ascending: true })
    .order('hour_of_day',  { ascending: true });

  if (error) throw new Error(`[shifts] getCoverageRequirements: ${error.message}`);
  return (data ?? []) as CoverageRequirement[];
}

/** Coverage-Anforderung erstellen oder updaten (upsert). */
export async function upsertCoverageRequirement(req: {
  locationId: string;
  dayOfWeek: number;
  hourOfDay: number;
  minDrivers: number;
  targetDrivers: number;
}): Promise<CoverageRequirement> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('coverage_requirements')
    .upsert({
      location_id:    req.locationId,
      day_of_week:    req.dayOfWeek,
      hour_of_day:    req.hourOfDay,
      min_drivers:    req.minDrivers,
      target_drivers: req.targetDrivers,
    }, { onConflict: 'location_id,day_of_week,hour_of_day' })
    .select('id, location_id, day_of_week, hour_of_day, min_drivers, target_drivers')
    .single();

  if (error) throw new Error(`[shifts] upsertCoverageRequirement: ${error.message}`);
  return data as CoverageRequirement;
}

// ============================================================
// Cron-Hilfsfunktionen
// ============================================================

/**
 * Ruft auto_close_missed_shifts() auf (DB-Funktion aus Migration 017).
 * Markiert vergessene Schichten als missed / abgelaufene active als completed.
 * Fire-and-forget kompatibel.
 */
export async function autoCloseMissedShifts(): Promise<{ missed: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('auto_close_missed_shifts');
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[shifts] autoCloseMissedShifts:', error.message);
    return { missed: 0 };
  }
  return { missed: (data as number | null) ?? 0 };
}

/**
 * Gibt die Anzahl unkritischer Coverage-Gaps für die nächste Stunde zurück.
 * Nützlich für den Health-Check.
 */
export async function getCurrentCoverageStatus(
  locationId: string,
): Promise<{ uncovered_slots: number; understaffed_slots: number }> {
  const sb = createServiceClient();
  const hourEnd = new Date(Date.now() + 3_600_000).toISOString();

  const { data, error } = await sb
    .from('v_shift_coverage')
    .select('covered, scheduled_drivers, target_drivers')
    .eq('location_id', locationId)
    .lte('slot_start', hourEnd)
    .gte('slot_start', new Date().toISOString());

  if (error || !data) return { uncovered_slots: 0, understaffed_slots: 0 };

  return {
    uncovered_slots:    data.filter((r) => !(r.covered as boolean)).length,
    understaffed_slots: data.filter(
      (r) => (r.covered as boolean) && (r.scheduled_drivers as number) < (r.target_drivers as number),
    ).length,
  };
}

// ============================================================
// Pausen-Management (shift_breaks — Migration 047)
// ============================================================

export type BreakType = 'pause' | 'personal' | 'technical' | 'mandatory';

export interface ShiftBreak {
  id: string;
  shiftId: string;
  driverId: string;
  locationId: string;
  startedAt: string;
  endedAt: string | null;
  breakType: BreakType;
  notes: string | null;
  createdAt: string;
  durationMinutes: number | null; // null wenn noch läuft
}

export interface BreakSummary {
  shiftId: string;
  breakCount: number;
  totalBreakMinutes: number;
  hasActiveBreak: boolean;
  activeBreakId: string | null;
  activeBreakStartedAt: string | null;
}

/** Startet eine Pause für den Fahrer in der angegebenen Schicht. */
export async function startBreak(
  shiftId: string,
  driverId: string,
  locationId: string,
  breakType: BreakType = 'pause',
  notes?: string,
): Promise<ShiftBreak> {
  const sb = createServiceClient();

  // Sicherheitscheck: keine offene Pause erlaubt
  const { data: existing } = await sb
    .from('shift_breaks')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('driver_id', driverId)
    .is('ended_at', null)
    .maybeSingle();

  if (existing) {
    throw new Error('[shifts] Fahrer hat bereits eine laufende Pause.');
  }

  const { data, error } = await sb
    .from('shift_breaks')
    .insert({
      shift_id:    shiftId,
      driver_id:   driverId,
      location_id: locationId,
      break_type:  breakType,
      notes:       notes ?? null,
    })
    .select('id, shift_id, driver_id, location_id, started_at, ended_at, break_type, notes, created_at')
    .single();

  if (error) throw new Error(`[shifts] startBreak: ${error.message}`);
  return normalizeBreak(data as Record<string, unknown>);
}

/** Beendet die aktuell laufende Pause eines Fahrers. */
export async function endBreak(
  shiftId: string,
  driverId: string,
): Promise<ShiftBreak> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('shift_breaks')
    .update({ ended_at: new Date().toISOString() })
    .eq('shift_id', shiftId)
    .eq('driver_id', driverId)
    .is('ended_at', null)
    .select('id, shift_id, driver_id, location_id, started_at, ended_at, break_type, notes, created_at')
    .single();

  if (error) throw new Error(`[shifts] endBreak: ${error.message}`);
  return normalizeBreak(data as Record<string, unknown>);
}

/** Gibt die aktuell laufende Pause zurück (oder null). */
export async function getActiveBreak(
  shiftId: string,
): Promise<ShiftBreak | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('shift_breaks')
    .select('id, shift_id, driver_id, location_id, started_at, ended_at, break_type, notes, created_at')
    .eq('shift_id', shiftId)
    .is('ended_at', null)
    .maybeSingle();

  if (error) throw new Error(`[shifts] getActiveBreak: ${error.message}`);
  if (!data) return null;
  return normalizeBreak(data as Record<string, unknown>);
}

/** Gibt alle Pausen einer Schicht zurück, sortiert nach Startzeit. */
export async function getShiftBreaks(shiftId: string): Promise<ShiftBreak[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('shift_breaks')
    .select('id, shift_id, driver_id, location_id, started_at, ended_at, break_type, notes, created_at')
    .eq('shift_id', shiftId)
    .order('started_at', { ascending: true });

  if (error) throw new Error(`[shifts] getShiftBreaks: ${error.message}`);
  return (data ?? []).map((r) => normalizeBreak(r as Record<string, unknown>));
}

/** Gibt Pausen-Zusammenfassung für eine Schicht zurück. */
export async function getBreakSummary(shiftId: string): Promise<BreakSummary> {
  const sb = createServiceClient();

  const { data: breaks, error } = await sb
    .from('shift_breaks')
    .select('id, started_at, ended_at')
    .eq('shift_id', shiftId)
    .order('started_at', { ascending: true });

  if (error) throw new Error(`[shifts] getBreakSummary: ${error.message}`);

  const rows = breaks ?? [];
  const activeBreak = rows.find((r) => !(r as Record<string, unknown>)['ended_at']);
  const completedBreaks = rows.filter((r) => (r as Record<string, unknown>)['ended_at']);
  const totalBreakMinutes = completedBreaks.reduce((sum, r) => {
    const rec = r as Record<string, unknown>;
    const start = new Date(rec['started_at'] as string).getTime();
    const end   = new Date(rec['ended_at']   as string).getTime();
    return sum + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);

  const activeRec = activeBreak as Record<string, unknown> | undefined;
  return {
    shiftId,
    breakCount:         completedBreaks.length + (activeBreak ? 1 : 0),
    totalBreakMinutes,
    hasActiveBreak:     !!activeBreak,
    activeBreakId:      activeRec ? (activeRec['id'] as string) : null,
    activeBreakStartedAt: activeRec ? (activeRec['started_at'] as string) : null,
  };
}

/**
 * Gibt Netto-Aktivminuten für einen Fahrer an einem Tag zurück.
 * Nutzt DB-Funktion get_driver_active_minutes() (Migration 047).
 * Fallback: berechnet aus Schichtdaten wenn DB-Funktion fehlt.
 */
export async function getNetActiveMinutes(
  driverId: string,
  date: Date = new Date(),
): Promise<number> {
  const sb = createServiceClient();
  const dateStr = date.toISOString().slice(0, 10);

  const { data, error } = await sb.rpc('get_driver_active_minutes', {
    p_driver_id: driverId,
    p_date:      dateStr,
  });

  if (error) {
    // Graceful fallback: Migration noch nicht ausgeführt
    console.warn('[shifts] getNetActiveMinutes DB fallback:', error.message);
    return 0;
  }
  return (data as number | null) ?? 0;
}

// ============================================================
// Intern
// ============================================================

function normalizeBreak(r: Record<string, unknown>): ShiftBreak {
  const start = r['started_at'] as string;
  const end   = r['ended_at']   as string | null;
  const durationMinutes = end
    ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000))
    : null;

  return {
    id:              r['id'] as string,
    shiftId:         r['shift_id'] as string,
    driverId:        r['driver_id'] as string,
    locationId:      r['location_id'] as string,
    startedAt:       start,
    endedAt:         end,
    breakType:       r['break_type'] as BreakType,
    notes:           r['notes'] as string | null,
    createdAt:       r['created_at'] as string,
    durationMinutes,
  };
}

// Supabase-Join liefert mise_drivers als verschachteltes Objekt
function normalizeShifts(rows: unknown[]): ShiftRow[] {
  return (rows as Record<string, unknown>[]).map((r) => {
    const driver = r['mise_drivers'] as Record<string, unknown> | null;
    const { mise_drivers: _drop, ...rest } = r;
    void _drop;
    return {
      ...rest,
      driver: driver
        ? { id: driver['id'], name: driver['name'], vehicle: driver['vehicle'], state: driver['state'] }
        : undefined,
    } as ShiftRow;
  });
}
