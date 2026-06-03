/**
 * lib/delivery/scheduled.ts
 *
 * Scheduled Orders / Vorbestell-Management.
 *
 * Ablauf:
 *  1. Kunde legt Bestellung mit scheduled_at auf, status='scheduled'
 *  2. Cron ruft releaseScheduledOrders() alle 2 Minuten auf
 *  3. Orders bei denen scheduled_at - prep_time <= NOW() werden 'released'
 *  4. Dispatch-Engine greift auf 'released' Orders zu (ignoriert 'scheduled')
 *  5. Küche bekommt Timing-Benachrichtigung zum richtigen Zeitpunkt
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from './events';

export interface ScheduledOrder {
  id: string;
  location_id: string;
  bestellnummer: string;
  kunde_name: string | null;
  kunde_adresse: string | null;
  scheduled_at: string;
  schedule_status: 'scheduled' | 'released' | 'immediate';
  order_status: string;
  order_type: string;
  gesamtbetrag: number | null;
  estimated_prep_min: number | null;
  kitchen_start_at: string | null;
  mins_until_kitchen_start: number | null;
  ready_for_dispatch: boolean;
  created_at: string;
}

export interface ReleaseResult {
  released: number;
  orders: string[];
}

/**
 * Gibt fällige Vorbestellungen für den Dispatch frei.
 * Läuft im Cron (alle 2 Min).
 * Freigabe: scheduled_at - estimated_prep_min <= jetzt
 */
export async function releaseScheduledOrders(): Promise<ReleaseResult> {
  const sb = createServiceClient();

  // Lade fällige Bestellungen (scheduled_at - prep_time <= NOW())
  const cutoff = new Date();
  const { data: dueOrders } = await sb
    .from('customer_orders')
    .select('id, location_id, bestellnummer, scheduled_at, estimated_prep_min')
    .eq('schedule_status', 'scheduled')
    .lt('scheduled_at', new Date(
      cutoff.getTime() + (30 * 60 * 1000), // Blick 30 Minuten voraus
    ).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100);

  if (!dueOrders || dueOrders.length === 0) {
    return { released: 0, orders: [] };
  }

  const toRelease: string[] = [];
  for (const o of dueOrders) {
    const scheduledAt = new Date(o.scheduled_at as string);
    const prepMin = (o.estimated_prep_min as number | null) ?? 20;
    const kitchenStart = new Date(scheduledAt.getTime() - prepMin * 60_000);
    if (kitchenStart <= cutoff) {
      toRelease.push(o.id as string);
    }
  }

  if (toRelease.length === 0) {
    return { released: 0, orders: [] };
  }

  const { error } = await sb
    .from('customer_orders')
    .update({ schedule_status: 'released' })
    .in('id', toRelease);

  if (error) {
    // Graceful: Migration 024 noch nicht ausgeführt
    if (error.message?.includes('schedule_status')) return { released: 0, orders: [] };
    throw error;
  }

  // Events loggen (fire-and-forget)
  for (const id of toRelease) {
    const order = dueOrders.find((o) => o.id === id);
    logDeliveryEvent({
      event_type: 'order_released_for_dispatch',
      location_id: order?.location_id as string,
      order_id: id,
      payload: { scheduled_at: order?.scheduled_at },
    }).catch(() => {});
  }

  return { released: toRelease.length, orders: toRelease };
}

/**
 * Vorbestellungen für eine Location (nächste 24h).
 * Nutzt v_scheduled_orders View (Migration 024).
 */
export async function getScheduledQueue(locationId: string): Promise<ScheduledOrder[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_scheduled_orders')
    .select('*')
    .eq('location_id', locationId)
    .order('scheduled_at', { ascending: true });

  if (error) {
    // View noch nicht erstellt → leere Liste zurückgeben
    return [];
  }
  return (data ?? []) as ScheduledOrder[];
}

/**
 * Setzt oder ändert scheduled_at auf einer Bestellung.
 * Setzt schedule_status='scheduled'.
 * Gibt Fehler zurück wenn Bestellung bereits dispatched/delivered.
 */
