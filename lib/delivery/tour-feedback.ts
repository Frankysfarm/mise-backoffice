/**
 * lib/delivery/tour-feedback.ts
 *
 * Tour-Feedback-Loop — Fahrer bewerten abgeschlossene Touren.
 * Daten fließen in zukünftige Dispatch-Optimierungen ein.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface TourFeedbackInput {
  locationId: string;
  batchId: string;
  driverId: string;
  difficultyRating?: number;   // 1-5
  trafficRating?: number;      // 1-5
  customerRating?: number;     // 1-5
  hadParkingIssue?: boolean;
  hadCustomerIssue?: boolean;
  hadNavIssue?: boolean;
  hadAddressIssue?: boolean;
  driverNotes?: string;
}

export interface TourFeedbackRow {
  id: string;
  location_id: string;
  batch_id: string;
  driver_id: string;
  submitted_at: string;
  difficulty_rating: number | null;
  traffic_rating: number | null;
  customer_rating: number | null;
  had_parking_issue: boolean;
  had_customer_issue: boolean;
  had_nav_issue: boolean;
  had_address_issue: boolean;
  driver_notes: string | null;
  overall_score: number | null;
}

export interface FeedbackDashboard {
  avgOverallScore: number;
  avgDifficulty: number;
  avgTraffic: number;
  avgCustomer: number;
  totalFeedbacks: number;
  issueRates: {
    parking: number;
    customer: number;
    navigation: number;
    address: number;
  };
  recentFeedbacks: (TourFeedbackRow & { driver_name?: string })[];
}

function svc() {
  return createServiceClient();
}

export async function submitTourFeedback(input: TourFeedbackInput): Promise<TourFeedbackRow> {
  const { data, error } = await svc()
    .from('tour_feedback')
    .upsert({
      location_id:        input.locationId,
      batch_id:           input.batchId,
      driver_id:          input.driverId,
      difficulty_rating:  input.difficultyRating ?? null,
      traffic_rating:     input.trafficRating ?? null,
      customer_rating:    input.customerRating ?? null,
      had_parking_issue:  input.hadParkingIssue ?? false,
      had_customer_issue: input.hadCustomerIssue ?? false,
      had_nav_issue:      input.hadNavIssue ?? false,
      had_address_issue:  input.hadAddressIssue ?? false,
      driver_notes:       input.driverNotes ?? null,
      submitted_at:       new Date().toISOString(),
    }, { onConflict: 'batch_id,driver_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TourFeedbackRow;
}

export async function getExistingFeedback(
  batchId: string,
  driverId: string,
): Promise<TourFeedbackRow | null> {
  const { data } = await svc()
    .from('tour_feedback')
    .select('*')
    .eq('batch_id', batchId)
    .eq('driver_id', driverId)
    .maybeSingle();
  return (data as TourFeedbackRow | null);
}

export async function getFeedbackDashboard(
  locationId: string,
  days = 30,
): Promise<FeedbackDashboard> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data: rows } = await svc()
    .from('tour_feedback')
    .select('*, mise_drivers!driver_id(name)')
    .eq('location_id', locationId)
    .gte('submitted_at', since.toISOString())
    .order('submitted_at', { ascending: false })
    .limit(200);

  const feedbacks = (rows ?? []) as (TourFeedbackRow & { mise_drivers?: { name: string } | null })[];
  const n = feedbacks.length;

  const avg = (getter: (f: TourFeedbackRow) => number | null): number => {
    const vals = feedbacks.map(getter).filter((v): v is number => v !== null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  };

  const issueRate = (getter: (f: TourFeedbackRow) => boolean): number =>
    n > 0 ? Math.round((feedbacks.filter(getter).length / n) * 100) : 0;

  return {
    avgOverallScore: avg((f) => f.overall_score),
    avgDifficulty:   avg((f) => f.difficulty_rating),
    avgTraffic:      avg((f) => f.traffic_rating),
    avgCustomer:     avg((f) => f.customer_rating),
    totalFeedbacks:  n,
    issueRates: {
      parking:    issueRate((f) => f.had_parking_issue),
      customer:   issueRate((f) => f.had_customer_issue),
      navigation: issueRate((f) => f.had_nav_issue),
      address:    issueRate((f) => f.had_address_issue),
    },
    recentFeedbacks: feedbacks.slice(0, 30).map((f) => ({
      ...f,
      driver_name: f.mise_drivers?.name ?? undefined,
    })),
  };
}

export async function pruneTourFeedback(daysToKeep = 90): Promise<number> {
  const { data } = await svc().rpc('prune_tour_feedback', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
