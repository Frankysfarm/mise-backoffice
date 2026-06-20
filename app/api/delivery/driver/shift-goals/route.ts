/**
 * GET /api/delivery/driver/shift-goals
 *
 * Eigene Schicht-Ziele und Fortschritt für den eingeloggten Fahrer.
 * Gibt aktuellen Fortschritt (Stops / € / Score) inkl. Pace-Label zurück.
 *
 * Auth: Fahrer eingeloggt (mise_drivers.auth_user_id = user.id)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getMyShiftGoalProgress } from '@/lib/delivery/driver-shift-goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 404 });
  const driverId = (driver as { id: string }).id;

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = (emp as { location_id?: string } | null)?.location_id;
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 404 });

  const progress = await getMyShiftGoalProgress(driverId, locationId);
  if (!progress) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

  return NextResponse.json(progress);
}
