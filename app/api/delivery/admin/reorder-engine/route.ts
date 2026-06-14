/**
 * GET  /api/delivery/admin/reorder-engine
 *      ?action=dashboard|top_customers|top_items
 *      Admin-Dashboard: Wiederbestellungs-KPIs, Treuekunden, Top-Artikel
 *
 * POST /api/delivery/admin/reorder-engine
 *      { action: 'rebuild' }           — Profile für diese Location neu aufbauen
 *      { action: 'rebuild_all' }       — Alle Locations (Service-Role)
 *      { action: 'prune', days?: 180 } — Veraltete Profile bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReorderDashboard,
  getTopReorderCustomers,
  getTopReorderItems,
  buildProfilesForLocation,
  buildProfilesAllLocations,
  pruneStaleProfiles,
} from '@/lib/delivery/reorder-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const urlLocId = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (urlLocId) return urlLocId;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'top_customers') {
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 100);
      const customers = await getTopReorderCustomers(locationId, limit);
      return NextResponse.json({ customers });
    }

    if (action === 'top_items') {
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 10), 50);
      const items = await getTopReorderItems(locationId, limit);
      return NextResponse.json({ items });
    }

    // default: dashboard
    const dashboard = await getReorderDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[reorder-engine GET]', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Daten' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  try {
    if (action === 'rebuild') {
      const result = await buildProfilesForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'rebuild_all') {
      const result = await buildProfilesAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const days = Number(body.days ?? 180);
      const deleted = await pruneStaleProfiles(days);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[reorder-engine POST]', err);
    return NextResponse.json({ error: 'Fehler bei der Verarbeitung' }, { status: 500 });
  }
}
