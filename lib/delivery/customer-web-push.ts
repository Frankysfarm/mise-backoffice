/**
 * lib/delivery/customer-web-push.ts
 *
 * Phase 172 — Customer Browser Web Push (VAPID)
 *
 * Sendet native Browser-Push-Benachrichtigungen an Storefront-Kunden.
 * Nutzt VAPID-Keys (shared mit Fahrer-Push) + web-push-Bibliothek.
 *
 * Graceful: wenn Tabellen fehlen oder VAPID nicht konfiguriert → silent no-op.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { CustomerEventType } from './customer-notify';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface CustomerPushConfig {
  id: string;
  locationId: string;
  enabled: boolean;
  eventsEnabled: CustomerEventType[];
  dailyLimitPerSub: number;
  updatedAt: string;
}

export interface CustomerPushSubscription {
  id: string;
  locationId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  email: string | null;
  orderId: string | null;
  userAgent: string | null;
  lang: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CustomerPushStats {
  totalSubs: number;
  subsActive7d: number;
  events24h: number;
  sent24h: number;
  failed24h: number;
  expired7d: number;
  deliveryRate24hPct: number | null;
}

export interface CustomerPushLogEntry {
  id: string;
  locationId: string;
  subscriptionId: string | null;
  eventType: string;
  title: string;
  body: string;
  url: string | null;
  status: 'sent' | 'failed' | 'expired' | 'skipped';
  error: string | null;
  createdAt: string;
}

// ── Push-Inhalte je Event ─────────────────────────────────────────────────────

const PUSH_CONTENT: Record<CustomerEventType, { title: string; body: string; icon: string }> = {
  driver_assigned:      { title: '📦 Fahrer zugewiesen',       body: 'Ein Fahrer ist unterwegs zum Restaurant.',              icon: '🛵' },
  driver_at_restaurant: { title: '🏠 Fahrer am Restaurant',    body: 'Deine Bestellung wird gleich abgeholt.',                icon: '🏠' },
  driver_departing:     { title: '🚀 Deine Bestellung kommt!', body: 'Dein Fahrer ist jetzt unterwegs zu dir.',              icon: '🛵' },
  driver_nearby:        { title: '📍 Fahrer fast da!',         body: 'Dein Fahrer ist gleich bei dir — bitte bereit halten!', icon: '📍' },
  driver_almost_there:  { title: '⚡ Fahrer in ~2 Minuten!',   body: 'Bitte bereit halten — dein Fahrer ist fast da.',       icon: '⚡' },
  delivered:            { title: '✅ Bestellung geliefert!',   body: 'Guten Appetit! Wie war deine Lieferung?',               icon: '✅' },
  cancelled:            { title: '❌ Bestellung storniert',    body: 'Deine Bestellung wurde storniert.',                     icon: '❌' },
  delayed:              { title: '⏳ Kleine Verzögerung',      body: 'Deine Bestellung verzögert sich leicht. Sorry!',        icon: '⏳' },
  rating_request:       { title: '⭐ Bewerte deine Lieferung', body: 'Wie war dein Essen? Wir freuen uns über Feedback.',    icon: '⭐' },
  loyalty_tier_upgrade: { title: '🎉 Neues Treuepunkte-Level!', body: 'Herzlichen Glückwunsch — du hast ein neues Level erreicht!', icon: '🎉' },
};

// ── VAPID-Setup ───────────────────────────────────────────────────────────────

function getVapidConfig() {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact    = process.env.VAPID_CONTACT ?? 'mailto:ops@mise.app';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, contact };
}

async function getWebPush() {
  const cfg = getVapidConfig();
  if (!cfg) return null;
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(cfg.contact, cfg.publicKey, cfg.privateKey);
  return webpush;
}

// ── Öffentlicher VAPID-Schlüssel ──────────────────────────────────────────────

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

// ── Config CRUD ───────────────────────────────────────────────────────────────

export async function getCustomerPushConfig(locationId: string): Promise<CustomerPushConfig | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('customer_web_push_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (error || !data) return null;
  return mapConfig(data as Record<string, unknown>);
}

export async function upsertCustomerPushConfig(
  locationId: string,
  patch: Partial<Pick<CustomerPushConfig, 'enabled' | 'eventsEnabled' | 'dailyLimitPerSub'>>,
): Promise<CustomerPushConfig> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('customer_web_push_config')
    .upsert({
      location_id:        locationId,
      ...(patch.enabled          != null ? { enabled: patch.enabled }                           : {}),
      ...(patch.eventsEnabled    != null ? { events_enabled: patch.eventsEnabled }              : {}),
      ...(patch.dailyLimitPerSub != null ? { daily_limit_per_sub: patch.dailyLimitPerSub }     : {}),
    }, { onConflict: 'location_id' })
    .select('*')
    .single();
  if (error || !data) throw new Error(`upsertCustomerPushConfig: ${error?.message}`);
  return mapConfig(data as Record<string, unknown>);
}

function mapConfig(r: Record<string, unknown>): CustomerPushConfig {
  return {
    id:               r['id']                 as string,
    locationId:       r['location_id']        as string,
    enabled:          r['enabled']            as boolean,
    eventsEnabled:    ((r['events_enabled'] ?? []) as CustomerEventType[]),
    dailyLimitPerSub: r['daily_limit_per_sub'] as number,
    updatedAt:        r['updated_at']         as string,
  };
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function saveSubscription(params: {
  locationId: string;
  endpoint:   string;
  p256dhKey:  string;
  authKey:    string;
  email?:     string;
  orderId?:   string;
  userAgent?: string;
  lang?:      string;
}): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('customer_push_subscriptions')
    .upsert({
      location_id:  params.locationId,
      endpoint:     params.endpoint,
      p256dh_key:   params.p256dhKey,
      auth_key:     params.authKey,
      email:        params.email     ?? null,
      order_id:     params.orderId   ?? null,
      user_agent:   params.userAgent ?? null,
      lang:         params.lang      ?? 'de',
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`saveSubscription: ${error?.message}`);
  return (data as { id: string }).id;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('customer_push_subscriptions').delete().eq('endpoint', endpoint);
}

export async function removeExpiredSubscription(endpoint: string): Promise<void> {
  await removeSubscription(endpoint);
}

// ── Senden (intern) ───────────────────────────────────────────────────────────

async function sendOne(
  sub: { id: string; endpoint: string; p256dhKey: string; authKey: string },
  payload: { title: string; body: string; url: string; tag: string; eventType: string },
  locationId: string,
  eventType: string,
): Promise<'sent' | 'failed' | 'expired'> {
  const webpush = await getWebPush();
  const svc = createServiceClient();

  if (!webpush) {
    await logPush(svc, { locationId, subscriptionId: sub.id, eventType, title: payload.title, body: payload.body, url: payload.url, status: 'skipped', error: 'VAPID not configured' });
    return 'failed';
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url, tag: payload.tag, type: 'customer' }),
    );
    await svc.from('customer_push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id);
    await logPush(svc, { locationId, subscriptionId: sub.id, eventType, title: payload.title, body: payload.body, url: payload.url, status: 'sent' });
    return 'sent';
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await svc.from('customer_push_subscriptions').delete().eq('id', sub.id);
      await logPush(svc, { locationId, subscriptionId: null, eventType, title: payload.title, body: payload.body, url: payload.url, status: 'expired', error: 'Subscription expired' });
      return 'expired';
    }
    const msg = err instanceof Error ? err.message : String(err);
    await logPush(svc, { locationId, subscriptionId: sub.id, eventType, title: payload.title, body: payload.body, url: payload.url, status: 'failed', error: msg });
    return 'failed';
  }
}

async function logPush(
  svc: ReturnType<typeof createServiceClient>,
  params: { locationId: string; subscriptionId: string | null; eventType: string; title: string; body: string; url: string | null; status: string; error?: string },
): Promise<void> {
  try {
    await svc.from('customer_web_push_log').insert({
      location_id:     params.locationId,
      subscription_id: params.subscriptionId,
      event_type:      params.eventType,
      title:           params.title,
      body:            params.body,
      url:             params.url,
      status:          params.status,
      error:           params.error ?? null,
    });
  } catch { /* fire-and-forget */ }
}

