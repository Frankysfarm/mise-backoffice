/**
 * GET+POST /api/delivery/admin/zone-capacity-balancer
 *
 * Zone Capacity Balancer Admin API — Phase 307
 *
 * GET  ?action=dashboard   → Zonen-Kapazitäts-Dashboard (Snapshot + Empfehlungen)
 * POST action=snap         → Manuellen Snapshot auslösen
 * POST action=accept       → Empfehlung annehmen (body: { suggestion_id })
 * POST action=dismiss      → Empfehlung verwerfen (body: { suggestion_id })
 * POST action=prune        → Alte Snapshots löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getBalancerDashboard,
  snapZoneCapacity,
  generateRebalancingSuggestions,
  resolveRebalancingSuggestion,
  pruneZoneCapacitySnapshots,
} from '@/lib/delivery/zone-capacity-balancer';

export const dynamic = 'force-dynamic';

async function getLocationId(
  sb: Awaited<ReturnType<typeof createClient>>,
  override?: string | null,
): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (override) {
    const { data: emp } = await sb
      .from('employees')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    if (emp?.tenant_id === override) return override;
    return null;
  }

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id, location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.tenant_id ?? emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await getLocationId(
      await sb,
      req.nextUrl.searchParams.get('location_id'),
    );
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dashboard = await getBalancerDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await getLocationId(await sb, req.nextUrl.searchParams.get('location_id'));
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) as Record<string, string>;
    const action = body.action ?? req.nextUrl.searchParams.get('action') ?? 'snap';

    if (action === 'snap') {
      const snaps = await snapZoneCapacity(locationId);
      const suggestions = await generateRebalancingSuggestions(locationId, snaps);
      return NextResponse.json({ ok: true, zones: snaps.length, suggestions });
    }

    if (action === 'accept' || action === 'dismiss') {
      const { suggestion_id } = body;
      if (!suggestion_id) return NextResponse.json({ error: 'suggestion_id erforderlich' }, { status: 400 });
      const ok = await resolveRebalancingSuggestion(suggestion_id, locationId, action);
      return NextResponse.json({ ok });
    }

    if (action === 'prune') {
      const result = await pruneZoneCapacitySnapshots(7);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
