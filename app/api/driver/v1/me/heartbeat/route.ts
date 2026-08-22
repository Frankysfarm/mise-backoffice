import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getSetting } from '@/lib/delivery/config';
import { hasCurrentDriverSession } from '@/lib/delivery/driver-shift-eligibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// App meldet "ich bin gerade aktiv/offen" -> push-flush unterdrueckt den VoIP-Anruf,
// solange der Fahrer in der App ist (Realtime zeigt neue Orders dann live).
export async function POST(req: NextRequest) {
  let uid: string | null = null;
  const auth = req.headers.get('authorization') ?? '';
  const mm = /^Bearer (.+)$/i.exec(auth);
  if (mm) {
    const svc = createServiceClient();
    const { data } = await svc.auth.getUser(mm[1].trim());
    if (data?.user) uid = data.user.id;
  }
  if (!uid) {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (data?.user) uid = data.user.id;
  }
  if (!uid) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const svc = createServiceClient();
  const now = new Date().toISOString();
  await svc.from('mise_drivers')
    .update({ last_active_at: now, last_foreground_at: now })
    .eq('auth_user_id', uid);
  // Selbstheilung wie in der Position-Route: Wer die App wieder öffnet, ist online.
  // Sonst findet sich der Fahrer nach einer Bildschirmpause offline wieder und muss
  // auf den ersten GPS-Fix warten, um zurückzukommen (Founder-Befund 14.08.).
  const { data: driver } = await svc.from('mise_drivers')
    .select('id,active,state,shift_started_at,dispatch_availability')
    .eq('auth_user_id', uid)
    .maybeSingle();
  const { data: employee } = await svc.from('employees')
    .select('location_id')
    .eq('auth_user_id', uid)
    .maybeSingle();
  // Nur eine bereits freigegebene Schicht selbst heilen. Manuelle, automatische
  // oder Admin-Pausen werden niemals durch bloßes Öffnen der App aufgehoben.
  if (driver?.active && driver.dispatch_availability === 'available'
      && ['offline', 'stale'].includes(driver.state as string) && employee?.location_id) {
    const [cutoffMinute, maxHours] = await Promise.all([
      getSetting(employee.location_id as string, 'driver_shift_cutoff_minute'),
      getSetting(employee.location_id as string, 'driver_session_max_hours'),
    ]);
    if (hasCurrentDriverSession(driver.shift_started_at as string | null, new Date(), cutoffMinute, maxHours)) {
      await svc.from('mise_drivers').update({ state: 'idle' }).eq('id', driver.id);
    }
  }
  return NextResponse.json({ ok: true });
}
