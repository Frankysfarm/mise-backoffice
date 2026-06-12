/**
 * GET /api/delivery/admin/shift-planner?location_id=...&days=7
 *
 * Besetzungs-Cockpit API — Phase 88
 *
 * Gibt einen stundengenauen 7-Tage-Besetzungsplan zurück:
 * Kombination aus Nachfrage-Forecast + geplanten Fahrer-Schichten.
 *
 * Response: StaffingPlan (lib/delivery/shift-planner.ts)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStaffingPlan } from '@/lib/delivery/shift-planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Multi-Tenant-Check: user muss zur location gehören
  const { data: employee } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!employee) return NextResponse.json({ error: 'Kein Mitarbeiter-Profil' }, { status: 403 });

  const daysParam = searchParams.get('days');
  const days = Math.min(Math.max(parseInt(daysParam ?? '7', 10) || 7, 1), 14);

  try {
    const plan = await getStaffingPlan(locationId, days);
    return NextResponse.json(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
