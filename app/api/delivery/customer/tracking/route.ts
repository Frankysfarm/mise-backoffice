/**
 * GET /api/delivery/customer/tracking
 *
 * Öffentlicher Tracking-Endpunkt für die Storefront — Phase 307
 *
 * Gibt Status + ETA-Minuten für eine Bestellung zurück.
 * Wird von LiveEtaCountdown (20s-Polling) genutzt.
 *
 * Query-Parameter:
 *   order_id  — UUID der Bestellung (customer_orders.id)
 *
 * Response:
 *   { status: string, eta_min: number | null }
 *
 * Kein Auth — order_id (UUID) ist nicht-erratbar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id');

  if (!orderId || orderId.length < 8) {
    return NextResponse.json({ error: 'order_id erforderlich' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();

    const { data: order } = await sb
      .from('customer_orders')
      .select('id, status, typ, eta_earliest, mise_driver_id, mise_batch_id, kunde_lat, kunde_lng')
      .eq('id', orderId)
      .eq('typ', 'lieferung')
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    // Berechne eta_min:
    // 1. Wenn Fahrer in Transit → aus Fahrer-GPS-Position
    // 2. Sonst → aus eta_earliest minus jetzt
    let eta_min: number | null = null;

    if (order.mise_driver_id && order.kunde_lat && order.kunde_lng) {
      const { data: pos } = await sb
        .from('driver_live_positions')
        .select('lat, lng, speed_kmh, updated_at')
        .eq('driver_id', order.mise_driver_id)
        .maybeSingle();

      if (pos) {
        const staleSec = (Date.now() - new Date(pos.updated_at).getTime()) / 1000;
        if (staleSec < 120) {
          const dLat = (order.kunde_lat - pos.lat) * Math.PI / 180;
          const dLng = (order.kunde_lng - pos.lng) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(pos.lat * Math.PI / 180) *
            Math.cos(order.kunde_lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
          const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const speedKmh = (pos.speed_kmh && pos.speed_kmh > 1) ? pos.speed_kmh : 18;
          eta_min = Math.max(1, Math.ceil((distKm / speedKmh) * 60));
        }
      }
    }

    if (eta_min === null && order.eta_earliest) {
      const diffMin = (new Date(order.eta_earliest).getTime() - Date.now()) / 60_000;
      eta_min = diffMin > 0 ? Math.round(diffMin) : 0;
    }

    return NextResponse.json({
      status: order.status,
      eta_min,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
