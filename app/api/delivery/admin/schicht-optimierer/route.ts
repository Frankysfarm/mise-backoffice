/**
 * GET  /api/delivery/admin/schicht-optimierer?location_id=...
 *      → Vorschläge + Ist-Besetzung aller 7 Wochentage
 *      ?wochentag=0–6  → nur diesen Tag
 *
 * POST /api/delivery/admin/schicht-optimierer
 *      { action: 'compute' }     → Vorschläge für diese Location berechnen
 *      { action: 'compute-all' } → Alle Standorte berechnen (Admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  computeVorschlaege,
  computeVorschlaegeAllLocations,
  getVorschlaegeWithIst,
} from '@/lib/delivery/schicht-optimierer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveEmployee(
  req: NextRequest,
): Promise<{ locationId: string; rolle: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;

  const paramId = req.nextUrl.searchParams.get('location_id');
  return {
    locationId: (paramId ?? emp.location_id) as string,
    rolle:      emp.rolle as string,
  };
}

export async function GET(req: NextRequest) {
  const emp = await resolveEmployee(req);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tags = await getVorschlaegeWithIst(emp.locationId);

    const dowParam = req.nextUrl.searchParams.get('wochentag');
    const result   = dowParam !== null
      ? tags.filter(t => t.wochentag === parseInt(dowParam, 10))
      : tags;

    return NextResponse.json({ locationId: emp.locationId, vorschlaege: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const emp = await resolveEmployee(req);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'compute') {
    const result = await computeVorschlaege(emp.locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'compute-all') {
    if (!['admin', 'manager'].includes(emp.rolle)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = await computeVorschlaegeAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
}
