/**
 * lib/delivery/push-notify.ts
 *
 * Benachrichtigt Fahrer via mise_push_outbox wenn eine neue Tour
 * per Smart-Dispatch zugewiesen oder gebündelt wurde.
 *
 * Schreibt in mise_push_outbox → push-flush-Cron sendet VoIP/Expo-Push.
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

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

export interface BatchPushParams {
  driverId: string;
  batchId: string;
  orderCount: number;
  restaurantName: string;
  distanceKm: number;
  outcome: 'dispatched' | 'bundled';
}

/**
 * Schreibt eine Push-Nachricht in mise_push_outbox.
 * Der push-flush-Cron sendet sie via VoIP (iOS) oder Expo.
 * Fire-and-forget — Fehler werden geloggt aber nicht geworfen.
 */
export async function enqueueBatchPush(params: BatchPushParams): Promise<void> {
  const { driverId, batchId, orderCount, restaurantName, distanceKm, outcome } = params;

  const title =
    outcome === 'bundled'
      ? `+${orderCount} Bestellung${orderCount > 1 ? 'en' : ''} gebündelt`
      : `Neue Tour: ${restaurantName}`;

  const body =
    outcome === 'bundled'
      ? `Hinzugefügt zu deiner laufenden Tour · ${distanceKm.toFixed(1)} km`
      : `${orderCount} Bestellung${orderCount > 1 ? 'en' : ''} · ${distanceKm.toFixed(1)} km Fahrt`;

  const { error } = await sb()
    .from('mise_push_outbox')
    .insert({
      driver_id: driverId,
      type:      'order_assigned',
      title,
      body,
      sound:    'default',
      priority: 'high',
      data: {
        batch_id:        batchId,
        order_count:     orderCount,
        restaurant_name: restaurantName,
        distance_km:     distanceKm,
        decision_id:     batchId,
      },
    });

  if (error) {
    console.error('[push-notify] enqueueBatchPush fehlgeschlagen:', error.message, { driverId, batchId });
  }
}

export interface TourStatusPushParams {
  driverId: string;
  batchId: string;
  title: string;
  body: string;
  type: 'tour_cancelled' | 'tour_updated' | 'order_cancelled';
  data?: Record<string, unknown>;
}

/**
 * Allgemeiner Status-Push — z.B. bei Tour-Stornierung oder Bestellungsänderung.
 */
export async function enqueueTourStatusPush(params: TourStatusPushParams): Promise<void> {
  const { driverId, batchId, title, body, type, data } = params;

  const { error } = await sb()
    .from('mise_push_outbox')
    .insert({
      driver_id: driverId,
      type,
      title,
      body,
      sound:    'default',
      priority: 'normal',
      data: { batch_id: batchId, ...(data ?? {}) },
    });

  if (error) {
    console.error('[push-notify] enqueueTourStatusPush fehlgeschlagen:', error.message, { driverId, batchId });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 155: Queue-Signal Push für alle Online-Fahrer einer Location
// ─────────────────────────────────────────────────────────────────────────────

export interface QueueSignalPushParams {
  locationId: string;
  signalType: 'extended' | 'paused';
  etaExtensionMin: number;
  messageDe: string | null;
}

/**
 * Benachrichtigt alle online Fahrer einer Location über eine Queue-Signal-Änderung.
 * Wird aufgerufen wenn Signal auf 'paused' oder 'extended' wechselt.
 * Gibt Anzahl der enqueued Pushes zurück. Fire-and-forget.
 */
export async function enqueueQueueSignalPushForLocation(
  params: QueueSignalPushParams,
): Promise<number> {
  const { locationId, signalType, etaExtensionMin, messageDe } = params;

  const { data: drivers, error: dErr } = await sb()
    .from('mise_drivers')
    .select('id')
    .eq('active', true)
    .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning'])
    .limit(100);

  if (dErr || !drivers || drivers.length === 0) return 0;

  const title =
    signalType === 'paused'
      ? 'Restaurant pausiert ⏸'
      : `Erhöhte Wartezeit +${etaExtensionMin} Min ⏳`;

  const body =
    signalType === 'paused'
      ? 'Keine neuen Aufträge bis auf Weiteres — bitte auf Zuweisung warten.'
      : (messageDe ?? `Küche ausgelastet — ETA um ${etaExtensionMin} Minuten verlängert.`);

  const rows = (drivers as { id: string }[]).map((d) => ({
    driver_id: d.id,
    type:      'system_update',
    title,
    body,
    sound:    signalType === 'paused' ? 'default' : null,
    priority:  signalType === 'paused' ? 'high' : 'normal',
    data: {
      event:             'queue_signal_changed',
      signal_type:       signalType,
      eta_extension_min: etaExtensionMin,
      location_id:       locationId,
    },
  }));

  const { data: inserted, error } = await sb()
    .from('mise_push_outbox')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('[push-notify] enqueueQueueSignalPushForLocation fehlgeschlagen:', error.message, {
      locationId,
      signalType,
      drivers: drivers.length,
    });
    return 0;
  }

  return inserted?.length ?? 0;
}
