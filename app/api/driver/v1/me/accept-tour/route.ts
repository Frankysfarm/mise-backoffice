import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { acceptAsTechnicalAck } from '../../_lib/accept-as-ack';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let uid: string | null = null;
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (bearer) {
    const { data } = await createServiceClient().auth.getUser(bearer[1].trim());
    uid = data.user?.id ?? null;
  }
  if (!uid) {
    const { data } = await (await createClient()).auth.getUser();
    uid = data.user?.id ?? null;
  }
  if (!uid) return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED' }, { status: 401 });
  const service = createServiceClient();
  const { data: driver, error } = await service.from('mise_drivers')
    .select('id').eq('auth_user_id', uid).maybeSingle();
  if (error) return NextResponse.json({ ok: false, reason_code: 'DRIVER_LOOKUP_FAILED' }, { status: 500 });
  if (!driver) return NextResponse.json({ ok: false, reason_code: 'DRIVER_NOT_FOUND' }, { status: 404 });
  return acceptAsTechnicalAck(service, driver.id, body);
}
