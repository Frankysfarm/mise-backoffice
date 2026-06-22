/**
 * GET  /api/delivery/admin/schicht-ziel-optimizer
 *      → Vorschläge für alle 7 Wochentage lesen
 *
 * POST /api/delivery/admin/schicht-ziel-optimizer
 *      { action: 'generate', weeks?: number }   → Neu berechnen (Analyse schicht_roi_daily)
 *      { action: 'approve',  day_of_week: 0–6 } → Vorschlag freigeben + schicht_targets updaten
 *      { action: 'decline',  day_of_week: 0–6 } → Vorschlag ablehnen
 *      { action: 'apply-all' }                  → Alle approved → schicht_targets
 *
 * Auth: Admin oder Manager
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateZielVorschlaege,
  getZielVorschlaege,
  approveVorschlag,
  declineVorschlag,
  applyAllApproved,
} from '@/lib/delivery/schicht-ziel-optimizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveEmployee(req: NextRequest): Promise<{ locationId: string; rolle: string } | null> {
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
    const vorschlaege = await getZielVorschlaege(emp.locationId);
    return NextResponse.json({ locationId: emp.locationId, vorschlaege });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const emp = await resolveEmployee(req);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isManager = ['admin', 'manager'].includes(emp.rolle);

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'generate') {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const weeks = typeof body.weeks === 'number' ? body.weeks : 8;
    const result = await generateZielVorschlaege(emp.locationId, weeks);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'approve') {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const dow = Number(body.day_of_week);
    if (isNaN(dow) || dow < 0 || dow > 6) {
      return NextResponse.json({ error: 'day_of_week muss 0–6 sein' }, { status: 400 });
    }
    const result = await approveVorschlag(emp.locationId, dow);
    return NextResponse.json({ ok: result.ok, message: result.message });
  }

  if (action === 'decline') {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const dow = Number(body.day_of_week);
    if (isNaN(dow) || dow < 0 || dow > 6) {
      return NextResponse.json({ error: 'day_of_week muss 0–6 sein' }, { status: 400 });
    }
    const result = await declineVorschlag(emp.locationId, dow);
    return NextResponse.json({ ok: result.ok });
  }

  if (action === 'apply-all') {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await applyAllApproved(emp.locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
}
