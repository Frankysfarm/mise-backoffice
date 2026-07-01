/**
 * GET /api/delivery/admin/tour-completion-forecast?location_id=...
 *
 * Phase 531 — Echtzeit-Tour-Abschluss-Prognose
 * Aktive Touren mit geschätzter Fertigstellungszeit basierend auf bisheriger Ø-Stopp-Dauer.
 *
 * Response: { ok, tours: TourCompletionForecast[], summary: TourForecastSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface TourCompletionForecast {
  tourId: string;
  driverName: string;
  zone: string | null;
  stopsCompleted: number;
  stopsTotal: number;
  elapsedMin: number;
  avgMinPerStop: number | null;
  forecastCompleteAt: string | null;
  forecastRemainingMin: number | null;
  confidenceLevel: ConfidenceLevel;
  progressPct: number;
}

export interface TourForecastSummary {
  activeTours: number;
  avgRemainingMin: number | null;
  soonestCompleteAt: string | null;
  latestCompleteAt: string | null;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function confidenceLevel(stopsCompleted: number): ConfidenceLevel {
  if (stopsCompleted >= 5) return 'high';
  if (stopsCompleted >= 2) return 'medium';
  return 'low';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();

  type BatchRow = {
    id: string;
    zone: string | null;
    gestartet_am: string | null;
    driver: { name: string | null } | { name: string | null }[] | null;
  };

  // Active batches (unterwegs)
  const { data: batches } = await ssb
    .from('mise_delivery_batches')
    .select('id, zone, gestartet_am, driver:fahrer_id(name)')
    .eq('location_id', locationId)
    .eq('status', 'unterwegs');

  if (!batches || batches.length === 0) {
    return NextResponse.json({
      ok: true,
      tours: [],
      summary: { activeTours: 0, avgRemainingMin: null, soonestCompleteAt: null, latestCompleteAt: null },
      generatedAt: now.toISOString(),
    });
  }

  type StopRow = {
    batch_id: string;
    status: string;
    delivered_at: string | null;
    sort_order: number | null;
  };

  const batchIds = (batches as BatchRow[]).map((b) => b.id);

  const { data: stops } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id, status, delivered_at, sort_order')
    .eq('location_id', locationId)
    .in('batch_id', batchIds);

  const stopRows = (stops ?? []) as StopRow[];

  const tours: TourCompletionForecast[] = (batches as BatchRow[]).map((batch) => {
    const batchStops = stopRows.filter((s) => s.batch_id === batch.id);
    const stopsTotal = batchStops.length;
    const deliveredStops = batchStops.filter((s) => s.status === 'delivered' && s.delivered_at);
    const stopsCompleted = deliveredStops.length;
    const stopsRemaining = stopsTotal - stopsCompleted;

    const driverRaw = batch.driver;
    const driverName = Array.isArray(driverRaw)
      ? ((driverRaw[0] as { name: string | null })?.name ?? 'Unbekannt')
      : ((driverRaw as { name: string | null } | null)?.name ?? 'Unbekannt');

    const startedAt = batch.gestartet_am ? new Date(batch.gestartet_am) : null;
    const elapsedMin = startedAt
      ? Math.round((now.getTime() - startedAt.getTime()) / 60_000)
      : 0;

    // Ø Minuten pro abgeschlossenen Stopp
    let avgMinPerStop: number | null = null;
    if (stopsCompleted >= 1 && elapsedMin > 0) {
      avgMinPerStop = Math.round((elapsedMin / stopsCompleted) * 10) / 10;
    }

    let forecastRemainingMin: number | null = null;
    let forecastCompleteAt: string | null = null;

    if (avgMinPerStop !== null && stopsRemaining > 0) {
      forecastRemainingMin = Math.round(avgMinPerStop * stopsRemaining);
      const completeTs = new Date(now.getTime() + forecastRemainingMin * 60_000);
      forecastCompleteAt = completeTs.toISOString();
    } else if (stopsRemaining === 0) {
      forecastRemainingMin = 0;
      forecastCompleteAt = now.toISOString();
    }

    const progressPct = stopsTotal > 0 ? Math.round((stopsCompleted / stopsTotal) * 100) : 0;

    return {
      tourId: batch.id,
      driverName,
      zone: batch.zone,
      stopsCompleted,
      stopsTotal,
      elapsedMin,
      avgMinPerStop,
      forecastCompleteAt,
      forecastRemainingMin,
      confidenceLevel: confidenceLevel(stopsCompleted),
      progressPct,
    };
  });

  // Summary
  const toursWithForecast = tours.filter((t) => t.forecastRemainingMin !== null);
  const avgRemainingMin =
    toursWithForecast.length > 0
      ? Math.round(
          toursWithForecast.reduce((s, t) => s + (t.forecastRemainingMin ?? 0), 0) /
            toursWithForecast.length
        )
      : null;

  const completeTimes = tours
    .map((t) => t.forecastCompleteAt)
    .filter((s): s is string => s !== null)
    .sort();

  const summary: TourForecastSummary = {
    activeTours: tours.length,
    avgRemainingMin,
    soonestCompleteAt: completeTimes[0] ?? null,
    latestCompleteAt: completeTimes[completeTimes.length - 1] ?? null,
  };

  return NextResponse.json({ ok: true, tours, summary, generatedAt: now.toISOString() });
}
