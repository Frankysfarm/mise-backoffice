import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  return NextResponse.json({ ok: true, publicKey: key });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { subscription } = (await req.json()) as { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } };
  if (!subscription?.endpoint) return NextResponse.json({ ok: false, error: 'Invalid subscription' }, { status: 400 });
  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('id, tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  const { error } = await svc.from('owner_push_subscriptions').upsert({
    tenant_id: emp.tenant_id, employee_id: emp.id,
    endpoint: subscription.endpoint, p256dh_key: subscription.keys.p256dh, auth_key: subscription.keys.auth,
  }, { onConflict: 'tenant_id,endpoint' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
