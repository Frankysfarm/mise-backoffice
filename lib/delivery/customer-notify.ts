/**
 * lib/delivery/customer-notify.ts
 *
 * Customer Delivery Event Feed — Phase 37
 *
 * Schreibt Event-Einträge in customer_delivery_events.
 * Die Tracking-Page konsumiert diese via Supabase-Realtime.
 *
 * Events werden fire-and-forget aufgerufen — Fehler terminieren keine Requests.
 * Graceful Fallback wenn Migration 031 noch nicht eingespielt (Tabelle fehlt).
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// ── Singleton service client ──────────────────────────────────────────────────

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => fetch(i as RequestInfo, { ...init, cache: 'no-store' }) },
    },
  );
  return _sb;
}

// ── Typen ─────────────────────────────────────────────────────────────────────

export type CustomerEventType =
  | 'driver_assigned'
  | 'driver_at_restaurant'
  | 'driver_departing'
  | 'driver_nearby'
  | 'driver_almost_there'
  | 'delivered'
  | 'cancelled'
  | 'delayed'
  | 'rating_request'
  | 'loyalty_tier_upgrade';

export interface CustomerDeliveryEvent {
  id: string;
  orderId: string;
  locationId: string;
  eventType: CustomerEventType;
  messageDe: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Nachrichten (DE) ──────────────────────────────────────────────────────────

const EVENT_MESSAGES: Record<CustomerEventType, string> = {
  driver_assigned:      'Fahrer wurde deiner Bestellung zugewiesen',
  driver_at_restaurant: 'Fahrer ist beim Restaurant angekommen',
  driver_departing:     'Deine Bestellung ist jetzt unterwegs zu dir',
  driver_nearby:        'Fahrer ist gleich bei dir — bitte bereit halten!',
  driver_almost_there:  'Dein Fahrer ist in ca. 2 Minuten bei dir! 🛵 Bitte bereit halten.',
  delivered:            'Bestellung wurde erfolgreich geliefert',
  cancelled:            'Deine Bestellung wurde storniert',
  delayed:              'Deine Bestellung verzögert sich leicht',
  rating_request:       'Wie war deine Lieferung? Wir freuen uns über dein Feedback.',
  loyalty_tier_upgrade: 'Herzlichen Glückwunsch! Du hast ein neues Treuepunkte-Level erreicht! 🎉',
};

// ── Schreiben ─────────────────────────────────────────────────────────────────

/**
 * Schreibt ein Customer-Delivery-Event und stellt eine Push-Benachrichtigung in die Queue.
 * Fire-and-forget: niemals eine Exception nach oben propagieren.
 */
export async function recordCustomerEvent(
  orderId: string,
  locationId: string,
  eventType: CustomerEventType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const messageDe = EVENT_MESSAGES[eventType];

  const { data: inserted, error } = await sb()
    .from('customer_delivery_events')
    .insert({
      order_id:    orderId,
      location_id: locationId,
      event_type:  eventType,
      message_de:  messageDe,
      metadata:    metadata ?? null,
      created_at:  new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.message.includes('customer_delivery_events') || error.code === '42P01') return;
    console.error('[customer-notify] recordCustomerEvent:', error.message, { orderId, eventType });
    return;
  }

  // Push-Benachrichtigung fire-and-forget (dynamischer Import → kein zirkulärer Import)
  const eventId = (inserted as { id: string } | null)?.id;
  import('./customer-push').then(({ enqueueForOrder }) =>
    enqueueForOrder(orderId, locationId, eventId, eventType, messageDe, metadata),
  ).catch(() => { /* graceful */ });
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

/**
 * Lädt alle Events einer Bestellung in chronologischer Reihenfolge.
 * Graceful Fallback: leeres Array wenn Migration fehlt oder Fehler auftritt.
 */
export async function getOrderEvents(orderId: string): Promise<CustomerDeliveryEvent[]> {
  const { data, error } = await sb()
    .from('customer_delivery_events')
    .select('id, order_id, location_id, event_type, message_de, metadata, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id:         row.id as string,
    orderId:    row.order_id as string,
    locationId: row.location_id as string,
    eventType:  row.event_type as CustomerEventType,
    messageDe:  row.message_de as string,
    metadata:   (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt:  row.created_at as string,
  }));
}
