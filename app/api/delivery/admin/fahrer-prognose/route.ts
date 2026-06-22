/**
 * GET /api/delivery/admin/fahrer-prognose
 *
 * Fahrer-Prognose-Engine — ML-ähnlicher Score je Fahrer.
 *
 * GET ?location_id=<uuid>                        → Rangliste aller Fahrer
 * GET ?location_id=<uuid>&driver_id=<uuid>       → Detail für einen Fahrer
 *
 * POST { action: 'compute', location_id }        → Prognose neu berechnen (alle Fahrer)
 * POST { action: 'compute-driver', location_id, driver_id }  → Einzelner Fahrer
 * POST { action: 'compute-all' }                 → alle Standorte (Cron)
 * POST { action: 'prune', days_old? }            → Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getFahrerPrognoseRangliste,
  getDriverPrognoseDetail,
  computePrognoseForLocation,
  computeDriverPrognose,
  computePrognoseAllLocations,
  pruneOldPrognoseSnapshots,
} from '@/lib/delivery/fahrer-prognose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (driverId) {
      const detail = await getDriverPrognoseDetail(driverId, locationId);
      return NextResponse.json({ locationId, driverId, detail });
    }

    const rangliste = await getFahrerPrognoseRangliste(locationId);
    return NextResponse.json({ locationId, rangliste, count: rangliste.length });
  } catch (err) {
    console.error('[fahrer-prognose GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action:      string;
      location_id?: string;
      driver_id?:   string;
      days_back?:   number;
      days_old?:    number;
    };
    const { action, location_id, driver_id, days_back, days_old } = body;

    if (action === 'compute') {
      if (!location_id) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await computePrognoseForLocation(location_id, days_back ?? 28);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'compute-driver') {
      if (!location_id || !driver_id) {
        return NextResponse.json({ error: 'location_id and driver_id required' }, { status: 400 });
      }
      const snapshot = await computeDriverPrognose(driver_id, location_id, days_back ?? 28);
      return NextResponse.json({ ok: true, snapshot });
    }

    if (action === 'compute-all') {
      const result = await computePrognoseAllLocations(days_back ?? 28);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const result = await pruneOldPrognoseSnapshots(days_old ?? 90);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[fahrer-prognose POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
