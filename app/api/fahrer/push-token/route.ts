import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/fahrer/push-token  { expo_push_token: "<64-hex APNs token>" }
 * Cookie-Session-Auth (kein Bearer noetig). Speichert das native Push-Token
 * am mise_drivers-Datensatz des eingeloggten Fahrers.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'nicht eingeloggt' }, { status: 401 });

  let body: { expo_push_token?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const tok = body.expo_push_token;
  if (typeof tok !== 'string' || tok.length < 10) {
    return NextResponse.json({ error: 'kein gueltiges Token' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from('mise_drivers')
    .update({ expo_push_token: tok, push_enabled: true, push_token_updated_at: new Date().toISOString() })
    .eq('auth_user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
