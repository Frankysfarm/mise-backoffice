/**
 * lib/delivery/events.ts
 *
 * Lifecycle-Event-Logging für den Smart-Delivery-Stack.
 * Schreibt Ereignisse in delivery_events (Migration 006).
 * Fire-and-forget — kein throw bei DB-Fehler (nie kritisch).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type DeliveryEventType =
  | 'order_received'
  | 'order_dispatched'
  | 'order_bundled'
  | 'order_held'
  | 'order_geocoded'
  | 'batch_created'
  | 'batch_assigned'
  | 'batch_optimized'
  | 'batch_picked_up'
  | 'batch_completed'
  | 'batch_cancelled'
  | 'stop_delivered'
  | 'driver_online'
  | 'driver_offline'
  | 'eta_updated'
  | 'zone_classified'
  | 'kitchen_ready'
  | 'kitchen_cooking';

export interface DeliveryEvent {
  event_type: DeliveryEventType;
  location_id: string;
  order_id?: string | null;
  batch_id?: string | null;
  driver_id?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Loggt ein Delivery-Event asynchron.
 * Fire-and-forget: await is optional; Fehler werden nur geloggt, nicht geworfen.
 */
export async function logDeliveryEvent(event: DeliveryEvent): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from('delivery_events').insert({
      event_type:  event.event_type,
      location_id: event.location_id,
      order_id:    event.order_id  ?? null,
      batch_id:    event.batch_id  ?? null,
      driver_id:   event.driver_id ?? null,
      payload:     event.payload   ?? {},
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[delivery/events] log failed:', err);
  }
}

/**
 * Gibt die letzten N Events für eine Location zurück (Admin-Timeline).
 */
export async function getRecentEvents(
  locationId: string,
  limit = 50,
): Promise<Array<{
  id: string;
  event_type: DeliveryEventType;
  order_id: string | null;
  batch_id: string | null;
  driver_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_events')
    .select('id, event_type, order_id, batch_id, driver_id, payload, occurred_at')
    .eq('location_id', locationId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id:          r.id as string,
    event_type:  r.event_type as DeliveryEventType,
    order_id:    r.order_id as string | null,
    batch_id:    r.batch_id as string | null,
    driver_id:   r.driver_id as string | null,
    payload:     (r.payload ?? {}) as Record<string, unknown>,
    occurred_at: r.occurred_at as string,
  }));
}
