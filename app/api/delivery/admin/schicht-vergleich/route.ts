/**
 * GET /api/delivery/admin/schicht-vergleich
 *
 * Schicht-Vergleichs-Engine — aktuellen Schichtverlauf mit
 * rollender 6-Wochen-Baseline desselben Wochentags vergleichen.
 *
 * GET ?location_id=<uuid>                        → SchichtVergleich (live)
 * GET ?location_id=<uuid>&action=history&dow=<0–6>&weeks=<n>
 *                                                 → historischer DOW-Trend
 * GET ?location_id=<uuid>&action=baseline&dow=<0–6>
 *                                                 → gespeicherte Baseline für einen DOW
 *
 * POST { action: 'compute', location_id }         → Baseline für alle 7 DOW neu berechnen
 * POST { action: 'compute-all' }                  → alle aktiven Standorte (Admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getSchichtVergleich,
  getSchichtVergleichHistory,
  computeAllBaselines,
  computeAllBaselinesAllLocations,
} from '@/lib/delivery/schicht-vergleich';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action') ?? 'live';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'history') {
      const dow   = parseInt(searchParams.get('dow') ?? '1', 10);
      const weeks = parseInt(searchParams.get('weeks') ?? '8', 10);
      if (isNaN(dow) || dow < 0 || dow > 6) {
        return NextResponse.json({ error: 'dow must be 0–6' }, { status: 400 });
      }
      const history = await getSchichtVergleichHistory(locationId, dow, Math.min(weeks, 26));
      return NextResponse.json({ locationId, dayOfWeek: dow, history });
    }

    if (action === 'baseline') {
      const dow = parseInt(searchParams.get('dow') ?? '1', 10);
      if (isNaN(dow) || dow < 0 || dow > 6) {
        return NextResponse.json({ error: 'dow must be 0–6' }, { status: 400 });
      }
      const svc = createServiceClient();
      const { data } = await svc
        .from('schicht_vergleich_baselines')
        .select('*')
        .eq('location_id', locationId)
        .eq('day_of_week', dow)
        .maybeSingle();
      return NextResponse.json({ locationId, dayOfWeek: dow, baseline: data ?? null });
    }

    // Default: live comparison
    const result = await getSchichtVergleich(locationId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[schicht-vergleich GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: string;
      location_id?: string;
      weeks_back?: number;
    };
    const { action, location_id, weeks_back } = body;

    if (action === 'compute') {
      if (!location_id) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await computeAllBaselines(location_id, weeks_back ?? 6);
      return NextResponse.json({ ok: true, locationId: location_id, ...result });
    }

    if (action === 'compute-all') {
      const result = await computeAllBaselinesAllLocations(weeks_back ?? 6);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[schicht-vergleich POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
