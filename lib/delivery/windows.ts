/**
 * lib/delivery/windows.ts
 *
 * Delivery Time Window Booking Engine — Phase 39
 *
 * Ermöglicht Kunden, konkrete 30-Minuten-Lieferfenster zu buchen.
 * Operations-Vorteile:
 *  - Gleichmäßigere Last-Verteilung (Spitzen brechen)
 *  - Präzisere Küchenplanung (Start-Zeitpunkt bekannt)
 *  - Premium-Umsatz (extra_fee_eur pro gebuchtem Fenster)
 *
 * Ablauf:
 *  1. Kunde fragt verfügbare Slots via getAvailableSlots() ab
 *  2. Buchung via bookDeliveryWindow() → setzt schedule_status='scheduled'
 *  3. Cron ruft processWindowDispatch() alle 2 Min auf
 *     → Gibt Orders frei wenn window_start - prep_time <= now()
 *  4. Dispatch-Engine greift auf 'released' Orders zu
 *  5. Bei Lieferung: markWindowDelivered() (fire-and-forget)
 *
 * Graceful Fallback: Alle Funktionen fangen Migration-fehlt-Fehler ab
 * und geben leere/Fallback-Daten zurück → kein Fatal-Crash.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from './events';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  id: string;
  location_id: string;
  day_of_week: number;
  slot_start_utc: string;
  slot_end_utc: string;
  capacity: number;
  is_active: boolean;
  slot_type: 'standard' | 'express' | 'scheduled';
  extra_fee_eur: number;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotAvailability {
  slot_id: string;
  location_id: string;
  day_of_week: number;
  slot_start_utc: string;
  slot_end_utc: string;
  capacity: number;
  slot_type: string;
  extra_fee_eur: number;
  label: string | null;
  is_active: boolean;
  booking_date: string;
  window_start_utc: string;
  window_end_utc: string;
  booked_count: number;
  remaining_capacity: number;
  utilization_pct: number;
}

export interface WindowBooking {
  id: string;
  order_id: string;
  slot_id: string;
  location_id: string;
  window_start_utc: string;
  window_end_utc: string;
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'missed' | 'cancelled';
  extra_fee_eur: number;
  confirmed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableSlot {
  slot_id: string;
  window_start_utc: string;
  window_end_utc: string;
  booking_date: string;
  slot_type: string;
  label: string | null;
  extra_fee_eur: number;
  remaining_capacity: number;
  utilization_pct: number;
  is_filling_fast: boolean; // >70% voll
}

export interface WindowStats {
  total_bookings_today: number;
  confirmed: number;
  dispatched: number;
  delivered: number;
  missed: number;
  cancelled: number;
  revenue_today_eur: number;
  avg_utilization_pct: number;
  most_popular_slot: string | null;
  _fallback?: boolean;
}

export interface SlotConfigInput {
  day_of_week: number;       // 0=Mo … 6=So
  slot_start_utc: string;    // 'HH:MM'
  slot_end_utc: string;      // 'HH:MM'
  capacity?: number;
  slot_type?: 'standard' | 'express' | 'scheduled';
  extra_fee_eur?: number;
  label?: string;
}

export interface DispatchWindowResult {
  released: number;
  bookings_confirmed: number;
  order_ids: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Default-Slots (wird verwendet wenn keine Konfiguration vorhanden)
// Standard-Lieferfenster Mo–So 11:00–22:00 UTC, 30-Min-Slots, Kapazität 8
// ─────────────────────────────────────────────────────────────────────────────
function buildDefaultSlots(): SlotConfigInput[] {
  const slots: SlotConfigInput[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    // Slot 11:00–22:00 UTC in 30-Min-Schritten
    for (let h = 11; h < 22; h++) {
      for (const min of [0, 30]) {
        const endH = min === 30 ? h + 1 : h;
        const endMin = min === 30 ? 0 : 30;
        if (endH >= 22) continue;
        slots.push({
          day_of_week: dow,
          slot_start_utc: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
          slot_end_utc: `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
          capacity: 8,
          slot_type: 'standard',
          extra_fee_eur: 0,
        });
      }
    }
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot-Konfiguration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liefert alle Slots einer Location (auch inaktive).
 * Erstellt Default-Slots wenn noch keine vorhanden (on-demand).
 */
