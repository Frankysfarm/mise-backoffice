/**
 * lib/delivery/shift-extension.ts — Phase 383
 *
 * Smart Shift Extension & Overtime Alert Engine
 *
 * Erkennt Fahrer, deren geplante Schicht bald endet, während noch Bestellungen
 * ausstehen. Erstellt automatisch Verlängerungsanfragen und erlaubt Dispatch,
 * diese zu genehmigen oder abzulehnen. Snapshotter die tägliche Überstunden-
 * Statistik je Standort für ROI-Tracking.
 *
 * Overtime-Risiko-Kriterien (auto-detect):
 *  - Fahrer mit status='active' in driver_shifts, planned_end in ≤30 Min
 *  - Fahrer hat noch Stops in aktiver Batch (status NOT IN completed/cancelled)
 *  - Kein offenes 'pending'-Request für dieselbe Schicht
 *
 * Public API:
 *  detectOvertimeRisk(locationId)               — Risiko-Liste für Dashboard
 *  autoDetectAndRequestExtensions(locationId)   — auto-create pending-Requests
 *  autoDetectAllLocations()                     — Cron-Batch
 *  approveExtensionRequest(requestId, locationId, decidedBy?)
 *  declineExtensionRequest(requestId, locationId, decidedBy?)
 *  expireStaleRequests(locationId)              — abgelaufene → 'expired'
 *  recordDailyOvertimeSummary(locationId, date?)
 *  recordDailyOvertimeSummaryAllLocations()     — Cron-Batch (täglich 23:50 UTC)
 *  getOvertimeDashboard(locationId)
 *  pruneOldRequests(daysOld?)                   — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExtensionStatus = 'pending' | 'approved' | 'declined' | 'expired';

export interface OvertimeRisk {
  shiftId:        string;
  driverId:       string;
  driverName:     string | null;
  driverVehicle:  string | null;
  plannedEnd:     string;
  minutesLeft:    number;
  activeBatchId:  string | null;
  remainingStops: number;
  hasOpenRequest: boolean;
}

export interface ExtensionRequest {
  id:            string;
  locationId:    string;
  shiftId:       string;
  driverId:      string;
  driverName:    string | null;
  driverVehicle: string | null;
  plannedEnd:    string;
  extraMinutes:  number;
  reason:        string | null;
  autoDetected:  boolean;
  status:        ExtensionStatus;
  requestedAt:   string;
  decidedAt:     string | null;
}

export interface OvertimeSummaryRow {
  locationId:        string;
  summaryDate:       string;
  affectedDrivers:   number;
  totalOvertimeMin:  number;
  avgOvertimeMin:    number | null;
  extensionRequests: number;
  approvedRequests:  number;
  estimatedCostEur:  number | null;
}

export interface OvertimeDashboard {
  activeRisks:       OvertimeRisk[];
  openRequests:      ExtensionRequest[];
  todaySummary:      OvertimeSummaryRow | null;
  last7DaysSummary:  OvertimeSummaryRow[];
  weeklyOvertimeMin: number;
  weeklyApprovedReqs:number;
}

export interface AutoDetectResult {
  locationId:       string;
  risksFound:       number;
  requestsCreated:  number;
  errors:           number;
}

export interface AllLocationsResult {
  locations:       number;
  risksFound:      number;
  requestsCreated: number;
  errors:          number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Warn-Schwelle: Schicht endet in ≤ 30 Min
const WARN_THRESHOLD_MIN = 30;
// Empfohlene Verlängerung: 20 Min pauschal (Dispatcher kann manuell anpassen)
const DEFAULT_EXTENSION_MIN = 20;

// ── detectOvertimeRisk ────────────────────────────────────────────────────────

export async function detectOvertimeRisk(locationId: string): Promise<OvertimeRisk[]> {
  const supabase = createServiceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() + WARN_THRESHOLD_MIN * 60_000);

  // Active shifts ending soon
  const { data: shifts, error: shiftErr } = await supabase
    .from('driver_shifts')
    .select('id, driver_id, planned_end, mise_drivers!driver_id(id, name, vehicle)')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .lte('planned_end', cutoff.toISOString())
    .gte('planned_end', now.toISOString());

  if (shiftErr || !shifts?.length) return [];

  const risks: OvertimeRisk[] = [];

  for (const shift of shifts) {
    const driver = shift['mise_drivers'] as Record<string, unknown> | null;
    const driverId = shift.driver_id as string;

    // Check active batch for this driver
    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('id, stops')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .not('status', 'in', '("completed","cancelled","failed")')
      .order('created_at', { ascending: false })
      .limit(1);

    const batch = batches?.[0] ?? null;
    const stops = (batch?.stops as unknown[]) ?? [];
    const remainingStops = stops.filter((s) => {
      const stop = s as Record<string, unknown>;
      return stop['status'] !== 'delivered' && stop['status'] !== 'failed';
    }).length;

    if (remainingStops === 0) continue; // kein Risiko — Fahrer ist gleich fertig

    // Check for existing open request
    const { data: existing } = await supabase
      .from('shift_extension_requests')
      .select('id')
      .eq('shift_id', shift.id)
      .eq('status', 'pending')
      .limit(1);

    const minutesLeft = Math.max(
      0,
      Math.round((new Date(shift.planned_end as string).getTime() - now.getTime()) / 60_000),
    );

    risks.push({
      shiftId:       shift.id as string,
      driverId,
      driverName:    driver ? (driver['name'] as string | null) : null,
      driverVehicle: driver ? (driver['vehicle'] as string | null) : null,
      plannedEnd:    shift.planned_end as string,
      minutesLeft,
      activeBatchId: batch?.id ?? null,
      remainingStops,
      hasOpenRequest: (existing?.length ?? 0) > 0,
    });
  }

  return risks;
}

// ── autoDetectAndRequestExtensions ───────────────────────────────────────────

export async function autoDetectAndRequestExtensions(
  locationId: string,
): Promise<AutoDetectResult> {
  const supabase = createServiceClient();
  const risks = await detectOvertimeRisk(locationId);
  let created = 0;
  let errors = 0;

  for (const risk of risks) {
    if (risk.hasOpenRequest) continue;

    const { error } = await supabase.from('shift_extension_requests').insert({
      location_id:   locationId,
      shift_id:      risk.shiftId,
      driver_id:     risk.driverId,
      extra_minutes: DEFAULT_EXTENSION_MIN,
      reason:        `Auto-erkannt: ${risk.remainingStops} offene Stopps, Schicht endet in ${risk.minutesLeft} Min`,
      auto_detected: true,
      status:        'pending',
    });

    if (error) errors++;
    else created++;
  }

  return {
    locationId,
    risksFound:      risks.length,
    requestsCreated: created,
    errors,
  };
}

// ── autoDetectAllLocations ────────────────────────────────────────────────────

export async function autoDetectAllLocations(): Promise<AllLocationsResult> {
  const supabase = createServiceClient();

  const { data: locs } = await supabase
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, risksFound: 0, requestsCreated: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => autoDetectAndRequestExtensions(l.id as string)),
  );

  return results.reduce(
    (acc, r) => {
      if (r.status === 'fulfilled') {
        acc.locations++;
        acc.risksFound      += r.value.risksFound;
        acc.requestsCreated += r.value.requestsCreated;
        acc.errors          += r.value.errors;
      } else {
        acc.errors++;
      }
      return acc;
    },
    { locations: 0, risksFound: 0, requestsCreated: 0, errors: 0 },
  );
}

// ── approveExtensionRequest ───────────────────────────────────────────────────

export async function approveExtensionRequest(
  requestId: string,
  locationId: string,
  decidedBy?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: req, error: fetchErr } = await supabase
    .from('shift_extension_requests')
    .select('id, shift_id, extra_minutes, status')
    .eq('id', requestId)
    .eq('location_id', locationId)
    .single();

  if (fetchErr || !req) return { ok: false, error: 'Request nicht gefunden' };
  if ((req.status as string) !== 'pending') return { ok: false, error: 'Nur pending-Requests können genehmigt werden' };

  // Update request status
  const { error: updErr } = await supabase
    .from('shift_extension_requests')
    .update({
      status:     'approved',
      decided_by: decidedBy ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updErr) return { ok: false, error: updErr.message };

  // Extend planned_end on the shift
  const { data: shift } = await supabase
    .from('driver_shifts')
    .select('planned_end')
    .eq('id', req.shift_id as string)
    .single();

  if (shift?.planned_end) {
    const newEnd = new Date(
      new Date(shift.planned_end as string).getTime() + (req.extra_minutes as number) * 60_000,
    );
    await supabase
      .from('driver_shifts')
      .update({ planned_end: newEnd.toISOString() })
      .eq('id', req.shift_id as string);
  }

  return { ok: true };
}

// ── declineExtensionRequest ───────────────────────────────────────────────────

export async function declineExtensionRequest(
  requestId: string,
  locationId: string,
  decidedBy?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('shift_extension_requests')
    .update({
      status:     'declined',
      decided_by: decidedBy ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── expireStaleRequests ───────────────────────────────────────────────────────

export async function expireStaleRequests(locationId: string): Promise<{ expired: number }> {
  const supabase = createServiceClient();
  // Requests älter als 2 Stunden ohne Entscheidung → expired
  const cutoff = new Date(Date.now() - 2 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from('shift_extension_requests')
    .update({ status: 'expired', decided_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .lt('requested_at', cutoff)
    .select('id');

  if (error) return { expired: 0 };
  return { expired: data?.length ?? 0 };
}

// ── recordDailyOvertimeSummary ────────────────────────────────────────────────

export async function recordDailyOvertimeSummary(
  locationId: string,
  date?: string,
): Promise<{ ok: boolean; saved: boolean }> {
  const supabase = createServiceClient();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const dayStart = `${targetDate}T00:00:00Z`;
  const dayEnd   = `${targetDate}T23:59:59Z`;

  // Count overtime from completed shifts today (actual_end > planned_end)
  const { data: shifts } = await supabase
    .from('driver_shifts')
    .select('id, planned_end, actual_end, driver_id')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .gte('actual_end', dayStart)
    .lte('actual_end', dayEnd);

  const overtimeShifts = (shifts ?? []).filter((s) => {
    const planned = new Date(s.planned_end as string).getTime();
    const actual  = new Date(s.actual_end  as string).getTime();
    return actual > planned;
  });

  const totalOvertimeMin = overtimeShifts.reduce((sum, s) => {
    const diff = Math.round(
      (new Date(s.actual_end  as string).getTime() -
       new Date(s.planned_end as string).getTime()) / 60_000,
    );
    return sum + Math.max(0, diff);
  }, 0);

  const affectedDrivers = new Set(overtimeShifts.map((s) => s.driver_id as string)).size;
  const avgOvertimeMin  = affectedDrivers > 0 ? totalOvertimeMin / affectedDrivers : null;

  // Count extension requests for today
  const { data: reqs } = await supabase
    .from('shift_extension_requests')
    .select('id, status')
    .eq('location_id', locationId)
    .gte('requested_at', dayStart)
    .lte('requested_at', dayEnd);

  const extensionRequests = reqs?.length ?? 0;
  const approvedRequests  = reqs?.filter((r) => (r.status as string) === 'approved').length ?? 0;

  // Rough cost estimate: assume €12/h base wage
  const estimatedCostEur = totalOvertimeMin > 0
    ? Math.round((totalOvertimeMin / 60) * 12 * 100) / 100
    : null;

  const { error } = await supabase
    .from('driver_overtime_summary')
    .upsert(
      {
        location_id:        locationId,
        summary_date:       targetDate,
        affected_drivers:   affectedDrivers,
        total_overtime_min: totalOvertimeMin,
        avg_overtime_min:   avgOvertimeMin,
        extension_requests: extensionRequests,
        approved_requests:  approvedRequests,
        estimated_cost_eur: estimatedCostEur,
      },
      { onConflict: 'location_id,summary_date' },
    );

  return { ok: !error, saved: !error };
}

export async function recordDailyOvertimeSummaryAllLocations(): Promise<{
  locations: number;
  saved: number;
  errors: number;
}> {
  const supabase = createServiceClient();

  const { data: locs } = await supabase
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => recordDailyOvertimeSummary(l.id as string)),
  );

  return results.reduce(
    (acc, r) => {
      acc.locations++;
      if (r.status === 'fulfilled' && r.value.saved) acc.saved++;
      else acc.errors++;
      return acc;
    },
    { locations: 0, saved: 0, errors: 0 },
  );
}

// ── getOvertimeDashboard ──────────────────────────────────────────────────────

export async function getOvertimeDashboard(locationId: string): Promise<OvertimeDashboard> {
  const supabase = createServiceClient();

  const [risks, openRequestsRes, todayRes, weekRes] = await Promise.all([
    detectOvertimeRisk(locationId),

    supabase
      .from('shift_extension_requests')
      .select('id, location_id, shift_id, driver_id, extra_minutes, reason, auto_detected, status, requested_at, decided_at, driver_shifts!shift_id(planned_end), mise_drivers!driver_id(name, vehicle)')
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),

    supabase
      .from('driver_overtime_summary')
      .select('*')
      .eq('location_id', locationId)
      .eq('summary_date', new Date().toISOString().slice(0, 10))
      .single(),

    supabase
      .from('driver_overtime_summary')
      .select('*')
      .eq('location_id', locationId)
      .gte('summary_date', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
      .order('summary_date', { ascending: false }),
  ]);

  const openRequests: ExtensionRequest[] = (openRequestsRes.data ?? []).map((r) => {
    const drv = r['mise_drivers'] as Record<string, unknown> | null;
    const shf = r['driver_shifts'] as Record<string, unknown> | null;
    return {
      id:            r.id as string,
      locationId:    r.location_id as string,
      shiftId:       r.shift_id as string,
      driverId:      r.driver_id as string,
      driverName:    drv ? (drv['name'] as string | null) : null,
      driverVehicle: drv ? (drv['vehicle'] as string | null) : null,
      plannedEnd:    shf ? (shf['planned_end'] as string) : '',
      extraMinutes:  r.extra_minutes as number,
      reason:        r.reason as string | null,
      autoDetected:  r.auto_detected as boolean,
      status:        r.status as ExtensionStatus,
      requestedAt:   r.requested_at as string,
      decidedAt:     r.decided_at as string | null,
    };
  });

  const mapSummaryRow = (r: Record<string, unknown>): OvertimeSummaryRow => ({
    locationId:        r['location_id'] as string,
    summaryDate:       r['summary_date'] as string,
    affectedDrivers:   (r['affected_drivers'] as number) ?? 0,
    totalOvertimeMin:  (r['total_overtime_min'] as number) ?? 0,
    avgOvertimeMin:    r['avg_overtime_min'] != null ? Number(r['avg_overtime_min']) : null,
    extensionRequests: (r['extension_requests'] as number) ?? 0,
    approvedRequests:  (r['approved_requests'] as number) ?? 0,
    estimatedCostEur:  r['estimated_cost_eur'] != null ? Number(r['estimated_cost_eur']) : null,
  });

  const last7DaysSummary = (weekRes.data ?? []).map((r) =>
    mapSummaryRow(r as Record<string, unknown>),
  );

  const weeklyOvertimeMin = last7DaysSummary.reduce((s, r) => s + r.totalOvertimeMin, 0);
  const weeklyApprovedReqs = last7DaysSummary.reduce((s, r) => s + r.approvedRequests, 0);

  return {
    activeRisks:      risks,
    openRequests,
    todaySummary:     todayRes.data
      ? mapSummaryRow(todayRes.data as unknown as Record<string, unknown>)
      : null,
    last7DaysSummary,
    weeklyOvertimeMin,
    weeklyApprovedReqs,
  };
}

// ── pruneOldRequests ──────────────────────────────────────────────────────────

export async function pruneOldRequests(
  daysOld = 60,
): Promise<{ pruned: number; error?: string }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('prune_shift_extension_requests', {
    days_to_keep: daysOld,
  });

  if (error) return { pruned: 0, error: error.message };
  return { pruned: (data as number) ?? 0 };
}