// ── Öffentliche Versand-API ───────────────────────────────────────────────────

/**
 * Sendet Browser-Push an alle Subscriptions einer Bestellung.
 * Fire-and-forget — niemals blockierend.
 */
export async function sendToOrderSubscribers(
  locationId: string,
  orderId:    string,
  eventType:  CustomerEventType,
  trackingUrl?: string,
): Promise<{ sent: number; failed: number; expired: number }> {
  const svc = createServiceClient();
  const { data: subs } = await svc
    .from('customer_push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('location_id', locationId)
    .eq('order_id', orderId)
    .limit(10);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, expired: 0 };

  const content = PUSH_CONTENT[eventType];
  const url = trackingUrl ?? '/order/paid';
  const tag = `mise-order-${orderId}-${eventType}`;

  const results = await Promise.all(
    (subs as { id: string; endpoint: string; p256dh_key: string; auth_key: string }[]).map((s) =>
      sendOne(
        { id: s.id, endpoint: s.endpoint, p256dhKey: s.p256dh_key, authKey: s.auth_key },
        { title: content.title, body: content.body, url, tag, eventType },
        locationId,
        eventType,
      ),
    ),
  );

  return {
    sent:    results.filter((r) => r === 'sent').length,
    failed:  results.filter((r) => r === 'failed').length,
    expired: results.filter((r) => r === 'expired').length,
  };
}

