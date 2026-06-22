/**
 * GET /api/delivery/admin/liefertreue-matrix
 *
 * Liefertreue-Matrix-Engine — 7×24-Heatmap der Lieferpünktlichkeit.
 *
 * GET ?location_id=<uuid>                      → LiefertreueMatrixDashboard (Matrix + Hotspots + Summary)
 * GET ?location_id=<uuid>&action=hotspots       → nur Hotspot-Liste
 * GET ?location_id=<uuid>&action=summary        → nur Summary (via View)
 *
 * POST { action: 'compute', location_id }       → Matrix neu berechnen (weeksBack opt.)
 * POST { action: 'compute-all', weeks_back? }   → alle aktiven Standorte
 * POST { action: 'prune', days_to_keep? }       → Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getLiefertreueMatrixDashboard,
  detectLiefertreueHotspots,
  computeLiefertreueMatrix,
  computeMatrixAllLocations,
  pruneOldSnapshots,
} from '@/lib/delivery/liefertreue-matrix';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action') ?? 'dashboard';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'hotspots') {
      const hotspots = await detectLiefertreueHotspots(locationId);
      return NextResponse.json({ locationId, hotspots, count: hotspots.length });
    }

    if (action === 'summary') {
      const svc = createServiceClient();
      const { data } = await svc
        .from('v_liefertreue_hotspots')
        .select('*')
        .eq('location_id', locationId)
        .maybeSingle();
      return NextResponse.json({ locationId, summary: data ?? null });
    }

    // Default: full dashboard
    const dashboard = await getLiefertreueMatrixDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[liefertreue-matrix GET]', err);
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
      days_to_keep?: number;
    };
    const { action, location_id, weeks_back, days_to_keep } = body;

    if (action === 'compute') {
      if (!location_id) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await computeLiefertreueMatrix(location_id, weeks_back ?? 8);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'compute-all') {
      const result = await computeMatrixAllLocations(weeks_back ?? 8);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const deleted = await pruneOldSnapshots(days_to_keep ?? 30);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[liefertreue-matrix POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
