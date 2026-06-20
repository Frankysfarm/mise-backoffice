/**
 * GET  /api/delivery/admin/zone-batch-optimizer
 *   ?action=dashboard|config|suggestions
 *
 * POST /api/delivery/admin/zone-batch-optimizer
 *   body: { action: 'apply'|'reject'|'update_config'|'run_now'|'prune'|'expire' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getConfig,
  upsertConfig,
  generateBatchSuggestions,
  generateAllLocations,
  applyBatchSuggestion,
  rejectBatchSuggestion,
  expireStaleSuggestions,
  pruneOldSuggestions,
} from '@/lib/delivery/zone-batch-optimizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(req.url);
  const qsLocId = searchParams.get('location_id');
  if (qsLocId) return qsLocId;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    return NextResponse.json(await getConfig(locationId));
  }
  if (action === 'suggestions') {
    const dashboard = await getDashboard(locationId);
    return NextResponse.json({ suggestions: dashboard.pendingSuggestions });
  }
  return NextResponse.json(await getDashboard(locationId));
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('id, location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  const locationId =
    (body.location_id as string | null) ??
    (emp?.location_id as string | null);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const empId = emp?.id as string | undefined;

  if (action === 'apply') {
    const id = body.suggestion_id as string;
    if (!id) return NextResponse.json({ error: 'suggestion_id fehlt' }, { status: 400 });
    return NextResponse.json(await applyBatchSuggestion(id, empId));
  }

  if (action === 'reject') {
    const id = body.suggestion_id as string;
    if (!id) return NextResponse.json({ error: 'suggestion_id fehlt' }, { status: 400 });
    return NextResponse.json(await rejectBatchSuggestion(id, empId));
  }

  if (action === 'update_config') {
    const cfg = await upsertConfig(locationId, {
      isEnabled: body.is_enabled as boolean | undefined,
      maxStops: body.max_stops !== undefined ? Number(body.max_stops) : undefined,
      maxRadiusKm: body.max_radius_km !== undefined ? Number(body.max_radius_km) : undefined,
      autoApplyMinScore: body.auto_apply_min_score !== undefined ? Number(body.auto_apply_min_score) : undefined,
      minKmSavingsPct: body.min_km_savings_pct !== undefined ? Number(body.min_km_savings_pct) : undefined,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'run_now') {
    const result = await generateBatchSuggestions(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'run_all') {
    const result = await generateAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'expire') {
    const expired = await expireStaleSuggestions(locationId);
    return NextResponse.json({ ok: true, expired });
  }

  if (action === 'prune') {
    const days = Number(body.days ?? 30);
    const result = await pruneOldSuggestions(days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
}
