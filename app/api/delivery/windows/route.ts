/**
 * GET /api/delivery/windows?location_id=...&date=YYYY-MM-DD
 *   → Verfügbare Lieferfenster für Storefront-Checkout
 *
 * POST /api/delivery/windows
 *   Body: { order_id, slot_id, location_id, notes? }
 *   → Fenster buchen (kein Auth – orderId als Autorisierung)
 *
 * DELETE /api/delivery/windows?order_id=...&location_id=...
 *   → Buchung stornieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getAvailableSlots,
  bookDeliveryWindow,
  cancelWindowBooking,
  getOrderWindow,
} from '@/lib/delivery/windows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// UUID-Regex für Eingabe-Validierung
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const dateStr    = searchParams.get('date'); // YYYY-MM-DD
  const orderId    = searchParams.get('order_id');

  if (!locationId || !UUID_RE.test(locationId)) {
    return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });
  }

  // Einzelne Buchung für eine Bestellung abrufen
  if (orderId) {
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'order_id ungültig' }, { status: 400 });
    }
    const booking = await getOrderWindow(orderId);
    return NextResponse.json({ booking });
  }

  // Verfügbare Slots für einen Tag
  const date = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  // Ungültiges Datum abfangen
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 });
  }
  // Slots nur für heute oder Zukunft (max 7 Tage voraus)
  const maxDate = new Date(Date.now() + 7 * 86400_000);
  if (date > maxDate) {
    return NextResponse.json({ error: 'Datum zu weit in der Zukunft (max. 7 Tage)' }, { status: 400 });
  }

  const slots = await getAvailableSlots(locationId, date);
  return NextResponse.json({ slots, date: date.toISOString().slice(0, 10) });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { order_id, slot_id, location_id, notes } = body as {
    order_id?: string;
    slot_id?: string;
    location_id?: string;
    notes?: string;
  };

  if (!order_id || !UUID_RE.test(order_id)) {
    return NextResponse.json({ error: 'order_id fehlt oder ungültig' }, { status: 400 });
  }
  if (!slot_id || !UUID_RE.test(slot_id)) {
    return NextResponse.json({ error: 'slot_id fehlt oder ungültig' }, { status: 400 });
  }
  if (!location_id || !UUID_RE.test(location_id)) {
    return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });
  }

  // Bestellung muss zur Location gehören (Tenant-Schutz)
  const sb = createServiceClient();
  const { data: orderCheck } = await sb
    .from('customer_orders')
    .select('id')
    .eq('id', order_id)
    .eq('location_id', location_id)
    .maybeSingle();

  if (!orderCheck) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const result = await bookDeliveryWindow(
    order_id, slot_id, location_id, notes as string | undefined,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId    = searchParams.get('order_id');
  const locationId = searchParams.get('location_id');

  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'order_id fehlt oder ungültig' }, { status: 400 });
  }
  if (!locationId || !UUID_RE.test(locationId)) {
    return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });
  }

  // Buchung für die Bestellung laden
  const booking = await getOrderWindow(orderId);
  if (!booking) {
    return NextResponse.json({ error: 'Keine Buchung gefunden' }, { status: 404 });
  }

  const result = await cancelWindowBooking(booking.id, locationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
