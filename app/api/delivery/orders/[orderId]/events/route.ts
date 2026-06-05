/**
 * GET /api/delivery/orders/[orderId]/events
 *
 * Öffentlicher Endpunkt — liefert Customer-Delivery-Events für eine Bestellung.
 * Kein Auth benötigt: orderId ist eine UUID (120-Bit Entropie, praktisch unratbar).
 *
 * Nutzung: Tracking-Page lädt Events initial; Realtime-Kanal liefert neue Events live.
 *
 * Response: { events: CustomerDeliveryEvent[] }  (chronologisch aufsteigend)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOrderEvents } from '@/lib/delivery/customer-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ orderId: string }>;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;

  if (!UUID_RX.test(orderId)) {
    return NextResponse.json({ error: 'Ungültige Bestellungs-ID' }, { status: 400 });
  }

  const events = await getOrderEvents(orderId);
  return NextResponse.json({ events });
}
