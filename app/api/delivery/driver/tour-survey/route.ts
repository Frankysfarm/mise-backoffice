/**
 * POST /api/delivery/driver/tour-survey  — Fahrer reicht Kurzumfrage ein
 * GET  /api/delivery/driver/tour-survey  — Letzte eigene Antwort abrufen
 *
 * Auth: driverId + locationId (Body/Query-Param, kein JWT-Zwang für Fahrer-App)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  submitSurvey,
  getDriverLastSurvey,
  type SurveySubmitPayload,
} from '@/lib/delivery/tour-terminal-survey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifyDriver(driverId: string, locationId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();
  return !!data;
}

// ── GET: Letzte Antwort abrufen ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp         = req.nextUrl.searchParams;
  const driverId   = sp.get('driverId');
  const locationId = sp.get('locationId');

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driverId und locationId erforderlich' }, { status: 400 });
  }

  const valid = await verifyDriver(driverId, locationId);
  if (!valid) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  try {
    const last = await getDriverLastSurvey(driverId, locationId);
    return NextResponse.json({ ok: true, last });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST: Umfrage einreichen ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const driverId   = body.driverId   as string | undefined;
  const locationId = body.locationId as string | undefined;

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driverId und locationId erforderlich' }, { status: 400 });
  }

  const valid = await verifyDriver(driverId, locationId);
  if (!valid) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  const q1 = Number(body.q1TourSmoothness);
  const q2 = Number(body.q2KitchenReadiness);
  const q3 = Number(body.q3CustomerContact);

  if (![q1, q2, q3].every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) {
    return NextResponse.json(
      { error: 'q1TourSmoothness, q2KitchenReadiness, q3CustomerContact müssen 1–5 sein' },
      { status: 400 },
    );
  }

  const payload: SurveySubmitPayload = {
    q1TourSmoothness: q1,
    q2KitchenReadiness: q2,
    q3CustomerContact: q3,
    tourId: (body.tourId as string | undefined) ?? undefined,
    batchId: (body.batchId as string | undefined) ?? undefined,
    note: (body.note as string | undefined) ?? undefined,
  };

  try {
    const result = await submitSurvey(driverId, locationId, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
