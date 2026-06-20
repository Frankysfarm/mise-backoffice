/**
 * GET  /api/delivery/admin/zone-revenue-optimizer?action=dashboard
 * POST /api/delivery/admin/zone-revenue-optimizer
 *   action=snapshot       — Manuell Snapshot für heute
 *   action=generate_recs  — Empfehlungen neu generieren
 *   action=resolve        — Empfehlung auflösen  { rec_id, resolution: accepted|dismissed|applied }
 *   action=prune          — Alte Snapshots bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getZoneRevenueDashboard,
  snapshotZoneRevenue,
  generateRecommendations,
  resolveRecommendation,
  pruneZoneRevenueSnapshots,
} from '@/lib/delivery/zone-revenue-optimizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  try {
    const dashboard = await getZoneRevenueDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  try {
    const body = await req.json() as { action?: string; rec_id?: string; resolution?: string };
    const action = body.action ?? 'snapshot';

    if (action === 'snapshot') {
      const saved = await snapshotZoneRevenue(locationId);
      return NextResponse.json({ ok: true, saved });
    }

    if (action === 'generate_recs') {
      const created = await generateRecommendations(locationId);
      return NextResponse.json({ ok: true, created });
    }

    if (action === 'resolve') {
      if (!body.rec_id) return NextResponse.json({ error: 'rec_id fehlt' }, { status: 400 });
      const resolution = (body.resolution ?? 'dismissed') as 'accepted' | 'dismissed' | 'applied';
      await resolveRecommendation(body.rec_id, locationId, resolution);
      return NextResponse.json({ ok: true });
    }

    if (action === 'prune') {
      const result = await pruneZoneRevenueSnapshots(90);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
