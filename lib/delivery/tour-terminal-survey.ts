/**
 * lib/delivery/tour-terminal-survey.ts — Phase 272
 *
 * Anonyme Post-Tour-Kurzumfrage für Fahrer (3 Fragen, Stern-Rating 1–5).
 * Admin-Auswertung ist vollständig anonymisiert (keine Fahrernamen).
 *
 * Öffentliche API:
 *   submitSurvey(driverId, locationId, payload)  — Antwort einreichen
 *   getDriverLastSurvey(driverId, locationId)    — Letzte eigene Antwort (de-dup)
 *   getSurveyOverview(locationId)               — 7-Tage-KPIs (anonym)
 *   getSurveyTrends(locationId, days?)          — Tages-Trend (anonym)
 *   getSurveyNotes(locationId, limit?)          — Freitext-Kommentare (anonym)
 *   getSurveyDashboard(locationId)             — Vollständiges Admin-Dashboard
 *   pruneSurveys(daysToKeep?)                  — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ────────────────────────────────────────────────────────────────────

export interface SurveySubmitPayload {
  tourId?: string;
  batchId?: string;
  q1TourSmoothness: number;    // 1–5
  q2KitchenReadiness: number;  // 1–5
  q3CustomerContact: number;   // 1–5
  note?: string;               // max 280 Zeichen
}

export interface SurveyDailyRow {
  surveyDate: string;
  responseCount: number;
  avgQ1: number | null;
  avgQ2: number | null;
  avgQ3: number | null;
  avgOverall: number | null;
  q1LowCount: number;
  q2LowCount: number;
  q3LowCount: number;
  notesCount: number;
}

export interface SurveyOverview {
  totalResponses7d: number;
  avgQ1_7d: number | null;
  avgQ2_7d: number | null;
  avgQ3_7d: number | null;
  avgOverall7d: number | null;
  kitchenIssues7d: number;
  tourIssues7d: number;
  customerIssues7d: number;
}

export interface SurveyNote {
  note: string;
  submittedAt: string;
}

export interface SurveyDashboard {
  overview: SurveyOverview | null;
  trends: SurveyDailyRow[];
  recentNotes: SurveyNote[];
  totalAllTime: number;
}

// ── Validierung ───────────────────────────────────────────────────────────────

function validateRating(v: number, name: string): void {
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw new Error(`${name} muss eine ganze Zahl zwischen 1 und 5 sein`);
  }
}

// ── submitSurvey ─────────────────────────────────────────────────────────────

export async function submitSurvey(
  driverId: string,
  locationId: string,
  payload: SurveySubmitPayload,
): Promise<{ id: string; submittedAt: string }> {
  const supabase = createServiceClient();

  validateRating(payload.q1TourSmoothness, 'q1TourSmoothness');
  validateRating(payload.q2KitchenReadiness, 'q2KitchenReadiness');
  validateRating(payload.q3CustomerContact, 'q3CustomerContact');

  if (payload.note && payload.note.length > 280) {
    throw new Error('Notiz darf maximal 280 Zeichen lang sein');
  }

  const insert: Record<string, unknown> = {
    location_id: locationId,
    driver_id: driverId,
    q1_tour_smoothness: payload.q1TourSmoothness,
    q2_kitchen_readiness: payload.q2KitchenReadiness,
    q3_customer_contact: payload.q3CustomerContact,
    note: payload.note ?? null,
    submitted_at: new Date().toISOString(),
  };
  if (payload.tourId) insert.tour_id = payload.tourId;
  if (payload.batchId) insert.batch_id = payload.batchId;

  // Upsert: ein Fahrer darf pro Tour nur einmal antworten
  const { data, error } = await supabase
    .from('tour_terminal_surveys')
    .upsert(insert, { onConflict: 'driver_id,tour_id', ignoreDuplicates: false })
    .select('id, submitted_at')
    .single();

  if (error) throw new Error(`submitSurvey: ${error.message}`);
  const row = data as { id: string; submitted_at: string };
  return { id: row.id, submittedAt: row.submitted_at };
}

// ── getDriverLastSurvey ───────────────────────────────────────────────────────

export async function getDriverLastSurvey(
  driverId: string,
  locationId: string,
): Promise<{
  id: string;
  q1: number;
  q2: number;
  q3: number;
  submittedAt: string;
} | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('tour_terminal_surveys')
    .select('id, q1_tour_smoothness, q2_kitchen_readiness, q3_customer_contact, submitted_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    q1: r.q1_tour_smoothness as number,
    q2: r.q2_kitchen_readiness as number,
    q3: r.q3_customer_contact as number,
    submittedAt: r.submitted_at as string,
  };
}

// ── getSurveyOverview ─────────────────────────────────────────────────────────

export async function getSurveyOverview(locationId: string): Promise<SurveyOverview | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('v_tour_survey_overview')
    .select('total_responses_7d, avg_q1_7d, avg_q2_7d, avg_q3_7d, avg_overall_7d, kitchen_issues_7d, tour_issues_7d, customer_issues_7d')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    totalResponses7d: (r.total_responses_7d as number) ?? 0,
    avgQ1_7d: (r.avg_q1_7d as number | null) ?? null,
    avgQ2_7d: (r.avg_q2_7d as number | null) ?? null,
    avgQ3_7d: (r.avg_q3_7d as number | null) ?? null,
    avgOverall7d: (r.avg_overall_7d as number | null) ?? null,
    kitchenIssues7d: (r.kitchen_issues_7d as number) ?? 0,
    tourIssues7d: (r.tour_issues_7d as number) ?? 0,
    customerIssues7d: (r.customer_issues_7d as number) ?? 0,
  };
}

// ── getSurveyTrends ───────────────────────────────────────────────────────────

export async function getSurveyTrends(
  locationId: string,
  days = 14,
): Promise<SurveyDailyRow[]> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('v_tour_survey_daily')
    .select('survey_date, response_count, avg_q1, avg_q2, avg_q3, avg_overall, q1_low_count, q2_low_count, q3_low_count, notes_count')
    .eq('location_id', locationId)
    .gte('survey_date', since)
    .order('survey_date', { ascending: true });

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      surveyDate: row.survey_date as string,
      responseCount: (row.response_count as number) ?? 0,
      avgQ1: (row.avg_q1 as number | null) ?? null,
      avgQ2: (row.avg_q2 as number | null) ?? null,
      avgQ3: (row.avg_q3 as number | null) ?? null,
      avgOverall: (row.avg_overall as number | null) ?? null,
      q1LowCount: (row.q1_low_count as number) ?? 0,
      q2LowCount: (row.q2_low_count as number) ?? 0,
      q3LowCount: (row.q3_low_count as number) ?? 0,
      notesCount: (row.notes_count as number) ?? 0,
    };
  });
}

// ── getSurveyNotes ────────────────────────────────────────────────────────────

export async function getSurveyNotes(
  locationId: string,
  limit = 20,
): Promise<SurveyNote[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('tour_terminal_surveys')
    .select('note, submitted_at')
    .eq('location_id', locationId)
    .not('note', 'is', null)
    .neq('note', '')
    .order('submitted_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      note: row.note as string,
      submittedAt: row.submitted_at as string,
    };
  });
}

// ── getSurveyDashboard ────────────────────────────────────────────────────────

export async function getSurveyDashboard(locationId: string): Promise<SurveyDashboard> {
  const supabase = createServiceClient();

  const [overview, trends, notes, totalRes] = await Promise.all([
    getSurveyOverview(locationId),
    getSurveyTrends(locationId, 14),
    getSurveyNotes(locationId, 20),
    supabase
      .from('tour_terminal_surveys')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId),
  ]);

  return {
    overview,
    trends,
    recentNotes: notes,
    totalAllTime: totalRes.count ?? 0,
  };
}

// ── pruneSurveys ──────────────────────────────────────────────────────────────

export async function pruneSurveys(daysToKeep = 90): Promise<{ pruned: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('prune_old_tour_surveys', {
    p_days: daysToKeep,
  });
  if (error) throw new Error(`pruneSurveys: ${error.message}`);
  const result = data as { pruned?: number } | null;
  return { pruned: result?.pruned ?? 0 };
}

// ── pruneSurveysAllLocations ──────────────────────────────────────────────────

export async function pruneSurveysAllLocations(daysToKeep = 90): Promise<{ pruned: number }> {
  return pruneSurveys(daysToKeep);
}
