/**
 * lib/delivery/driver-absences.ts
 *
 * Phase 353: Smart Driver Absence & Vacation Management Engine
 *
 * Verwaltet Abwesenheits- und Urlaubsanfragen der Fahrer.
 * Integriert mit Schichtplanung und Coverage-Analyse.
 *
 * Typen:
 *   sick_day      — Krankmeldung (auto-genehmigt wenn konfiguriert)
 *   vacation      — Urlaub (erfordert Genehmigung)
 *   personal_day  — Persönlicher Tag
 *   training      — Schulung / Weiterbildung
 *   other         — Sonstiges
 *
 * Public API:
 *   getConfig / upsertConfig                    — Konfiguration
 *   submitAbsenceRequest(...)                   — Anfrage einreichen
 *   approveAbsence / rejectAbsence              — Admin-Entscheidung
 *   cancelAbsence                               — Fahrer storniert
 *   isDriverAbsentToday(driverId, locationId)   — Dispatch-Check
 *   getTodaysAbsences(locationId)               — Heute abwesend
 *   getUpcomingAbsences(locationId, days)       — Kommende Abwesenheiten
 *   getDriverAbsenceBalance(driverId, ...)      — Jahres-Kontingent
 *   getCoverageImpact(locationId, from, to)     — Coverage-Analyse
 *   getDashboard(locationId)                    — Admin-Dashboard
 *   pruneOldAbsences(daysToKeep)                — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type AbsenceType = 'sick_day' | 'vacation' | 'personal_day' | 'training' | 'other';
export type AbsenceStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AbsenceConfig {
  id: string;
  locationId: string;
  isEnabled: boolean;
  requiresApproval: boolean;
  maxVacationDaysPerYear: number;
  maxSickDaysPerYear: number;
  minNoticeDays: number;
  autoApproveSickDays: boolean;
}

export interface AbsenceRow {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  driverVehicle: string | null;
  absenceType: AbsenceType;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  daysCount: number;
  status: AbsenceStatus;
  reason: string | null;
  adminNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AbsenceBalance {
  driverId: string;
  year: number;
  vacationUsed: number;
  vacationRemaining: number;
  sickDaysUsed: number;
  sickDaysRemaining: number;
  personalDaysUsed: number;
  trainingDaysUsed: number;
  totalAbsenceDays: number;
}

export interface CoverageImpact {
  date: string;         // YYYY-MM-DD
  absentDrivers: number;
  scheduledDrivers: number;
  availabilityPct: number;
  risk: 'low' | 'medium' | 'high';
}

export interface AbsenceDashboard {
  config: AbsenceConfig;
  todayAbsent: number;
  pendingRequests: number;
  approvedThisWeek: number;
  availabilityPct: number;
  todaysAbsences: AbsenceRow[];
  upcomingAbsences: AbsenceRow[];
  pendingAbsences: AbsenceRow[];
  coverageImpact: CoverageImpact[];
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function normalizeRow(r: Record<string, unknown>): AbsenceRow {
  const driver = r['mise_drivers'] as Record<string, unknown> | null;
  return {
    id: r['id'] as string,
    locationId: r['location_id'] as string,
    driverId: r['driver_id'] as string,
    driverName: (driver?.['name'] as string | null) ?? null,
    driverVehicle: (driver?.['vehicle'] as string | null) ?? null,
    absenceType: r['absence_type'] as AbsenceType,
    startDate: r['start_date'] as string,
    endDate: r['end_date'] as string,
    daysCount: r['days_count'] as number,
    status: r['status'] as AbsenceStatus,
    reason: (r['reason'] as string | null) ?? null,
    adminNotes: (r['admin_notes'] as string | null) ?? null,
    approvedBy: (r['approved_by'] as string | null) ?? null,
    approvedAt: (r['approved_at'] as string | null) ?? null,
    createdAt: r['created_at'] as string,
  };
}

const SELECT_COLS = 'id,location_id,driver_id,absence_type,start_date,end_date,days_count,status,reason,admin_notes,approved_by,approved_at,created_at,mise_drivers!driver_id(name,vehicle)';

// ── Konfiguration ─────────────────────────────────────────────────────────────

export async function getConfig(locationId: string): Promise<AbsenceConfig> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_absence_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    await svc.from('driver_absence_config').insert({ location_id: locationId });
    return getConfig(locationId);
  }

  const r = data as Record<string, unknown>;
  return {
    id: r['id'] as string,
    locationId: r['location_id'] as string,
    isEnabled: r['is_enabled'] as boolean,
    requiresApproval: r['requires_approval'] as boolean,
    maxVacationDaysPerYear: r['max_vacation_days_per_year'] as number,
    maxSickDaysPerYear: r['max_sick_days_per_year'] as number,
    minNoticeDays: r['min_notice_days'] as number,
    autoApproveSickDays: r['auto_approve_sick_days'] as boolean,
  };
}

export async function upsertConfig(
  locationId: string,
  patch: Partial<Omit<AbsenceConfig, 'id' | 'locationId'>>,
): Promise<AbsenceConfig> {
  const svc = createServiceClient();
  await svc.from('driver_absence_config').upsert(
    {
      location_id: locationId,
      ...(patch.isEnabled !== undefined && { is_enabled: patch.isEnabled }),
      ...(patch.requiresApproval !== undefined && { requires_approval: patch.requiresApproval }),
      ...(patch.maxVacationDaysPerYear !== undefined && { max_vacation_days_per_year: patch.maxVacationDaysPerYear }),
      ...(patch.maxSickDaysPerYear !== undefined && { max_sick_days_per_year: patch.maxSickDaysPerYear }),
      ...(patch.minNoticeDays !== undefined && { min_notice_days: patch.minNoticeDays }),
      ...(patch.autoApproveSickDays !== undefined && { auto_approve_sick_days: patch.autoApproveSickDays }),
    },
    { onConflict: 'location_id' },
  );
  return getConfig(locationId);
}

// ── Anfrage einreichen ────────────────────────────────────────────────────────

export async function submitAbsenceRequest(
  driverId: string,
  locationId: string,
  absenceType: AbsenceType,
  startDate: string,
  endDate: string,
  reason?: string,
): Promise<{ id: string; autoApproved: boolean }> {
  const svc = createServiceClient();
  const cfg = await getConfig(locationId);

  // Kollisions-Check: Überschneidung mit vorhandener genehmigter Abwesenheit
  const { data: clash } = await svc
    .from('driver_absences')
    .select('id')
    .eq('driver_id', driverId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);

  if (clash && clash.length > 0) {
    throw new Error('Überschneidung mit bestehender Abwesenheitsanfrage');
  }

  const autoApprove = absenceType === 'sick_day' && cfg.autoApproveSickDays;

  const { data: inserted, error } = await svc
    .from('driver_absences')
    .insert({
      driver_id: driverId,
      location_id: locationId,
      absence_type: absenceType,
      start_date: startDate,
      end_date: endDate,
      reason: reason ?? null,
      status: autoApprove ? 'approved' : 'pending',
      approved_at: autoApprove ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`[driver-absences] submit: ${error?.message}`);

  return { id: (inserted as Record<string, unknown>)['id'] as string, autoApproved: autoApprove };
}

// ── Admin-Entscheidungen ──────────────────────────────────────────────────────

export async function approveAbsence(
  id: string,
  locationId: string,
  adminId: string,
  adminNotes?: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('driver_absences')
    .update({
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    })
    .eq('id', id)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  if (error) throw new Error(`[driver-absences] approve: ${error.message}`);
}

export async function rejectAbsence(
  id: string,
  locationId: string,
  adminId: string,
  adminNotes?: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('driver_absences')
    .update({
      status: 'rejected',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    })
    .eq('id', id)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  if (error) throw new Error(`[driver-absences] reject: ${error.message}`);
}

export async function cancelAbsence(id: string, driverId: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('driver_absences')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('driver_id', driverId)
    .in('status', ['pending', 'approved']);

  if (error) throw new Error(`[driver-absences] cancel: ${error.message}`);
}

// ── Dispatch-Check ────────────────────────────────────────────────────────────

export async function isDriverAbsentToday(driverId: string, locationId: string): Promise<boolean> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await svc
    .from('driver_absences')
    .select('id')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1);

  return (data ?? []).length > 0;
}

// ── Abfragen ──────────────────────────────────────────────────────────────────

export async function getTodaysAbsences(locationId: string): Promise<AbsenceRow[]> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await svc
    .from('driver_absences')
    .select(SELECT_COLS)
    .eq('location_id', locationId)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('absence_type', { ascending: true });

  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function getUpcomingAbsences(locationId: string, days = 14): Promise<AbsenceRow[]> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const { data } = await svc
    .from('driver_absences')
    .select(SELECT_COLS)
    .eq('location_id', locationId)
    .in('status', ['approved', 'pending'])
    .gt('start_date', today)
    .lte('start_date', until)
    .order('start_date', { ascending: true });

  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function getPendingAbsences(locationId: string): Promise<AbsenceRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_absences')
    .select(SELECT_COLS)
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function getDriverAbsences(
  driverId: string,
  locationId: string,
  year: number,
): Promise<AbsenceRow[]> {
  const svc = createServiceClient();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const { data } = await svc
    .from('driver_absences')
    .select(SELECT_COLS)
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('start_date', from)
    .lte('end_date', to)
    .order('start_date', { ascending: false });

  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

// ── Jahres-Kontingent ─────────────────────────────────────────────────────────

export async function getDriverAbsenceBalance(
  driverId: string,
  locationId: string,
  year?: number,
): Promise<AbsenceBalance> {
  const cfg = await getConfig(locationId);
  const y = year ?? new Date().getFullYear();
  const rows = await getDriverAbsences(driverId, locationId, y);
  const approved = rows.filter((r) => r.status === 'approved');

  const vacationUsed = approved
    .filter((r) => r.absenceType === 'vacation')
    .reduce((s, r) => s + r.daysCount, 0);
  const sickDaysUsed = approved
    .filter((r) => r.absenceType === 'sick_day')
    .reduce((s, r) => s + r.daysCount, 0);
  const personalDaysUsed = approved
    .filter((r) => r.absenceType === 'personal_day')
    .reduce((s, r) => s + r.daysCount, 0);
  const trainingDaysUsed = approved
    .filter((r) => r.absenceType === 'training')
    .reduce((s, r) => s + r.daysCount, 0);

  return {
    driverId,
    year: y,
    vacationUsed,
    vacationRemaining: Math.max(0, cfg.maxVacationDaysPerYear - vacationUsed),
    sickDaysUsed,
    sickDaysRemaining: Math.max(0, cfg.maxSickDaysPerYear - sickDaysUsed),
    personalDaysUsed,
    trainingDaysUsed,
    totalAbsenceDays: vacationUsed + sickDaysUsed + personalDaysUsed + trainingDaysUsed,
  };
}

// ── Coverage-Impact-Analyse ───────────────────────────────────────────────────

export async function getCoverageImpact(
  locationId: string,
  fromDate: string,
  toDate: string,
): Promise<CoverageImpact[]> {
  const svc = createServiceClient();

  const { data: absences } = await svc
    .from('driver_absences')
    .select('start_date,end_date')
    .eq('location_id', locationId)
    .eq('status', 'approved')
    .lte('start_date', toDate)
    .gte('end_date', fromDate);

  const { count: totalDrivers } = await svc
    .from('mise_drivers')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('is_active', true);

  const total = totalDrivers ?? 1;
  const rows = absences ?? [];

  const result: CoverageImpact[] = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const absent = rows.filter((r) => {
      const s = (r as Record<string, unknown>)['start_date'] as string;
      const e = (r as Record<string, unknown>)['end_date'] as string;
      return s <= dateStr && e >= dateStr;
    }).length;

    const availPct = total > 0 ? Math.round(((total - absent) / total) * 100) : 100;
    const risk: CoverageImpact['risk'] =
      availPct < 50 ? 'high' : availPct < 75 ? 'medium' : 'low';

    result.push({
      date: dateStr,
      absentDrivers: absent,
      scheduledDrivers: total,
      availabilityPct: availPct,
      risk,
    });
  }

  return result;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<AbsenceDashboard> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [cfg, todaysAbsences, upcomingAbsences, pendingAbsences] = await Promise.all([
    getConfig(locationId),
    getTodaysAbsences(locationId),
    getUpcomingAbsences(locationId, 14),
    getPendingAbsences(locationId),
  ]);

  const { data: approvedThisWeek } = await svc
    .from('driver_absences')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'approved')
    .gte('approved_at', weekStart)
    .lte('approved_at', weekEnd);

  const { count: totalDrivers } = await svc
    .from('mise_drivers')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('is_active', true);

  const total = totalDrivers ?? 0;
  const availabilityPct = total > 0
    ? Math.round(((total - todaysAbsences.length) / total) * 100)
    : 100;

  const coverageImpact = await getCoverageImpact(locationId, today, weekEnd);

  return {
    config: cfg,
    todayAbsent: todaysAbsences.length,
    pendingRequests: pendingAbsences.length,
    approvedThisWeek: (approvedThisWeek as number | null) ?? 0,
    availabilityPct,
    todaysAbsences,
    upcomingAbsences,
    pendingAbsences,
    coverageImpact,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldAbsences(daysToKeep = 365): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_driver_absences', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
