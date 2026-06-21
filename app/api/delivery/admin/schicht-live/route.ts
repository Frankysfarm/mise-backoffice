/**
 * GET  /api/delivery/admin/schicht-live
 *      → Live-Schicht-KPIs: Umsatz, Bestellungen, Lieferungen, Stornos, Fahrer, Ziel
 *
 * POST /api/delivery/admin/schicht-live
 *      body: { action: 'set-target', day_of_week: 0-6, umsatz_ziel: number, lieferungen_ziel: number }
 *      → Ziele für den Wochentag setzen
 *
 * Auth: eingeloggter Employee (Admin/Manager/Dispatcher)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSchichtLiveKpis, setSchichtTarget } from '@/lib/delivery/schicht-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const validRoles = ['admin', 'manager', 'dispatcher'];
  if (!emp?.location_id || !validRoles.includes(emp.rolle as string)) return null;

  const paramId = req.nextUrl.searchParams.get('location_id');
  return (paramId ?? emp.location_id) as string;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const kpis = await getSchichtLiveKpis(locationId);
    return NextResponse.json(kpis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'set-target') {
    const dayOfWeek      = Number(body.day_of_week ?? 0);
    const umsatzZiel     = Number(body.umsatz_ziel ?? 800);
    const lieferungenZiel = Number(body.lieferungen_ziel ?? 40);

    if (dayOfWeek < 0 || dayOfWeek > 6 || isNaN(dayOfWeek)) {
      return NextResponse.json({ error: 'day_of_week muss 0–6 sein' }, { status: 400 });
    }
    if (umsatzZiel <= 0 || lieferungenZiel <= 0) {
      return NextResponse.json({ error: 'Ziele müssen > 0 sein' }, { status: 400 });
    }

    const result = await setSchichtTarget({
      locationId,
      dayOfWeek,
      umsatzZiel,
      lieferungenZiel,
    });
    return NextResponse.json({ ok: true, target: result });
  }

  return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
}
