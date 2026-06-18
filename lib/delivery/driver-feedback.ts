/**
 * lib/delivery/driver-feedback.ts — Phase 235
 *
 * Smart Delivery Driver Feedback Loop
 *
 * Fahrer geben nach jeder Tour Feedback: Rating (1–5), Mood, Issue-Types, Notiz.
 * Daten werden aggregiert und in den Fahrer-Performance-Score eingerechnet.
 *
 * Öffentliche API:
 *   submitFeedback(driverId, locationId, payload)   — Feedback einreichen
 *   getDriverFeedbackSummary(driverId, locationId)  — Fahrer-Zusammenfassung
 *   getLocationDashboard(locationId)                — Admin-Dashboard
 *   aggregateFeedbackAllLocations()                 — Cron-Batch
 *   pruneOldFeedback(daysToKeep?)                   — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ────────────────────────────────────────────────────────────────────

export type FeedbackMood = 'great' | 'good' | 'neutral' | 'tired' | 'frustrated';
export type FeedbackIssueType =
  | 'navigation'
  | 'customer'
  | 'app'
  | 'vehicle'
  | 'timing'
  | 'route'
  | 'support'
  | 'other';

export interface FeedbackSubmitPayload {
  tourId?: string;
  batchId?: string;
  rating: number;         // 1–5
  mood: FeedbackMood;
  issueTypes?: FeedbackIssueType[];
  note?: string;
  toursToday?: number;
}

export interface DriverFeedbackReport {
  id: string;
  locationId: string;
  driverId: string;
  tourId: string | null;
  batchId: string | null;
  rating: number;
  mood: FeedbackMood;
  issueTypes: FeedbackIssueType[];
  note: string | null;
  toursToday: number;
  submittedAt: string;
}

export interface DriverFeedbackSummary {
  driverId: string;
  locationId: string;
  totalReports: number;
  avgRating: number | null;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  goodMoodCount: number;
  badMoodCount: number;
  reportsWithIssues: number;
  lastFeedbackAt: string | null;
  recentReports: DriverFeedbackReport[];
}

export interface IssueFrequency {
  issueType: string;
  occurrenceCount: number;
}

export interface DriverFeedbackRow {
  driverId: string;
  driverName: string | null;
  totalReports: number;
  avgRating: number | null;
  positiveCount: number;
  negativeCount: number;
  badMoodCount: number;
  reportsWithIssues: number;
  lastFeedbackAt: string | null;
}

export interface FeedbackLocationOverview {
  totalReports7d: number;
  avgRating7d: number | null;
  positive7d: number;
  negative7d: number;
  badMood7d: number;
  driversWithFeedback: number;
}

export interface FeedbackDashboard {
  overview: FeedbackLocationOverview | null;
  issueFrequency: IssueFrequency[];
  driverRows: DriverFeedbackRow[];
  recentReports: DriverFeedbackReport[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapReport(r: Record<string, unknown>): DriverFeedbackReport {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    driverId: r.driver_id as string,
    tourId: (r.tour_id as string | null) ?? null,
    batchId: (r.batch_id as string | null) ?? null,
    rating: r.rating as number,
    mood: r.mood as FeedbackMood,
    issueTypes: (r.issue_types as FeedbackIssueType[]) ?? [],
    note: (r.note as string | null) ?? null,
    toursToday: (r.tours_today as number) ?? 0,
    submittedAt: r.submitted_at as string,
  };
}

// ── submitFeedback ────────────────────────────────────────────────────────────

export async function submitFeedback(
  driverId: string,
  locationId: string,
  payload: FeedbackSubmitPayload,
): Promise<DriverFeedbackReport> {
  const supabase = createServiceClient();

  const { rating, mood, issueTypes = [], note, toursToday = 0, tourId, batchId } = payload;

  if (rating < 1 || rating > 5) throw new Error('Rating must be 1–5');

  const insert: Record<string, unknown> = {
    location_id: locationId,
    driver_id: driverId,
    rating,
    mood,
    issue_types: issueTypes,
    note: note ?? null,
    tours_today: toursToday,
    submitted_at: new Date().toISOString(),
  };
  if (tourId) insert.tour_id = tourId;
  if (batchId) insert.batch_id = batchId;

  const { data, error } = await supabase
    .from('driver_feedback_reports')
    .insert(insert)
    .select('id, location_id, driver_id, tour_id, batch_id, rating, mood, issue_types, note, tours_today, submitted_at')
    .single();

  if (error) throw new Error(`submitFeedback: ${error.message}`);
  return mapReport(data as Record<string, unknown>);
}

// ── getDriverFeedbackSummary ──────────────────────────────────────────────────

export async function getDriverFeedbackSummary(
  driverId: string,
  locationId: string,
  days = 30,
): Promise<DriverFeedbackSummary> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [summaryRes, recentRes] = await Promise.all([
    supabase
      .from('v_driver_feedback_summary')
      .select('total_reports, avg_rating, positive_count, neutral_count, negative_count, good_mood_count, bad_mood_count, reports_with_issues, last_feedback_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .maybeSingle(),
    supabase
      .from('driver_feedback_reports')
      .select('id, location_id, driver_id, tour_id, batch_id, rating, mood, issue_types, note, tours_today, submitted_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('submitted_at', since)
      .order('submitted_at', { ascending: false })
      .limit(10),
  ]);

  const s = summaryRes.data as Record<string, unknown> | null;
  const recentReports = (recentRes.data ?? []).map((r) => mapReport(r as Record<string, unknown>));

  return {
    driverId,
    locationId,
    totalReports: (s?.total_reports as number) ?? 0,
    avgRating: (s?.avg_rating as number | null) ?? null,
    positiveCount: (s?.positive_count as number) ?? 0,
    neutralCount: (s?.neutral_count as number) ?? 0,
    negativeCount: (s?.negative_count as number) ?? 0,
    goodMoodCount: (s?.good_mood_count as number) ?? 0,
    badMoodCount: (s?.bad_mood_count as number) ?? 0,
    reportsWithIssues: (s?.reports_with_issues as number) ?? 0,
    lastFeedbackAt: (s?.last_feedback_at as string | null) ?? null,
    recentReports,
  };
}

// ── getLocationDashboard ──────────────────────────────────────────────────────

export async function getLocationDashboard(locationId: string): Promise<FeedbackDashboard> {
  const supabase = createServiceClient();

  const [overviewRes, issueRes, driverSummaryRes, recentRes] = await Promise.all([
    supabase
      .from('v_feedback_location_overview')
      .select('total_reports_7d, avg_rating_7d, positive_7d, negative_7d, bad_mood_7d, drivers_with_feedback')
      .eq('location_id', locationId)
      .maybeSingle(),
    supabase
      .from('v_feedback_issue_frequency')
      .select('issue_type, occurrence_count')
      .eq('location_id', locationId)
      .order('occurrence_count', { ascending: false })
      .limit(10),
    supabase
      .from('v_driver_feedback_summary')
      .select('driver_id, total_reports, avg_rating, positive_count, negative_count, bad_mood_count, reports_with_issues, last_feedback_at')
      .eq('location_id', locationId)
      .order('total_reports', { ascending: false })
      .limit(20),
    supabase
      .from('driver_feedback_reports')
      .select('id, location_id, driver_id, tour_id, batch_id, rating, mood, issue_types, note, tours_today, submitted_at')
      .eq('location_id', locationId)
      .order('submitted_at', { ascending: false })
      .limit(20),
  ]);

  const ov = overviewRes.data as Record<string, unknown> | null;

  // Anreichern mit Fahrernamen aus mise_drivers
  const driverIds = (driverSummaryRes.data ?? []).map((r: Record<string, unknown>) => r.driver_id as string);
  let nameMap: Record<string, string | null> = {};
  if (driverIds.length > 0) {
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    if (drivers) {
      for (const d of drivers as Array<{ id: string; name: string | null }>) {
        nameMap[d.id] = d.name;
      }
    }
  }

  const driverRows: DriverFeedbackRow[] = (driverSummaryRes.data ?? []).map((r: Record<string, unknown>) => ({
    driverId: r.driver_id as string,
    driverName: nameMap[r.driver_id as string] ?? null,
    totalReports: (r.total_reports as number) ?? 0,
    avgRating: (r.avg_rating as number | null) ?? null,
    positiveCount: (r.positive_count as number) ?? 0,
    negativeCount: (r.negative_count as number) ?? 0,
    badMoodCount: (r.bad_mood_count as number) ?? 0,
    reportsWithIssues: (r.reports_with_issues as number) ?? 0,
    lastFeedbackAt: (r.last_feedback_at as string | null) ?? null,
  }));

  return {
    overview: ov
      ? {
          totalReports7d: (ov.total_reports_7d as number) ?? 0,
          avgRating7d: (ov.avg_rating_7d as number | null) ?? null,
          positive7d: (ov.positive_7d as number) ?? 0,
          negative7d: (ov.negative_7d as number) ?? 0,
          badMood7d: (ov.bad_mood_7d as number) ?? 0,
          driversWithFeedback: (ov.drivers_with_feedback as number) ?? 0,
        }
      : null,
    issueFrequency: (issueRes.data ?? []).map((r: Record<string, unknown>) => ({
      issueType: r.issue_type as string,
      occurrenceCount: (r.occurrence_count as number) ?? 0,
    })),
    driverRows,
    recentReports: (recentRes.data ?? []).map((r) => mapReport(r as Record<string, unknown>)),
  };
}

// ── aggregateFeedbackAllLocations ─────────────────────────────────────────────

export async function aggregateFeedbackAllLocations(): Promise<{
  locations: number;
  errors: number;
}> {
  const supabase = createServiceClient();

  const { data: locations } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (!locations || locations.length === 0) return { locations: 0, errors: 0 };

  let errors = 0;
  await Promise.all(
    (locations as Array<{ id: string }>).map(async ({ id }) => {
      try {
        // Fahrer mit schlechtem Feedback (avg < 3.0, letzte 7 Tage) markieren
        // für das Driver-Wellbeing-System (Signal für Intervention)
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        try { await supabase.rpc('prune_old_driver_feedback', { days_to_keep: 90 }); } catch { /* ignore */ }
        // Low-rating drivers: future hook point for wellbeing / retention engine
        await supabase
          .from('driver_feedback_reports')
          .select('driver_id')
          .eq('location_id', id)
          .gte('submitted_at', since)
          .lte('rating', 2)
          .limit(1);
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locations.length, errors };
}

// ── pruneOldFeedback ──────────────────────────────────────────────────────────

export async function pruneOldFeedback(daysToKeep = 90): Promise<{ pruned: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('prune_old_driver_feedback', {
    days_to_keep: daysToKeep,
  });
  if (error) throw new Error(`pruneOldFeedback: ${error.message}`);
  return { pruned: (data as number) ?? 0 };
}
