/**
 * GET  /api/delivery/admin/forecast?location_id=...&hours=6
 *
 * Lieferbedarf-Vorhersage für die nächsten N Stunden.
 * Basiert auf dem Wochentag+Stunden-Muster der letzten 8 Wochen.
 *
 * Response:
 * {
 *   locationId, generatedAt, hoursAhead,
 *   slots: [{ hourUtc, hourLocal, expectedOrders, recommendedMinDrivers, ... }],
 *   summary: { totalExpectedOrders, peakSlot, recommendedMaxDrivers }
 * }
 *
 * POST /api/delivery/admin/forecast
 * Body: { location_id, action: 'snapshot' | 'update_coverage' }
 *
 * snapshot       — Stunden-Snapshot jetzt schreiben (idempotent)
 * update_coverage — coverage_requirements aus Forecast-Muster aktualisieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getForecast,
  snapshotDemand,
  updateCoverageFromForecast,
} from '@/lib/delivery/forecast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const hours = Math.min(24, Math.max(1, parseInt(searchParams.get('hours') ?? '6', 10)));

  try {
    const forecast = await getForecast(locationId, hours);
    return NextResponse.json(forecast);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { location_id?: string; action?: string };
  const { location_id: locationId, action } = body;

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!action) return NextResponse.json({ error: 'action fehlt' }, { status: 400 });

  try {
    if (action === 'snapshot') {
      const snapshot = await snapshotDemand(locationId);
      return NextResponse.json({ ok: true, snapshot });
    }

    if (action === 'update_coverage') {
      const result = await updateCoverageFromForecast(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
