/**
 * GET /api/delivery/order/eta-tracking
 *
 * Phase 955 — Live-ETA Fahrer-Tracking (Storefront)
 *
 * Gibt aktuelle ETA, Fahrername und Lieferphase für eine Bestellung zurück.
 * Genutzt von Phase955LiveEtaFahrerTracking (storefront).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type OrderPhase = 'kochend' | 'bereit' | 'abgeholt' | 'unterwegs' | 'nah';

function mockResponse(orderId: string) {
  return {
    orderId,
    eta_min: 18,
    fahrer_name: null,
    fahrer_entfernung_m: null,
    phase: 'kochend' as OrderPhase,
    generatedAt: new Date().toISOString(),
  };
}

function statusToPhase(status: string, entfernung?: number | null): OrderPhase {
  switch (status) {
    case 'delivered':
    case 'abgeschlossen':
      return 'nah';
    case 'on_route':
    case 'unterwegs':
    case 'in_delivery':
    case 'dispatched':
      if (entfernung != null && entfernung < 500) return 'nah';
      return 'unterwegs';
    case 'at_restaurant':
    case 'abgeholt':
    case 'picked_up':
      return 'abgeholt';
    case 'ready':
    case 'bereit':
      return 'bereit';
    default:
      return 'kochend';
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();

    const { data: order, error } = await sb
      .from('customer_orders')
      .select(`
        id,
        status,
        eta_minutes,
        created_at,
        driver_id,
        mise_drivers (
          id,
          name,
          last_lat,
          last_lng
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json(mockResponse(orderId));
    }

    const driver = Array.isArray(order.mise_drivers)
      ? order.mise_drivers[0]
      : (order.mise_drivers as { id: string; name: string | null; last_lat: number | null; last_lng: number | null } | null);

    const createdAt = new Date(order.created_at as string).getTime();
    const elapsedMin = (Date.now() - createdAt) / 60_000;
    const originalEta = (order.eta_minutes as number | null) ?? 30;
    const etaMin = Math.max(0, Math.round(originalEta - elapsedMin));

    const phase = statusToPhase(order.status as string, null);

    return NextResponse.json({
      orderId: order.id,
      eta_min: etaMin,
      fahrer_name: driver?.name ?? null,
      fahrer_entfernung_m: null,
      phase,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockResponse(orderId));
  }
}
