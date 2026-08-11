/**
 * GET /api/delivery/orders/[orderId]/events
 *
 * Öffentlicher Endpunkt mit Tracking-Capability-Token.
 *
 * Nutzung: Tracking-Page lädt Events initial; Realtime-Kanal liefert neue Events live.
 *
 * Response: { events: CustomerDeliveryEvent[] }  (chronologisch aufsteigend)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOrderEvents } from '@/lib/delivery/customer-notify';
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

  const events = await getOrderEvents(orderId);
  return NextResponse.json({ events }, { headers: NO_STORE });
}