/**
 * Sendet Browser-Push an alle Subscriptions einer E-Mail-Adresse.
 */
export async function sendToEmailSubscribers(
  locationId: string,
  email:      string,
  eventType:  CustomerEventType,
  url?:       string,
): Promise<{ sent: number; failed: number; expired: number }> {
  const svc = createServiceClient();
  const { data: subs } = await svc
    .from('customer_push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('location_id', locationId)
    .eq('email', email)
    .limit(5);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, expired: 0 };

  const content = PUSH_CONTENT[eventType];
  const tag = `mise-email-${eventType}`;

  const results = await Promise.all(
    (subs as { id: string; endpoint: string; p256dh_key: string; auth_key: string }[]).map((s) =>
      sendOne(
        { id: s.id, endpoint: s.endpoint, p256dhKey: s.p256dh_key, authKey: s.auth_key },
        { title: content.title, body: content.body, url: url ?? '/order/paid', tag, eventType },
        locationId,
        eventType,
      ),
    ),
  );

  return {
    sent:    results.filter((r) => r === 'sent').length,
    failed:  results.filter((r) => r === 'failed').length,
    expired: results.filter((r) => r === 'expired').length,
  };
}

/**
 * Haupt-Dispatcher: prüft Config, sendet an Order- und E-Mail-Subs.
 * Fire-and-forget geeignet.
 */
export async function notifyCustomerViaPush(
  locationId:  string,
  orderId:     string,
  eventType:   CustomerEventType,
  email?:      string,
  trackingUrl?: string,
): Promise<void> {
  try {
    const cfg = await getCustomerPushConfig(locationId);
    if (!cfg?.enabled) return;
    if (!cfg.eventsEnabled.includes(eventType)) return;

    const [orderResult, emailResult] = await Promise.all([
      sendToOrderSubscribers(locationId, orderId, eventType, trackingUrl),
      email ? sendToEmailSubscribers(locationId, email, eventType, trackingUrl) : Promise.resolve({ sent: 0, failed: 0, expired: 0 }),
    ]);

    const total = orderResult.sent + emailResult.sent;
    if (total > 0) {
      console.info(`[customer-web-push] ${eventType} → ${total} sent (order=${orderId})`);
    }
  } catch (err) {
    console.error('[customer-web-push] notifyCustomerViaPush:', err instanceof Error ? err.message : err);
  }
}

