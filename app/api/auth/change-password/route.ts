import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { password } = (await req.json().catch(() => null)) as { password?: string } | null ?? {};
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
  }

  // Passwort via Service-Role ändern
  const { error: authErr } = await svc.auth.admin.updateUserById(user.id, { password });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  // Flag entfernen
  await svc
    .from('employees')
    .update({ muss_passwort_aendern: false, passwort_geaendert_am: new Date().toISOString() })
    .eq('auth_user_id', user.id);

  return NextResponse.json({ ok: true });
}
