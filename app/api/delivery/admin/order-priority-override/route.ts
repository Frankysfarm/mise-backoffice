/**
 * POST   /api/delivery/admin/order-priority-override
 * DELETE /api/delivery/admin/order-priority-override?order_id=...
 * GET    /api/delivery/admin/order-priority-override?order_id=...
 *        /api/delivery/admin/order-priority-override?location_id=...
 *
 * Dispatch-Prioritäts-Override — Manueller Prioritäts-Override je Bestellung.
 * Phase 487
 *
 * Auth: admin (createClient)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PRIORITIES = ['hoch', 'mittel', 'niedrig'] as const;
type Priority = (typeof VALID_PRIORITIES)[number];

interface PostBody {
  order_id: string;
  priority: Priority;
  note?: string;
  location_id?: string;
}

interface CustomerOrderRow {
  id: string;
  location_id: string;
}

interface OverrideRow {
  id: string;
  order_id: string;
  priority: string;
  note: string | null;
  created_at: string;
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { order_id, priority, note, location_id: bodyLocationId } = body;

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }
  if (!VALID_PRIORITIES.includes(priority as Priority)) {
    return NextResponse.json({ error: 'priority must be hoch, mittel, or niedrig' }, { status: 400 });
  }

  let locationId = bodyLocationId ?? null;

  if (!locationId) {
    const { data: orderData } = await sb
      .from('customer_orders')
      .select('id, location_id')
      .eq('id', order_id)
      .single();
    if (!orderData) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }
    locationId = (orderData as unknown as CustomerOrderRow).location_id;
  }

  const upsertPayload = {
    order_id,
    location_id: locationId,
    priority,
    note: note ?? null,
    created_by: user.id,
    created_at: new Date().toISOString(),
  };

  const { data: overrideData, error: upsertError } = await sb
    .from('order_priority_overrides')
    .upsert(upsertPayload, { onConflict: 'order_id' })
    .select('id, order_id, priority, note, created_at')
    .single();

  if (upsertError) {
    console.error('[order-priority-override POST] upsert error:', upsertError);
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, override: overrideData as unknown as OverrideRow });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const { error: deleteError } = await sb
    .from('order_priority_overrides')
    .delete()
    .eq('order_id', orderId);

  if (deleteError) {
    console.error('[order-priority-override DELETE] error:', deleteError);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  const locationId = searchParams.get('location_id');

  if (orderId) {
    const { data: overrideData } = await sb
      .from('order_priority_overrides')
      .select('id, order_id, priority, note, created_at')
      .eq('order_id', orderId)
      .maybeSingle();
    return NextResponse.json({ override: overrideData ?? null });
  }

  if (locationId) {
    const { data: overridesData } = await sb
      .from('order_priority_overrides')
      .select('id, order_id, priority, note, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });
    return NextResponse.json({ overrides: overridesData ?? [] });
  }

  return NextResponse.json({ error: 'order_id or location_id required' }, { status: 400 });
}
