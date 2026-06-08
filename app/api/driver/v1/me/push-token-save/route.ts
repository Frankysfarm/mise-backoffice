import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/push-token-save  { expo_push_token }
 * Unter /api/driver/* -> kommt durch die Middleware. Auth via Bearer (Supabase-JWT)
 * ODER Cookie-Session. Speichert natives APNs-Token am mise_drivers-Datensatz.
 */
export async function POST(req: NextRequest) {
  let body: { expo_push_token?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const tok = body.expo_push_token;
  if (typeof tok !== 'string' || tok.length < 10) {
    console.log('[PUSH-SAVE] bad token');
    return NextResponse.json({ error: 'bad token' }, { status: 400 });
  }

  let authUserId: string | null = null;
  let how = '';

  const auth = req.headers.get('authorization') ?? '';
  const mm = /^Bearer (.+)$/i.exec(auth);
  if (mm) {
    const svc = createServiceClient();
    const { data, error } = await svc.auth.getUser(mm[1].trim());
    if (data?.user) { authUserId = data.user.id; how = 'bearer'; }
    else console.log('[PUSH-SAVE] bearer err:', error?.message);
  }
  if (!authUserId) {
    const sb = await createClient();
    const { data, error } = await sb.auth.getUser();
    if (data?.user) { authUserId = data.user.id; how = 'cookie'; }
    else console.log('[PUSH-SAVE] cookie err:', error?.message);
  }
  if (!authUserId) {
    console.log('[PUSH-SAVE] no auth');
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from('mise_drivers')
    .update({ expo_push_token: tok, push_enabled: true, push_token_updated_at: new Date().toISOString() })
    .eq('auth_user_id', authUserId);
  if (error) {
    console.log('[PUSH-SAVE] db err:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log('[PUSH-SAVE] OK via', how, authUserId);
  return NextResponse.json({ ok: true, via: how });
}
