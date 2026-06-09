import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/me/accept-tour  { batch_id? }
 * Vom nativen CallKit-„Annehmen" aufgerufen: setzt die offene (pending_acceptance)
 * Tour des Fahrers auf assigned. Bearer ODER Cookie.
 */
export async function POST(req: NextRequest) {
  let body: { batch_id?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  let uid: string | null = null;
  const auth = req.headers.get('authorization') ?? '';
  const mm = /^Bearer (.+)$/i.exec(auth);
  if (mm) { const svc = createServiceClient(); const { data } = await svc.auth.getUser(mm[1].trim()); if (data?.user) uid = data.user.id; }
  if (!uid) { const sb = await createClient(); const { data } = await sb.auth.getUser(); if (data?.user) uid = data.user.id; }
  if (!uid) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const svc = createServiceClient();
  const { data: drv } = await svc.from('mise_drivers').select('id').eq('auth_user_id', uid).maybeSingle();
  if (!drv) return NextResponse.json({ error: 'kein Fahrer' }, { status: 404 });

  let query = svc.from('mise_delivery_batches').select('id').eq('driver_id', drv.id).eq('state', 'pending_acceptance');
  if (typeof body.batch_id === 'string' && body.batch_id.length > 10) {
    query = query.eq('id', body.batch_id);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }
  const { data: batch } = await query.maybeSingle();
  if (!batch) return NextResponse.json({ ok: false, error: 'keine offene Tour' });

  await svc.from('mise_delivery_batches').update({ state: 'assigned', accepted_at: new Date().toISOString() }).eq('id', batch.id);
  console.log('[ACCEPT-TOUR] OK', drv.id, batch.id);
  return NextResponse.json({ ok: true, batch_id: batch.id });
}
