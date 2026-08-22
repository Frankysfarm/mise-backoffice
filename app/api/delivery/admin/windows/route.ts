/**
 * GET  /api/delivery/admin/windows?action=slots          → Slot-Konfiguration
 * GET  /api/delivery/admin/windows?action=availability   → Verfügbarkeits-Übersicht (heute+morgen)
 * GET  /api/delivery/admin/windows?action=bookings&date= → Buchungsliste für einen Tag
 * GET  /api/delivery/admin/windows?action=stats          → Tages-Statistiken
 *
 * POST /api/delivery/admin/windows
 *   { action: 'configure', slots: SlotConfigInput[] }   → Slot-Konfiguration setzen
 *   { action: 'toggle_slot', slot_id, is_active }        → Slot aktivieren/deaktivieren
 *   { action: 'cancel_booking', booking_id }             → Buchung admin-seitig stornieren
 *   { action: 'process_dispatch' }                       → Fällige Windows jetzt freigeben (Debug)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSlotConfig,
  upsertSlotConfig,
  setSlotActive,
  getWindowStats,
  listWindowBookings,
  processWindowDispatch,
  getAvailableSlots,
  type SlotConfigInput,
} from '@/lib/delivery/windows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(sb: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb.from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const locationId = await getLocationId(sb);
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'stats';

  if (action === 'slots') {
    const slots = await getSlotConfig(locationId);
    return NextResponse.json({ slots, total: slots.length });
  }

  if (action === 'availability') {
    const today    = new Date();
    const tomorrow = new Date(Date.now() + 86400_000);
    const [slotsToday, slotsTomorrow] = await Promise.all([
      getAvailableSlots(locationId, today),
      getAvailableSlots(locationId, tomorrow),
    ]);
    return NextResponse.json({
      today: {
        date: today.toISOString().slice(0, 10),
        slots: slotsToday,
        total: slotsToday.length,
      },
      tomorrow: {
        date: tomorrow.toISOString().slice(0, 10),
        slots: slotsTomorrow,
        total: slotsTomorrow.length,
      },
    });
  }

  if (action === 'bookings') {
    const date = searchParams.get('date') ?? undefined;
    const bookings = await listWindowBookings(locationId, date);
    return NextResponse.json({ bookings, total: bookings.length });
  }

  // default: stats
  const stats = await getWindowStats(locationId);
  return NextResponse.json(stats);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const locationId = await getLocationId(sb);
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body['action'] as string | undefined;

  if (action === 'configure') {
    const slots = body['slots'] as SlotConfigInput[] | undefined;
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: 'slots Array fehlt oder leer' }, { status: 400 });
    }
    // Validierung: day_of_week 0–6, slot_start/end HH:MM
    const timeRe = /^\d{2}:\d{2}$/;
    for (const s of slots) {
      if (s.day_of_week < 0 || s.day_of_week > 6) {
        return NextResponse.json({ error: `Ungültiger day_of_week: ${s.day_of_week}` }, { status: 400 });
      }
      if (!timeRe.test(s.slot_start_utc) || !timeRe.test(s.slot_end_utc)) {
        return NextResponse.json({ error: 'slot_start_utc / slot_end_utc muss HH:MM sein' }, { status: 400 });
      }
    }
    const result = await upsertSlotConfig(locationId, slots);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, upserted: result.upserted });
  }

  if (action === 'toggle_slot') {
    const slotId  = body['slot_id'] as string | undefined;
    const isActive = body['is_active'] as boolean | undefined;
    if (!slotId || isActive === undefined) {
      return NextResponse.json({ error: 'slot_id und is_active erforderlich' }, { status: 400 });
    }
    const result = await setSlotActive(slotId, locationId, isActive);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel_booking') {
    const bookingId = body['booking_id'] as string | undefined;
    if (!bookingId) return NextResponse.json({ error: 'booking_id erforderlich' }, { status: 400 });

    // Import cancel inline
    const { cancelWindowBooking } = await import('@/lib/delivery/windows');
    const result = await cancelWindowBooking(bookingId, locationId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'process_dispatch') {
    const result = await processWindowDispatch(locationId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${action ?? '?'}` }, { status: 400 });
}
