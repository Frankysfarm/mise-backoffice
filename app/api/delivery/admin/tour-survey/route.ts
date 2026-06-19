/**
 * GET  /api/delivery/admin/tour-survey?action=dashboard  — Vollständiges Dashboard
 * GET  /api/delivery/admin/tour-survey?action=overview   — 7-Tage-KPIs
 * GET  /api/delivery/admin/tour-survey?action=trends&days=14 — Tages-Trend
 * GET  /api/delivery/admin/tour-survey?action=notes      — Freitext-Kommentare
 * POST /api/delivery/admin/tour-survey action=prune      — Cleanup
 *
 * Alle Antworten sind anonym — kein Fahrername in der Ausgabe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getSurveyDashboard,
  getSurveyOverview,
  getSurveyTrends,
  getSurveyNotes,
  pruneSurveys,
} from '@/lib/delivery/tour-terminal-survey';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp     = req.nextUrl.searchParams;
  const action = sp.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const dashboard = await getSurveyDashboard(locationId);
      return NextResponse.json({ ok: true, dashboard });
    }

    if (action === 'overview') {
      const overview = await getSurveyOverview(locationId);
      return NextResponse.json({ ok: true, overview });
    }

    if (action === 'trends') {
      const days   = sp.get('days') ? Number(sp.get('days')) : 14;
      const trends = await getSurveyTrends(locationId, days);
      return NextResponse.json({ ok: true, trends });
    }

    if (action === 'notes') {
      const limit = sp.get('limit') ? Number(sp.get('limit')) : 20;
      const notes = await getSurveyNotes(locationId, limit);
      return NextResponse.json({ ok: true, notes });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; daysToKeep?: number };
  try {
    body = await req.json() as { action?: string; daysToKeep?: number };
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { action, daysToKeep } = body;

  if (action === 'prune') {
    try {
      const result = await pruneSurveys(daysToKeep ?? 90);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
