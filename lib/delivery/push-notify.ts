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
