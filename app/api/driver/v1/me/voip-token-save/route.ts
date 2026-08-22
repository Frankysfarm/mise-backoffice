import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { voip_push_token?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const tok = body.voip_push_token;
  if (typeof tok !== 'string' || tok.length < 10) {
    return NextResponse.json({ error: 'bad token' }, { status: 400 });
  }
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
  const { error } = await svc
    .from('mise_drivers')
    .update({ voip_push_token: tok, voip_push_token_updated_at: new Date().toISOString() })
    .eq('auth_user_id', uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  console.log('[VOIP-SAVE] OK', uid);
  return NextResponse.json({ ok: true });
}