// ── Admin Broadcast ───────────────────────────────────────────────────────────

export async function broadcastToLocation(
  locationId: string,
  title:      string,
  body:       string,
  url:        string,
  limit = 500,
): Promise<{ sent: number; failed: number; expired: number }> {
  const svc = createServiceClient();
  const { data: subs } = await svc
    .from('customer_push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('location_id', locationId)
    .limit(limit);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, expired: 0 };

  const eventType = 'broadcast';
  const tag = `mise-broadcast-${Date.now()}`;

  const results = await Promise.all(
    (subs as { id: string; endpoint: string; p256dh_key: string; auth_key: string }[]).map((s) =>
      sendOne(
        { id: s.id, endpoint: s.endpoint, p256dhKey: s.p256dh_key, authKey: s.auth_key },
        { title, body, url, tag, eventType },
        locationId,
        eventType,
      ),
    ),
  );

  return {
    sent:    results.filter((r) => r === 'sent').length,
    failed:  results.filter((r) => r === 'failed').length,
    expired: results.filter((r) => r === 'expired').length,
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getCustomerPushDashboard(locationId: string): Promise<{
  config:       CustomerPushConfig | null;
  stats:        CustomerPushStats;
  recentLog:    CustomerPushLogEntry[];
  subscriptions: { total: number; withEmail: number; withOrder: number };
  vapidConfigured: boolean;
}> {
  const svc = createServiceClient();

  const [cfgData, statsData, logData, subCountData] = await Promise.all([
    svc.from('customer_web_push_config').select('*').eq('location_id', locationId).maybeSingle(),
    svc.from('v_customer_push_stats').select('*').eq('location_id', locationId).maybeSingle(),
    svc
      .from('customer_web_push_log')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('customer_push_subscriptions')
      .select('id, email, order_id')
      .eq('location_id', locationId),
  ]);

  const subs = (subCountData.data ?? []) as { id: string; email: string | null; order_id: string | null }[];

  const statsRow = (statsData.data ?? {}) as Record<string, unknown>;

  return {
    config: cfgData.data ? mapConfig(cfgData.data as Record<string, unknown>) : null,
    stats: {
      totalSubs:           Number(statsRow['total_subs']            ?? 0),
      subsActive7d:        Number(statsRow['subs_active_7d']        ?? 0),
      events24h:           Number(statsRow['events_24h']            ?? 0),
      sent24h:             Number(statsRow['sent_24h']              ?? 0),
      failed24h:           Number(statsRow['failed_24h']            ?? 0),
      expired7d:           Number(statsRow['expired_7d']            ?? 0),
      deliveryRate24hPct:  statsRow['delivery_rate_24h_pct'] != null ? Number(statsRow['delivery_rate_24h_pct']) : null,
    },
    recentLog: ((logData.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id:             r['id']              as string,
      locationId:     r['location_id']    as string,
      subscriptionId: r['subscription_id'] as string | null,
      eventType:      r['event_type']     as string,
      title:          r['title']          as string,
      body:           r['body']           as string,
      url:            r['url']            as string | null,
      status:         r['status']         as CustomerPushLogEntry['status'],
      error:          r['error']          as string | null,
      createdAt:      r['created_at']     as string,
    })),
    subscriptions: {
      total:     subs.length,
      withEmail: subs.filter((s) => s.email).length,
      withOrder: subs.filter((s) => s.order_id).length,
    },
    vapidConfigured: getVapidConfig() !== null,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneCustomerPushLogs(daysOld = 30): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_customer_push_logs', { days_old: daysOld });
  return typeof data === 'number' ? data : 0;
}

export async function pruneInactiveSubscriptions(daysOld = 90): Promise<number> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - daysOld * 86_400_000).toISOString();
  const { data } = await svc
    .from('customer_push_subscriptions')
    .delete()
    .or(`last_used_at.lt.${cutoff},last_used_at.is.null`)
    .lt('created_at', cutoff)
    .select('id');
  return data?.length ?? 0;
}