export async function getSlotConfig(locationId: string): Promise<TimeSlot[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('delivery_time_slots')
    .select('*')
    .eq('location_id', locationId)
    .order('day_of_week')
    .order('slot_start_utc');

  if (error) return []; // Migration 033 noch nicht ausgeführt

  if (!data || data.length === 0) {
    // Erstmalige Konfiguration: Defaults anlegen
    await upsertSlotConfig(locationId, buildDefaultSlots());
    const { data: fresh } = await sb
      .from('delivery_time_slots')
      .select('*')
      .eq('location_id', locationId)
      .order('day_of_week')
      .order('slot_start_utc');
    return (fresh ?? []) as TimeSlot[];
  }

  return data as TimeSlot[];
}

/**
 * Setzt Slot-Konfiguration für eine Location (UPSERT).
 * Bestehende Slots werden aktualisiert, neue angelegt.
 */
export async function upsertSlotConfig(
  locationId: string,
  slots: SlotConfigInput[],
): Promise<{ upserted: number; error?: string }> {
  const sb = createServiceClient();

  const rows = slots.map((s) => ({
    location_id: locationId,
    day_of_week: s.day_of_week,
    slot_start_utc: s.slot_start_utc,
    slot_end_utc: s.slot_end_utc,
    capacity: s.capacity ?? 8,
    slot_type: s.slot_type ?? 'standard',
    extra_fee_eur: s.extra_fee_eur ?? 0,
    label: s.label ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await sb
    .from('delivery_time_slots')
    .upsert(rows, { onConflict: 'location_id,day_of_week,slot_start_utc', count: 'exact' });

  if (error) return { upserted: 0, error: error.message };
  return { upserted: count ?? rows.length };
}

/**
 * Aktiviert / deaktiviert einen Slot.
 */
export async function setSlotActive(
  slotId: string,
  locationId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_time_slots')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', slotId)
    .eq('location_id', locationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verfügbarkeit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt verfügbare Buchungsfenster für einen Tag zurück.
 * Nutzt v_slot_availability View.
 * Filtert: nur aktive, verbleibende Kapazität > 0, Fenster liegt in der Zukunft.
 */
export async function getAvailableSlots(
  locationId: string,
  date: Date,
): Promise<AvailableSlot[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_slot_availability')
    .select('*')
    .eq('location_id', locationId)
    .eq('booking_date', date.toISOString().slice(0, 10))
    .gt('remaining_capacity', 0)
    .gte('window_start_utc', new Date().toISOString()) // nur zukünftige
    .order('window_start_utc');

  if (error) return []; // Migration 033 fehlt

  return ((data ?? []) as SlotAvailability[]).map((row) => ({
    slot_id: row.slot_id,
    window_start_utc: row.window_start_utc,
    window_end_utc: row.window_end_utc,
    booking_date: row.booking_date,
    slot_type: row.slot_type,
    label: row.label,
    extra_fee_eur: Number(row.extra_fee_eur),
    remaining_capacity: row.remaining_capacity,
    utilization_pct: row.utilization_pct,
    is_filling_fast: row.utilization_pct >= 70,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Buchungen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bucht ein Lieferfenster für eine Bestellung.
 *
 * Ablauf:
 *  1. Prüft Slot-Kapazität (race-condition-safe via count < capacity)
 *  2. Erstellt Buchung
 *  3. Setzt customer_orders.scheduled_at + schedule_status='scheduled'
 *  4. Loggt Event
 */
export async function bookDeliveryWindow(
  orderId: string,
  slotId: string,
  locationId: string,
  notes?: string,
): Promise<{ ok: boolean; booking?: WindowBooking; error?: string }> {
  const sb = createServiceClient();

  // Slot laden
  const { data: slot, error: slotErr } = await sb
    .from('delivery_time_slots')
    .select('*')
    .eq('id', slotId)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle();

  if (slotErr || !slot) return { ok: false, error: 'Slot nicht gefunden' };

  // Bestellung prüfen
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, status, mise_batch_id, location_id, schedule_status')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return { ok: false, error: 'Bestellung nicht gefunden' };

  const blockingStatuses = ['storniert', 'cancelled', 'geliefert', 'abgeholt'];
  if (blockingStatuses.includes(order.status as string)) {
    return { ok: false, error: `Bestellung ist bereits ${order.status as string}` };
  }
  if (order.mise_batch_id) {
    return { ok: false, error: 'Bestellung ist bereits einem Fahrer zugewiesen' };
  }

  // Bestehende Buchung prüfen (UNIQUE order_id)
  const { data: existing } = await sb
    .from('delivery_window_bookings')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return { ok: false, error: 'Bestellung hat bereits ein gebuchtes Lieferfenster' };

  // Konkrete UTC-Datetime aus Slot berechnen
  // Nächster passender Wochentag
  const now = new Date();
  const targetDow = (slot as TimeSlot).day_of_week;
  const nowDow = (now.getUTCDay() + 6) % 7; // 0=Mo
  let daysAhead = (targetDow - nowDow + 7) % 7;
  if (daysAhead === 0) {
    // Heute → prüfen ob Slot noch in der Zukunft liegt
    const [sh, sm] = (slot as TimeSlot).slot_start_utc.split(':').map(Number);
    const slotTodayMs = Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), sh, sm,
    );
    if (slotTodayMs <= now.getTime()) daysAhead = 7; // nächste Woche
  }

  const bookingDate = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead,
  ));
  const dateStr = bookingDate.toISOString().slice(0, 10);

  const [startH, startM] = (slot as TimeSlot).slot_start_utc.split(':').map(Number);
  const [endH, endM]     = (slot as TimeSlot).slot_end_utc.split(':').map(Number);

  const windowStart = new Date(`${dateStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00Z`);
  const windowEnd   = new Date(`${dateStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00Z`);

  // Mindestvorlauf: 30 Minuten
  if (windowStart.getTime() - now.getTime() < 30 * 60_000) {
    return { ok: false, error: 'Lieferfenster muss mindestens 30 Minuten in der Zukunft liegen' };
  }

  // Kapazität prüfen (race-condition-safe)
  const { count: bookedCount } = await sb
    .from('delivery_window_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', slotId)
    .gte('window_start_utc', dateStr)
    .lt('window_start_utc', `${dateStr}T23:59:59Z`)
    .not('status', 'in', '(delivered,missed,cancelled)');

  if ((bookedCount ?? 0) >= (slot as TimeSlot).capacity) {
    return { ok: false, error: 'Lieferfenster ist ausgebucht' };
  }

  // Buchung anlegen
  const { data: booking, error: bookErr } = await sb
    .from('delivery_window_bookings')
    .insert({
      order_id: orderId,
      slot_id: slotId,
      location_id: locationId,
      window_start_utc: windowStart.toISOString(),
      window_end_utc: windowEnd.toISOString(),
      status: 'pending',
      extra_fee_eur: (slot as TimeSlot).extra_fee_eur,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (bookErr || !booking) {
    return { ok: false, error: bookErr?.message ?? 'Buchung fehlgeschlagen' };
  }

  // Bestellung auf scheduled setzen (wie Phase 24)
  await sb.from('customer_orders').update({
    scheduled_at: windowStart.toISOString(),
    schedule_status: 'scheduled',
  }).eq('id', orderId);

  logDeliveryEvent({
    event_type: 'order_scheduled',
    location_id: locationId,
    order_id: orderId,
    payload: {
      window_booking_id: booking.id,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      extra_fee_eur: (slot as TimeSlot).extra_fee_eur,
    },
  }).catch(() => {});

  return { ok: true, booking: booking as WindowBooking };
}

/**
 * Storniert eine Fensterbuchung.
 * Setzt schedule_status zurück → sofortiger Dispatch möglich.
 */
export async function cancelWindowBooking(
  bookingId: string,
  locationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  const { data: booking } = await sb
    .from('delivery_window_bookings')
    .select('id, order_id, status')
    .eq('id', bookingId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!booking) return { ok: false, error: 'Buchung nicht gefunden' };
  if (['delivered', 'cancelled'].includes(booking.status as string)) {
    return { ok: false, error: `Buchung kann nicht storniert werden (Status: ${booking.status as string})` };
  }

  const { error } = await sb
    .from('delivery_window_bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) return { ok: false, error: error.message };

  // Bestellung wieder für sofortigen Dispatch freigeben
  await sb.from('customer_orders').update({
    scheduled_at: null,
    schedule_status: null,
  }).eq('id', booking.order_id as string);

  return { ok: true };
}

/**
 * Lädt die Buchung für eine Bestellung (falls vorhanden).
 */
export async function getOrderWindow(
  orderId: string,
): Promise<WindowBooking | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_window_bookings')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  return data as WindowBooking | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cron: Fällige Window-Orders freigeben
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cron-Helfer (alle 2 Min): Gibt Window-Buchungen frei,
 * deren Fenster in ≤15 Minuten startet (inkl. Küchenvorlauf).
 *
 * Ablauf:
 *  1. Liest v_window_dispatch_queue
 *  2. Für jede fällige Buchung: schedule_status='released' setzen
 *  3. Buchungsstatus auf 'confirmed' setzen
 */
export async function processWindowDispatch(
  locationId?: string,
): Promise<DispatchWindowResult> {
  const sb = createServiceClient();

  let query = sb
    .from('v_window_dispatch_queue')
    .select('booking_id, order_id, location_id, window_start_utc, window_end_utc, estimated_prep_min')
    .limit(50);

  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;
  if (error) {
    // View fehlt → Migration 033 noch nicht ausgeführt
    return { released: 0, bookings_confirmed: 0, order_ids: [] };
  }

  const rows = (data ?? []) as Array<{
    booking_id: string;
    order_id: string;
    location_id: string;
    window_start_utc: string;
    estimated_prep_min: number | null;
  }>;

  if (rows.length === 0) return { released: 0, bookings_confirmed: 0, order_ids: [] };

  const now = new Date();
  const toRelease: Array<{ bookingId: string; orderId: string; locationId: string }> = [];

  for (const row of rows) {
    const windowStart = new Date(row.window_start_utc);
    const prepMin = row.estimated_prep_min ?? 15;
    const kitchenStart = new Date(windowStart.getTime() - prepMin * 60_000);
    // Küche muss jetzt starten damit Bestellung pünktlich bereit ist
    if (kitchenStart <= now) {
      toRelease.push({
        bookingId: row.booking_id,
        orderId: row.order_id,
        locationId: row.location_id,
      });
    }
  }

  if (toRelease.length === 0) return { released: 0, bookings_confirmed: 0, order_ids: [] };

  const orderIds = toRelease.map((r) => r.orderId);
  const bookingIds = toRelease.map((r) => r.bookingId);

  // schedule_status auf 'released' setzen → Dispatch greift an
  await sb.from('customer_orders')
    .update({ schedule_status: 'released' })
    .in('id', orderIds);

  // Buchungsstatus auf 'confirmed' setzen
  await sb.from('delivery_window_bookings')
    .update({ status: 'confirmed', confirmed_at: now.toISOString(), updated_at: now.toISOString() })
    .in('id', bookingIds);

  // Events (fire-and-forget)
  for (const row of toRelease) {
    logDeliveryEvent({
      event_type: 'order_released_for_dispatch',
      location_id: row.locationId,
      order_id: row.orderId,
      payload: { window_booking_id: row.bookingId, source: 'window_dispatch' },
    }).catch(() => {});
  }

  return {
    released: toRelease.length,
    bookings_confirmed: toRelease.length,
    order_ids: orderIds,
  };
}

/**
 * Alle Locations: processWindowDispatch parallel.
 * Cron-Wrapper mit per-Location try/catch.
 */
export async function processWindowDispatchAllLocations(): Promise<{
  locations: number;
  released: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true)
    .limit(50);

  if (!locs || locs.length === 0) return { locations: 0, released: 0 };

  let totalReleased = 0;
  await Promise.all(
    locs.map(async (loc) => {
      try {
        const res = await processWindowDispatch(loc.id as string);
        totalReleased += res.released;
      } catch { /* per-location isolation */ }
    }),
  );

  return { locations: locs.length, released: totalReleased };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status-Updates nach Tour-Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setzt Buchungsstatus auf 'dispatched' wenn Fahrer zugewiesen wurde.
 * Fire-and-forget aus dispatch-engine.ts.
 */
export async function markWindowDispatched(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from('delivery_window_bookings')
    .update({
      status: 'dispatched',
      dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['pending', 'confirmed']);
}

/**
 * Setzt Buchungsstatus auf 'delivered' nach Lieferung.
 * Fire-and-forget aus tours/[id]/status/route.ts.
 */
export async function markWindowDelivered(orderId: string): Promise<void> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  await sb.from('delivery_window_bookings')
    .update({ status: 'delivered', delivered_at: now, updated_at: now })
    .eq('order_id', orderId)
    .not('status', 'in', '(delivered,cancelled,missed)');
}

/**
 * Cron: Markiert abgelaufene Buchungen als 'missed'.
 * Fenster ist vorbei (window_end + 30 Min) und noch nicht delivered/cancelled.
 */
export async function markMissedWindows(): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();

  const { count, error } = await sb
    .from('delivery_window_bookings')
    .update({ status: 'missed', updated_at: new Date().toISOString() })
    .lt('window_end_utc', cutoff)
    .not('status', 'in', '(delivered,cancelled,missed)')
    .select('id', { count: 'exact', head: true });

  if (error) return 0;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats + Admin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tages-Statistiken für Admin-Dashboard.
 */
export async function getWindowStats(locationId: string): Promise<WindowStats> {
  const sb = createServiceClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400_000);

  const { data, error } = await sb
    .from('delivery_window_bookings')
    .select('status, extra_fee_eur, slot_id')
    .eq('location_id', locationId)
    .gte('window_start_utc', todayStart.toISOString())
    .lt('window_start_utc', todayEnd.toISOString());

  if (error) return {
    total_bookings_today: 0, confirmed: 0, dispatched: 0, delivered: 0,
    missed: 0, cancelled: 0, revenue_today_eur: 0, avg_utilization_pct: 0,
    most_popular_slot: null, _fallback: true,
  };

  const bookings = (data ?? []) as Array<{ status: string; extra_fee_eur: string; slot_id: string }>;
  const counts = {
    confirmed: 0, dispatched: 0, delivered: 0, missed: 0, cancelled: 0,
  };
  let revenue = 0;
  const slotCounts: Record<string, number> = {};

  for (const b of bookings) {
    if (b.status in counts) counts[b.status as keyof typeof counts]++;
    revenue += parseFloat(b.extra_fee_eur ?? '0');
    slotCounts[b.slot_id] = (slotCounts[b.slot_id] ?? 0) + 1;
  }

  const mostPopular = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Avg utilization aus v_slot_availability für heute
  const { data: avail } = await sb
    .from('v_slot_availability')
    .select('utilization_pct')
    .eq('location_id', locationId)
    .eq('booking_date', todayStart.toISOString().slice(0, 10));

  const utilPcts = ((avail ?? []) as Array<{ utilization_pct: number }>).map((r) => r.utilization_pct);
  const avgUtil = utilPcts.length > 0
    ? Math.round(utilPcts.reduce((a, b) => a + b, 0) / utilPcts.length)
    : 0;

  return {
    total_bookings_today: bookings.length,
    confirmed: counts.confirmed,
    dispatched: counts.dispatched,
    delivered: counts.delivered,
    missed: counts.missed,
    cancelled: counts.cancelled,
    revenue_today_eur: Math.round(revenue * 100) / 100,
    avg_utilization_pct: avgUtil,
    most_popular_slot: mostPopular,
  };
}

/**
 * Buchungsliste für Admin (heutiger Tag + optional Filter).
 */
export async function listWindowBookings(
  locationId: string,
  date?: string, // 'YYYY-MM-DD', default: heute
): Promise<Array<WindowBooking & { slot_label: string | null; slot_start: string; slot_end: string; bestellnummer: string | null }>> {
  const sb = createServiceClient();
  const d = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('delivery_window_bookings')
    .select(`
      *,
      delivery_time_slots ( label, slot_start_utc, slot_end_utc ),
      customer_orders ( bestellnummer )
    `)
    .eq('location_id', locationId)
    .gte('window_start_utc', `${d}T00:00:00Z`)
    .lt('window_start_utc', `${d}T23:59:59Z`)
    .order('window_start_utc');

  if (error) return [];

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const slot = row['delivery_time_slots'] as { label: string | null; slot_start_utc: string; slot_end_utc: string } | null;
    const order = row['customer_orders'] as { bestellnummer: string | null } | null;
    return {
      ...(row as unknown as WindowBooking),
      slot_label: slot?.label ?? null,
      slot_start: slot?.slot_start_utc ?? '',
      slot_end: slot?.slot_end_utc ?? '',
      bestellnummer: order?.bestellnummer ?? null,
    };
  });
}
