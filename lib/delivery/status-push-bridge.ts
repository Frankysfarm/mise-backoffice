/**
 * lib/delivery/status-push-bridge.ts
 *
 * Phase 303 — Status-Push-Bridge
 *
 * Verbindet Fahrer-Statuswechsel mit Kunden-Push-Benachrichtigungen.
 * Wird von den Driver-App-Routes aufgerufen (picked-up, delivered, accept).
 *
 * Statuswechsel → Event-Mapping:
 *   fertig     → driver_departing  (Fahrer hat abgeholt, ist unterwegs)
 *   geliefert  → delivered         (Lieferung erfolgreich)
 *   accepted   → driver_assigned   (Fahrer hat Tour angenommen)
 *
 * Ablauf:
 *   1. Lade Bestellung + Kunden-E-Mail aus DB
 *   2. Prüfe ob Push für diesen Status bereits gesendet (Deduplizierung)
 *   3. Sende Web-Push via notifyCustomerViaPush
 *   4. Schreibe Event-Eintrag via recordCustomerEvent
 *   5. Logge Push in status_push_log (Deduplizierungs-Guard)
 *
 * Graceful: alle Fehler werden geloggt aber nicht nach oben propagiert.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyCustomerViaPush } from './customer-web-push';
import { recordCustomerEvent, type CustomerEventType } from './customer-notify';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'unterwegs' | 'geliefert' | 'zugewiesen';

interface StatusPushResult {
  fired: boolean;
  event: CustomerEventType | null;
  reason: string;
}

interface OrderData {
  id: string;
  location_id: string;
  bestellnummer: string | null;
  kunde_email: string | null;
  status: string;
}

// ── Status → CustomerEventType Mapping ───────────────────────────────────────

const STATUS_TO_EVENT: Record<string, CustomerEventType> = {
  unterwegs:  'driver_departing',
  geliefert:  'delivered',
  zugewiesen: 'driver_assigned',
} as const;

// ── Kern-Bridge ───────────────────────────────────────────────────────────────

/**
 * Feuert eine Push-Benachrichtigung wenn eine Order einen relevanten Status erreicht.
 * Idempotent: mehrfacher Aufruf für gleichen Status+Order sendet nur einmal.
 *
 * @param orderId   - ID der Bestellung
 * @param newStatus - Neuer Status nach dem Update (unterwegs / geliefert / zugewiesen)
 * @param locationId - Location-ID für Multi-Tenant-Kontext
 */
