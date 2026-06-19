/**
 * GET  /api/delivery/admin/shift-goals
 * POST /api/delivery/admin/shift-goals
 *
 * GET  — Gibt Schichtziel-Konfiguration + Ist-Werte der aktuellen Schicht zurück.
 *         TagesZielCockpit pollt diesen Endpunkt alle 60 s.
 *
 * POST — Speichert Schichtziele:
 *   { targetOrders?, targetRevenue?, shiftHoursTotal?, shiftStartHour? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getShiftGoalsDashboard,
  upsertShiftGoals,
} from '@/lib/delivery/shift-goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (
    (emp?.location_id as string | null) ??
    req.nextUrl.searchParams.get('location_id') ??
    null
  );
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId)
    return NextResponse.json(
      { error: 'Nicht authentifiziert oder kein Standort' },
      { status: 401 },
    );

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const { getShiftGoals } = await import('@/lib/delivery/shift-goals');
    const config = await getShiftGoals(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getShiftGoalsDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId)
    return NextResponse.json(
      { error: 'Nicht authentifiziert oder kein Standort' },
      { status: 401 },
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  await upsertShiftGoals(locationId, {
    ...(typeof b.targetOrders === 'number' && { targetOrders: b.targetOrders }),
    ...(typeof b.targetRevenue === 'number' && { targetRevenue: b.targetRevenue }),
    ...(typeof b.shiftHoursTotal === 'number' && { shiftHoursTotal: b.shiftHoursTotal }),
    ...(typeof b.shiftStartHour === 'number' && { shiftStartHour: b.shiftStartHour }),
  });

  const dashboard = await getShiftGoalsDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}
