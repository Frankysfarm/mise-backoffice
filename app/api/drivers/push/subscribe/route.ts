import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const { subscription } = body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };
  if (!subscription?.endpoint) return NextResponse.json({ ok: false, error: 'Invalid subscription' }, { status: 400 });

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('id, kann_ausliefern')
    .eq('auth_user_id', user.id).eq('kann_ausliefern', true).maybeSingle();
  if (!emp) return NextResponse.json({ ok: false, error: 'Not a driver' }, { status: 403 });

  const { error } = await svc.from('driver_push_subscriptions').upsert({
    employee_id: emp.id,
    endpoint: subscription.endpoint,
    p256dh_key: subscription.keys.p256dh,
    auth_key: subscription.keys.auth,
  }, { onConflict: 'employee_id,endpoint' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  return NextResponse.json({ ok: true, publicKey: key });
}