export async function fireStatusPush(
  orderId: string,
  newStatus: string,
  locationId: string,
): Promise<StatusPushResult> {
  const event = STATUS_TO_EVENT[newStatus];
  if (!event) {
    return { fired: false, event: null, reason: `status '${newStatus}' nicht gemappt` };
  }

  try {
    const svc = createServiceClient();

    // Deduplizierungs-Check — wurde für diese Order+Event schon gesendet?
    const alreadySent = await checkAlreadySent(svc, orderId, event);
    if (alreadySent) {
      return { fired: false, event, reason: 'bereits gesendet (Deduplizierung)' };
    }

    // Kunden-E-Mail laden
    const order = await loadOrder(svc, orderId, locationId);
    if (!order) {
      return { fired: false, event, reason: 'Bestellung nicht gefunden' };
    }

    // Tracking-URL aufbauen
    const trackingUrl = order.bestellnummer
      ? `/track/${order.bestellnummer}`
      : undefined;

    // Push + Event parallel senden
    await Promise.all([
      notifyCustomerViaPush(
        order.location_id,
        orderId,
        event,
        order.kunde_email ?? undefined,
        trackingUrl,
      ),
      recordCustomerEvent(orderId, order.location_id, event, {
        triggered_by: 'status_push_bridge',
        new_status: newStatus,
      }),
    ]);

    // Deduplizierungs-Log schreiben
    await markSent(svc, orderId, event, locationId);

    return { fired: true, event, reason: 'gesendet' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[status-push-bridge] fireStatusPush:', msg, { orderId, newStatus });
    return { fired: false, event, reason: `Fehler: ${msg}` };
  }
}

/**
 * Feuert "driver_nearby" Push wenn Fahrer < 500m entfernt ist.
 * Wird aus dem GPS-Tracker aufgerufen (keine DB-Status-Änderung).
 */
export async function fireNearbyPush(
  orderId: string,
  locationId: string,
  distanceM: number,
): Promise<StatusPushResult> {
  const event: CustomerEventType = 'driver_nearby';

  if (distanceM > 500) {
    return { fired: false, event, reason: `Fahrer ${distanceM}m entfernt — noch nicht nah genug` };
  }

  try {
    const svc = createServiceClient();

    const alreadySent = await checkAlreadySent(svc, orderId, event);
    if (alreadySent) {
      return { fired: false, event, reason: 'bereits gesendet (Deduplizierung)' };
    }

    const order = await loadOrder(svc, orderId, locationId);
    if (!order) {
      return { fired: false, event, reason: 'Bestellung nicht gefunden' };
    }

    await Promise.all([
      notifyCustomerViaPush(
        order.location_id,
        orderId,
        event,
        order.kunde_email ?? undefined,
      ),
      recordCustomerEvent(orderId, order.location_id, event, {
        triggered_by: 'gps_proximity',
        distance_m: distanceM,
      }),
    ]);

    await markSent(svc, orderId, event, locationId);

    return { fired: true, event, reason: `Fahrer ${distanceM}m entfernt` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[status-push-bridge] fireNearbyPush:', msg, { orderId });
    return { fired: false, event, reason: `Fehler: ${msg}` };
  }
}

/**
 * Feuert "driver_almost_there" Push wenn Fahrer ~2 Min entfernt ist.
 */
export async function fireAlmostTherePush(
  orderId: string,
  locationId: string,
  etaMinutes: number,
): Promise<StatusPushResult> {
  const event: CustomerEventType = 'driver_almost_there';

  if (etaMinutes > 2.5) {
    return { fired: false, event, reason: `ETA ${etaMinutes} Min — noch nicht nah genug` };
  }

  try {
    const svc = createServiceClient();

    const alreadySent = await checkAlreadySent(svc, orderId, event);
    if (alreadySent) {
      return { fired: false, event, reason: 'bereits gesendet (Deduplizierung)' };
    }

    const order = await loadOrder(svc, orderId, locationId);
    if (!order) return { fired: false, event, reason: 'Bestellung nicht gefunden' };

    await Promise.all([
      notifyCustomerViaPush(
        order.location_id,
        orderId,
        event,
        order.kunde_email ?? undefined,
      ),
      recordCustomerEvent(orderId, order.location_id, event, {
        triggered_by: 'eta_trigger',
        eta_minutes: etaMinutes,
      }),
    ]);

    await markSent(svc, orderId, event, locationId);

    return { fired: true, event, reason: `ETA ${etaMinutes} Min` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[status-push-bridge] fireAlmostTherePush:', msg, { orderId });
    return { fired: false, event, reason: `Fehler: ${msg}` };
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function loadOrder(
  svc: ReturnType<typeof createServiceClient>,
  orderId: string,
  locationId: string,
): Promise<OrderData | null> {
  const { data } = await svc
    .from('customer_orders')
    .select('id, location_id, bestellnummer, kunde_email, status')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();
  return (data as OrderData | null);
}

async function checkAlreadySent(
  svc: ReturnType<typeof createServiceClient>,
  orderId: string,
  event: CustomerEventType,
): Promise<boolean> {
  const { data, error } = await svc
    .from('status_push_log')
    .select('id')
    .eq('order_id', orderId)
    .eq('event_type', event)
    .limit(1)
    .maybeSingle();

  // Wenn Tabelle nicht existiert → nicht sperren (graceful degradation)
  if (error?.code === '42P01') return false;
  return !!data;
}

async function markSent(
  svc: ReturnType<typeof createServiceClient>,
  orderId: string,
  event: CustomerEventType,
  locationId: string,
): Promise<void> {
  const { error } = await svc
    .from('status_push_log')
    .insert({
      order_id:    orderId,
      location_id: locationId,
      event_type:  event,
      fired_at:    new Date().toISOString(),
    });

  // Unique-Constraint-Violation ist ok — Race-Condition-Deduplizierung
  if (error && error.code !== '23505' && error.code !== '42P01') {
    console.warn('[status-push-bridge] markSent:', error.message);
  }
}
