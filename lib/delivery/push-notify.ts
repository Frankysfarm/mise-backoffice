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
 * Schreibt je nach registrierten Kanälen in die Native- und/oder Web-Push-Outbox.
 * Browser-Fahrer dürfen nicht in die Native-Outbox gelangen: ein fehlendes
 * Expo-/VoIP-Token würde dort absichtlich die Zuweisung zurückrollen.
 * Fire-and-forget — Fehler werden geloggt aber nicht geworfen.
 */
export async function enqueueBatchPush(params: BatchPushParams): Promise<void> {
  const { driverId, batchId, orderCount, restaurantName, distanceKm, outcome } = params;

  const title =
    outcome === 'bundled'
      ? `Tour aktualisiert · ${orderCount} weitere Bestellung${orderCount > 1 ? 'en' : ''}`
      : 'Nächste Tour eingeplant';

  const body =
    outcome === 'bundled'
      ? `Abholung bei ${restaurantName} · sicher bei Stillstand ansehen`
      : `${restaurantName} · ${distanceKm.toFixed(1)} km · im Restaurant per QR übernehmen`;

  const c = sb();
  const { data: driver } = await c.from('mise_drivers')
    .select('auth_user_id,push_enabled,expo_push_token,voip_push_token')
    .eq('id', driverId).maybeSingle();
  const { data: employee } = driver?.auth_user_id
    ? await c.from('employees').select('id').eq('auth_user_id', driver.auth_user_id).maybeSingle()
    : { data: null };
  const { count: webSubscriptionCount } = employee?.id
    ? await c.from('driver_push_subscriptions').select('id', { head: true, count: 'exact' }).eq('employee_id', employee.id)
    : { count: 0 };
  const hasNativePush = Boolean(
    driver?.push_enabled && (driver.expo_push_token || driver.voip_push_token),
  );
  const hasWebPush = Boolean(employee?.id && (webSubscriptionCount ?? 0) > 0);

  const errors: string[] = [];
  if (hasNativePush) {
    const { error } = await c.from('mise_push_outbox').insert({
      driver_id: driverId,
      type:      'tour_planned',
      title,
      body,
      sound:    'default',
      priority: 'normal',
      data: {
        batch_id:        batchId,
        order_count:     orderCount,
        restaurant_name: restaurantName,
        distance_km:     distanceKm,
        decision_id:     batchId,
        assignment_mode: 'own_fleet',
      },
    });
    if (error) errors.push(`native: ${error.message}`);
  }

  // One authoritative outbox per assignment. A dual-channel enqueue could let
  // one failed transport requeue a batch after the other already delivered it.
  if (hasWebPush && !hasNativePush && employee?.id) {
    const { error } = await c.from('driver_push_outbox').insert({
      employee_id: employee.id,
      batch_id: batchId,
      title,
      body,
      url: '/fahrer/app',
    });
    if (error) errors.push(`web: ${error.message}`);
  }

  if (!hasNativePush && !hasWebPush) errors.push('kein zustellbarer Push-Kanal');
  if (errors.length > 0) {
    console.error('[push-notify] enqueueBatchPush fehlgeschlagen:', errors.join('; '), { driverId, batchId });
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
