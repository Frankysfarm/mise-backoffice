import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hasTrackingAccess } from '@/lib/delivery/tracking-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

interface Params {
  params: Promise<{ orderId: string }>;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  if (!UUID_RX.test(orderId)) {
    return NextResponse.json({ error: 'Ungültige Bestellungs-ID' }, { status: 400 });
  }
  if (!(await hasTrackingAccess(req, orderId))) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('order_messages')
    .select('id, sender, nachricht, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Nachrichten konnten nicht geladen werden' }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  if (!UUID_RX.test(orderId)) {
    return NextResponse.json({ error: 'Ungültige Bestellungs-ID' }, { status: 400 });
  }
  if (!(await hasTrackingAccess(req, orderId))) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 500) {
    return NextResponse.json({ error: 'Nachricht muss 1 bis 500 Zeichen enthalten' }, { status: 400 });
  }
  const sb = createServiceClient();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await sb
    .from('order_messages')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('sender', 'kunde')
    .gte('created_at', oneMinuteAgo);
  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Zu viele Nachrichten. Bitte kurz warten.' }, { status: 429 });
  }

  const { data, error } = await sb
    .from('order_messages')
    .insert({ order_id: orderId, sender: 'kunde', nachricht: message })
    .select('id, sender, nachricht, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Nachricht konnte nicht gesendet werden' }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
