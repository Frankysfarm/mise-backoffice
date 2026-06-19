/**
 * GET  /api/delivery/admin/reorder-v2          — Dashboard V2
 * POST /api/delivery/admin/reorder-v2          — Saisonmuster berechnen
 * POST /api/delivery/admin/reorder-v2?action=build_profiles — V2-Profile aufbauen
 *
 * Phase 302 — Admin-Endpunkte für Reorder V2
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReorderDashboardV2,
  buildLocationSeasonalPatterns,
  buildV2ProfilesForLocation,
} from '@/lib/delivery/reorder-engine-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const override = req.nextUrl.searchParams.get('location_id');
  if (override) return override;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  return (emp as { location_id: string | null } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getReorderDashboardV2(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'build_profiles') {
      const result = await buildV2ProfilesForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    // Default: Saisonmuster berechnen
    await buildLocationSeasonalPatterns(locationId);
    return NextResponse.json({ ok: true, message: 'Saisonmuster aktualisiert', locationId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
