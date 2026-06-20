/**
 * GET/POST /api/delivery/admin/tour-heatmap
 *
 * Tour Heatmap Engine — Phase 346
 *
 * GET ?action=dashboard → KPIs + Kacheln + unterversorgte Zonen
 * GET ?action=tiles&days=7 → Rohe Kacheln für Kartendarstellung
 * GET ?action=underserved → Nur unterversorgte Zonen
 * GET ?action=config → Konfiguration
 * POST action=compute → Heatmap neu berechnen
 * POST action=update_config → Konfiguration speichern
 * POST action=prune → Alte Kacheln löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getHeatmapDashboard,
  getHeatmapTiles,
  getUnderservedZones,
  getConfig,
  upsertConfig,
  computeHeatmapForLocation,
  pruneOldTiles,
} from '@/lib/delivery/tour-heatmap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const override = req.nextUrl.searchParams.get('location_id');
  return emp?.role === 'superadmin' && override
    ? override
    : (emp?.location_id as string | null);
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'tiles') {
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10);
    const tiles = await getHeatmapTiles(locationId, Math.min(days, 90));
    return NextResponse.json(tiles);
  }

  if (action === 'underserved') {
    const zones = await getUnderservedZones(locationId);
    return NextResponse.json(zones);
  }

  if (action === 'config') {
    const config = await getConfig(locationId);
    return NextResponse.json(config);
  }

  const dashboard = await getHeatmapDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action: string; [k: string]: unknown };

  if (body.action === 'compute') {
    const result = await computeHeatmapForLocation(locationId);
    return NextResponse.json(result);
  }

  if (body.action === 'update_config') {
    await upsertConfig(locationId, body as Parameters<typeof upsertConfig>[1]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'prune') {
    const deleted = await pruneOldTiles(90);
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
