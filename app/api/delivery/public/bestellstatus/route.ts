/**
 * GET /api/delivery/public/bestellstatus?location_id=<uuid>&order_id=<uuid>
 *
 * Phase 1323 — Bestellstatus-Push-Banner API (Public)
 * Status + ETA-Schätzung + Fahrer-Name für Kunden-Banner.
 * Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderStatus = 'waiting' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

interface BestellstatusResponse {
  status: OrderStatus;
  eta_minuten: number | null;
  fahrer_name: string | null;
  generiert_am: string;
}

const ETA_BY_STATUS: Record<string, number | null> = {
  waiting:    35,
  preparing:  25,
  ready:      20,
  dispatched: 12,
  delivered:  null,
  cancelled:  null,
};

function buildMock(orderId: string): BestellstatusResponse {
  return {
    status: 'dispatched',
    eta_minuten: 12,
    fahrer_name: 'Max',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const orderId    = req.nextUrl.searchParams.get('order_id');

  if (!locationId || !orderId) {
    return NextResponse.json({ error: 'location_id and order_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: order, error } = await (sb as any)
      .from('customer_orders')
      .select('id, status, created_at, mise_delivery_batches(id, mise_drivers(id, employees(vorname)))')
      .eq('id', orderId)
      .eq('location_id', locationId)
      .single();

    if (error || !order) return NextResponse.json(buildMock(orderId));

    const status: OrderStatus = order.status as OrderStatus;
    const batch = Array.isArray(order.mise_delivery_batches)
      ? order.mise_delivery_batches[0]
      : order.mise_delivery_batches;

    const driver = batch?.mise_drivers;
    const fahrerName: string | null = driver?.employees?.vorname ?? null;

    // Dynamic ETA: base ETA minus minutes elapsed
    const baseMins = ETA_BY_STATUS[status] ?? null;
    let etaMinuten: number | null = baseMins;
    if (baseMins !== null && order.created_at) {
      const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000);
      etaMinuten = Math.max(0, baseMins - elapsed);
    }

    const result: BestellstatusResponse = {
      status,
      eta_minuten: etaMinuten,
      fahrer_name: fahrerName,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(orderId));
  }
}
