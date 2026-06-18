/**
 * POST /api/delivery/driver/feedback  — Fahrer reicht Feedback nach Tour ein
 * GET  /api/delivery/driver/feedback  — Fahrer holt eigene Feedback-Zusammenfassung
 *
 * Auth: Fahrer identifiziert sich via driverId + locationId (Query-Param / Body)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  submitFeedback,
  getDriverFeedbackSummary,
  type FeedbackSubmitPayload,
  type FeedbackMood,
  type FeedbackIssueType,
} from '@/lib/delivery/driver-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_MOODS: FeedbackMood[] = ['great', 'good', 'neutral', 'tired', 'frustrated'];
const VALID_ISSUES: FeedbackIssueType[] = [
  'navigation', 'customer', 'app', 'vehicle', 'timing', 'route', 'support', 'other',
];

async function resolveDriver(
  driverId: string,
  locationId: string,
): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();
  return !!data;
}

// ── POST: Feedback einreichen ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;

    const driverId   = body.driverId   as string | undefined;
    const locationId = body.locationId as string | undefined;

    if (!driverId || !locationId) {
      return NextResponse.json({ error: 'driverId und locationId erforderlich' }, { status: 400 });
    }

    const validDriver = await resolveDriver(driverId, locationId);
    if (!validDriver) {
      return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
    }

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating muss 1–5 sein' }, { status: 400 });
    }

    const mood = body.mood as string | undefined;
    if (!mood || !VALID_MOODS.includes(mood as FeedbackMood)) {
      return NextResponse.json(
        { error: `mood muss eines von: ${VALID_MOODS.join(', ')} sein` },
        { status: 400 },
      );
    }

    const issueTypes = (body.issueTypes as string[] | undefined ?? []).filter(
      (t): t is FeedbackIssueType => VALID_ISSUES.includes(t as FeedbackIssueType),
    );

    const payload: FeedbackSubmitPayload = {
      rating,
      mood: mood as FeedbackMood,
      issueTypes,
      note:       (body.note       as string | undefined) ?? undefined,
      tourId:     (body.tourId     as string | undefined) ?? undefined,
      batchId:    (body.batchId    as string | undefined) ?? undefined,
      toursToday: body.toursToday ? Number(body.toursToday) : 0,
    };

    const report = await submitFeedback(driverId, locationId, payload);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── GET: Eigene Zusammenfassung ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const driverId   = sp.get('driverId');
  const locationId = sp.get('locationId');
  const days       = sp.get('days') ? Number(sp.get('days')) : 30;

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driverId und locationId erforderlich' }, { status: 400 });
  }

  const validDriver = await resolveDriver(driverId, locationId);
  if (!validDriver) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  const summary = await getDriverFeedbackSummary(driverId, locationId, days);
  return NextResponse.json(summary);
}
