/**
 * GET  /api/delivery/driver/messages
 * POST /api/delivery/driver/messages  { broadcast_id }  → Lesebestätigung
 *
 * Fahrer-App: aktive Betriebsnachrichten abrufen + als gelesen markieren.
 * Auth: eingeloggter Mitarbeiter mit kann_ausliefern=true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveBroadcasts, markBroadcastRead } from '@/lib/delivery/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveDriver(userId: string): Promise<{
  employeeId: string;
  locationId: string;
} | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('id, location_id')
    .eq('auth_user_id', userId)
    .eq('kann_ausliefern', true)
    .maybeSingle();
  if (!data?.location_id) return null;
  return { employeeId: data.id as string, locationId: data.location_id as string };
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ messages: [] });

  const messages = await getActiveBroadcasts(driver.locationId, driver.employeeId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 403 });

  let body: { broadcast_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  if (!body.broadcast_id) {
    return NextResponse.json({ error: 'broadcast_id fehlt' }, { status: 400 });
  }

  await markBroadcastRead(body.broadcast_id, driver.employeeId);
  return NextResponse.json({ ok: true });
}
