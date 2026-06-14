/**
 * GET  /api/delivery/admin/geo-clustering?action=dashboard|clusters|hotspots
 * POST /api/delivery/admin/geo-clustering
 *      { action: 'compute' }                      — Cluster neu berechnen
 *      { action: 'save_config', k_clusters, lookback_days, min_orders, enabled }
 *      { action: 'set_label', cluster_idx, label } — Cluster benennen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getClusterDashboard,
  getClusters,
  getHotspots,
  computeClustersForLocation,
  upsertClusterConfig,
} from '@/lib/delivery/geo-clustering';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<{ locationId: string } | null> {
  const urlLoc = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!emp) return null;
  const locationId = (urlLoc ?? (emp as Record<string, string>).location_id) as string | null;
  if (!locationId) return null;
  return { locationId };
}

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'clusters') {
      const clusters = await getClusters(auth.locationId);
      return NextResponse.json({ clusters });
    }

    if (action === 'hotspots') {
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 3), 10);
      const hotspots = await getHotspots(auth.locationId, limit);
      return NextResponse.json({ hotspots });
    }

    // default: dashboard
    const dashboard = await getClusterDashboard(auth.locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[geo-clustering GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { action } = body;

  try {
    if (action === 'compute') {
      const result = await computeClustersForLocation(auth.locationId);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'save_config') {
      const { k_clusters, lookback_days, min_orders, enabled } = body as {
        k_clusters?: number;
        lookback_days?: number;
        min_orders?: number;
        enabled?: boolean;
      };
      await upsertClusterConfig(auth.locationId, {
        ...(k_clusters    != null ? { k_clusters:    Number(k_clusters) }    : {}),
        ...(lookback_days != null ? { lookback_days: Number(lookback_days) } : {}),
        ...(min_orders    != null ? { min_orders:    Number(min_orders) }    : {}),
        ...(enabled       != null ? { enabled:       Boolean(enabled) }      : {}),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'set_label') {
      const { cluster_idx, label } = body as { cluster_idx: number; label: string };
      const sb = await createClient();
      await sb
        .from('delivery_geo_clusters')
        .update({ label: label?.trim() || null })
        .eq('location_id', auth.locationId)
        .eq('cluster_idx', cluster_idx);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (err) {
    console.error('[geo-clustering POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
