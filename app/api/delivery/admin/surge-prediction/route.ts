/**
 * GET  /api/delivery/admin/surge-prediction?location_id=...
 * POST /api/delivery/admin/surge-prediction
 *
 * GET: Dashboard-Daten (Stats + letzte Vorhersagen)
 *
 * POST action=predict   — Vorhersage manuell auslösen
 * POST action=evaluate  — Vergangene Vorhersagen evaluieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPredictionDashboard,
  predictSurgeForLocation,
  evaluatePastPredictions,
} from '@/lib/delivery/surge-prediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(sb: Awaited<ReturnType<typeof createClient>>, userId: string, qLocationId: string | null): Promise<string | null> {
  if (qLocationId) return qLocationId;
  const { data } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', data.tenant_id as string)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(sb, user.id, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const dashboard = await getPredictionDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string ?? 'predict';
  const locationId = await resolveLocationId(sb, user.id, (body.location_id as string | null) ?? null);
  if (!locationId && action !== 'evaluate') {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  if (action === 'evaluate') {
    const result = await evaluatePastPredictions();
    return NextResponse.json(result);
  }

  if (action === 'predict' && locationId) {
    const result = await predictSurgeForLocation(locationId, { broadcast: true });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
