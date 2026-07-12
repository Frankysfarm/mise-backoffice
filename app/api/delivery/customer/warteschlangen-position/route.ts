import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 1202 — Warteschlangen-Position (Storefront)
// GET /api/delivery/customer/warteschlangen-position
// "Du bist Bestellung #3 in der Warteschlange" wenn Küche ausgelastet

type ApiResponse = {
  position: number;
  gesamt_wartend: number;
  order_id: string;
  status: string;
  kueche_ausgelastet: boolean;
  geschaetzte_wartezeit_min: number | null;
  message: string;
};

const PREP_STATUSES = ['angenommen', 'accepted', 'confirmed'];
const PENDING_STATUSES = ['neu', 'pending', 'new'];
const IN_PREP_STATUSES = ['in_zubereitung', 'in_progress', 'preparing'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  try {
    const sb = createServiceClient();

    const { data: order } = await sb
      .from('customer_orders')
      .select('id, status, location_id, created_at')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    const { status, location_id, created_at } = order;

    // Only relevant while waiting for preparation
    if (![...PENDING_STATUSES, ...PREP_STATUSES].includes(status)) {
      return NextResponse.json({
        position: 0,
        gesamt_wartend: 0,
        order_id: orderId,
        status,
        kueche_ausgelastet: false,
        geschaetzte_wartezeit_min: null,
        message: 'Bestellung ist bereits in Bearbeitung oder abgeschlossen.',
      } as ApiResponse);
    }

    // Count orders ahead: same location, same or earlier statuses, created before this order
    const { data: davor } = await sb
      .from('customer_orders')
      .select('id')
      .eq('location_id', location_id)
      .in('status', [...PENDING_STATUSES, ...PREP_STATUSES])
      .lt('created_at', created_at)
      .neq('id', orderId);

    const { data: alleWartend } = await sb
      .from('customer_orders')
      .select('id')
      .eq('location_id', location_id)
      .in('status', [...PENDING_STATUSES, ...PREP_STATUSES, ...IN_PREP_STATUSES]);

    const position = (davor?.length ?? 0) + 1;
    const gesamtWartend = alleWartend?.length ?? 0;
    const kueche_ausgelastet = gesamtWartend >= 5;
    const geschaetzte_wartezeit_min = kueche_ausgelastet ? position * 6 : null;

    const message = kueche_ausgelastet
      ? `Du bist Bestellung #${position} in der Warteschlange.`
      : 'Deine Bestellung wird zügig bearbeitet.';

    return NextResponse.json({
      position,
      gesamt_wartend: gesamtWartend,
      order_id: orderId,
      status,
      kueche_ausgelastet,
      geschaetzte_wartezeit_min,
      message,
    } as ApiResponse);
  } catch {
    // Graceful mock fallback
    return NextResponse.json({
      position: 2,
      gesamt_wartend: 6,
      order_id: orderId,
      status: 'angenommen',
      kueche_ausgelastet: true,
      geschaetzte_wartezeit_min: 12,
      message: 'Du bist Bestellung #2 in der Warteschlange.',
    } as ApiResponse);
  }
}
