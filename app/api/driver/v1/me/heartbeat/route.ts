import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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
  await svc.from('mise_drivers').update({ last_active_at: new Date().toISOString() }).eq('auth_user_id', uid);
  return NextResponse.json({ ok: true });
}