export async function scheduleOrder(
  orderId: string,
  scheduledAt: Date,
  locationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  // Bestellung laden und prüfen
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, status, mise_batch_id, location_id')
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

  // Zeitpunkt muss in der Zukunft liegen (min. 10 Minuten)
  const minTime = new Date(Date.now() + 10 * 60_000);
  if (scheduledAt < minTime) {
    return { ok: false, error: 'Vorbestellzeit muss mindestens 10 Minuten in der Zukunft liegen' };
  }

  const { error } = await sb
    .from('customer_orders')
    .update({
      scheduled_at:    scheduledAt.toISOString(),
      schedule_status: 'scheduled',
    })
    .eq('id', orderId);

  if (error) return { ok: false, error: error.message };

  logDeliveryEvent({
    event_type: 'order_scheduled',
    location_id: locationId,
    order_id: orderId,
    payload: { scheduled_at: scheduledAt.toISOString() },
  }).catch(() => {});

  return { ok: true };
}

/**
 * Hebt Vorab-Planung auf (setzt schedule_status zurück auf null → sofortiger Dispatch).
 */
export async function unscheduleOrder(
  orderId: string,
  locationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  const { data: order } = await sb
    .from('customer_orders')
    .select('id, schedule_status, mise_batch_id')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return { ok: false, error: 'Bestellung nicht gefunden' };
  if (order.mise_batch_id) return { ok: false, error: 'Bestellung bereits zugewiesen' };

  const { error } = await sb
    .from('customer_orders')
    .update({ scheduled_at: null, schedule_status: null })
    .eq('id', orderId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Gibt eine geplante Bestellung manuell frei (Admin-Funktion).
 */
export async function manuallyReleaseOrder(
  orderId: string,
  locationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  const { data: order } = await sb
    .from('customer_orders')
    .select('id, schedule_status, mise_batch_id')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return { ok: false, error: 'Bestellung nicht gefunden' };
  if (order.mise_batch_id) return { ok: false, error: 'Bestellung bereits dispatched' };

  const { error } = await sb
    .from('customer_orders')
    .update({ schedule_status: 'released' })
    .eq('id', orderId);

  if (error) return { ok: false, error: error.message };

  logDeliveryEvent({
    event_type: 'order_released_for_dispatch',
    location_id: locationId,
    order_id: orderId,
    payload: { manual: true },
  }).catch(() => {});

  return { ok: true };
}

/**
 * Übersicht: wie viele geplante Orders in den nächsten N Stunden.
 * Für Admin-Dashboard + Health-Check.
 */
export async function getScheduledSummary(
  locationId: string,
  hours = 4,
): Promise<{
  total: number;
  pending: number;
  released: number;
  next_due_in_min: number | null;
}> {
  const sb = createServiceClient();

  const until = new Date(Date.now() + hours * 3600_000).toISOString();
  const { data } = await sb
    .from('customer_orders')
    .select('id, schedule_status, scheduled_at, estimated_prep_min')
    .eq('location_id', locationId)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', until)
    .not('status', 'in', '(storniert,cancelled,geliefert,abgeholt)')
    .order('scheduled_at', { ascending: true });

  const orders = data ?? [];
  const pending  = orders.filter((o) => o.schedule_status === 'scheduled').length;
  const released = orders.filter((o) => o.schedule_status === 'released').length;

  // Nächste fällige Freigabe
  let nextDueMin: number | null = null;
  for (const o of orders) {
    if (o.schedule_status !== 'scheduled') continue;
    const scheduledAt = new Date(o.scheduled_at as string);
    const prepMin = (o.estimated_prep_min as number | null) ?? 20;
    const kitchenStart = new Date(scheduledAt.getTime() - prepMin * 60_000);
    const minsLeft = (kitchenStart.getTime() - Date.now()) / 60_000;
    if (nextDueMin === null || minsLeft < nextDueMin) nextDueMin = Math.round(minsLeft);
  }

  return {
    total:           orders.length,
    pending,
    released,
    next_due_in_min: nextDueMin,
  };
}
