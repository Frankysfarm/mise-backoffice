/**
 * lib/delivery/customer-push.ts
 *
 * Phase 49: Customer Push Notification Engine
 *
 * Sendet proaktive Status-Benachrichtigungen an Kunden (SMS, WhatsApp, E-Mail)
 * via konfigurierbaren Webhook-Endpunkt des jeweiligen Tenants.
 *
 * Signatur: HMAC-SHA256 im Header X-Mise-Signature — identisch zur B2B-Webhook-Engine.
 * Retries: max 3 Versuche, Backoff 1 Min → 10 Min → 60 Min.
 * Rate-Limit: max_per_order pro Bestellung (Default 5), konfigurierbar.
 * Graceful Fallback: wenn Migration 041 fehlt, läuft alles still durch.
 */
import 'server-only';
import { createHmac } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { CustomerEventType } from './customer-notify';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface CustomerNotificationConfig {
  id: string;
  locationId: string;
  isEnabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  enabledEvents: CustomerEventType[];
  messagePrefix: string | null;
  maxPerOrder: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNotificationEntry {
  id: string;
  locationId: string;
  orderId: string;
  eventType: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerName: string | null;
  messageDe: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attemptCount: number;
  webhookStatus: number | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

// ── Konstanten ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MIN = [1, 10, 60] as const;
const DEFAULT_TIMEOUT_MS = 8_000;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function nextRetryAt(attempt: number): string {
  const delayMin = RETRY_DELAYS_MIN[Math.min(attempt, RETRY_DELAYS_MIN.length - 1)];
  return new Date(Date.now() + delayMin * 60_000).toISOString();
}

// Ersetzt {name} im message_prefix wenn Kundenname vorhanden
function buildMessage(prefix: string | null, messageDe: string, customerName: string | null): string {
  if (!prefix) return messageDe;
  const resolved = customerName
    ? prefix.replace('{name}', customerName)
    : prefix.replace(/\{name\},?\s*/g, '');
  return resolved + messageDe;
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getNotificationConfig(
  locationId: string,
): Promise<CustomerNotificationConfig | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('customer_notification_config')
    .select('id, location_id, is_enabled, webhook_url, webhook_secret, enabled_events, message_prefix, max_per_order, timeout_ms, created_at, updated_at')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) {
    if (error.message.includes('customer_notification_config') || error.code === '42P01') return null;
    console.error('[customer-push] getNotificationConfig:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    id:             data.id as string,
    locationId:     data.location_id as string,
    isEnabled:      data.is_enabled as boolean,
    webhookUrl:     data.webhook_url as string | null,
    webhookSecret:  data.webhook_secret as string | null,
    enabledEvents:  (data.enabled_events as string[]) as CustomerEventType[],
    messagePrefix:  data.message_prefix as string | null,
    maxPerOrder:    data.max_per_order as number,
    timeoutMs:      data.timeout_ms as number,
    createdAt:      data.created_at as string,
    updatedAt:      data.updated_at as string,
  };
}

export async function upsertNotificationConfig(
  locationId: string,
  patch: Partial<{
    isEnabled: boolean;
    webhookUrl: string | null;
    webhookSecret: string | null;
    enabledEvents: CustomerEventType[];
    messagePrefix: string | null;
    maxPerOrder: number;
    timeoutMs: number;
  }>,
): Promise<CustomerNotificationConfig | null> {
  const sb = createServiceClient();

  const upsertData: Record<string, unknown> = {
    location_id: locationId,
    updated_at:  new Date().toISOString(),
  };
  if (patch.isEnabled    !== undefined) upsertData.is_enabled    = patch.isEnabled;
  if (patch.webhookUrl   !== undefined) upsertData.webhook_url   = patch.webhookUrl;
  if (patch.webhookSecret !== undefined) upsertData.webhook_secret = patch.webhookSecret;
  if (patch.enabledEvents !== undefined) upsertData.enabled_events = patch.enabledEvents;
  if (patch.messagePrefix !== undefined) upsertData.message_prefix = patch.messagePrefix;
  if (patch.maxPerOrder  !== undefined) upsertData.max_per_order  = patch.maxPerOrder;
  if (patch.timeoutMs    !== undefined) upsertData.timeout_ms     = patch.timeoutMs;

  const { data, error } = await sb
    .from('customer_notification_config')
    .upsert(upsertData, { onConflict: 'location_id' })
    .select('id, location_id, is_enabled, webhook_url, webhook_secret, enabled_events, message_prefix, max_per_order, timeout_ms, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[customer-push] upsertNotificationConfig:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    id:             data.id as string,
    locationId:     data.location_id as string,
    isEnabled:      data.is_enabled as boolean,
    webhookUrl:     data.webhook_url as string | null,
    webhookSecret:  data.webhook_secret as string | null,
    enabledEvents:  (data.enabled_events as string[]) as CustomerEventType[],
    messagePrefix:  data.message_prefix as string | null,
    maxPerOrder:    data.max_per_order as number,
    timeoutMs:      data.timeout_ms as number,
    createdAt:      data.created_at as string,
    updatedAt:      data.updated_at as string,
  };
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

/**
 * Stellt eine Benachrichtigung in die Queue mit expliziten Kontaktdaten.
 * Prüft: config vorhanden + enabled + event in enabledEvents + max_per_order nicht überschritten.
 * Fire-and-forget — wirft niemals nach oben.
 */
export async function enqueueCustomerNotification(opts: {
  orderId: string;
  locationId: string;
  eventId?: string;
  eventType: CustomerEventType;
  messageDe: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = createServiceClient();

    const config = await getNotificationConfig(opts.locationId);
    if (!config || !config.isEnabled || !config.webhookUrl) return;
    if (!config.enabledEvents.includes(opts.eventType)) return;
    if (!opts.customerPhone && !opts.customerEmail) return;

    const { count } = await sb
      .from('customer_notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', opts.orderId)
      .in('status', ['pending', 'sent']);

    if ((count ?? 0) >= config.maxPerOrder) return;

    await sb.from('customer_notification_queue').insert({
      location_id:    opts.locationId,
      order_id:       opts.orderId,
      event_id:       opts.eventId ?? null,
      event_type:     opts.eventType,
      customer_phone: opts.customerPhone ?? null,
      customer_email: opts.customerEmail ?? null,
      customer_name:  opts.customerName ?? null,
      message_de:     opts.messageDe,
      metadata:       opts.metadata ?? null,
      status:         'pending',
      created_at:     new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('customer_notification') || msg.includes('42P01')) return;
    console.error('[customer-push] enqueueCustomerNotification:', msg);
  }
}

/**
 * Convenience-Wrapper: lädt Kontaktdaten aus customer_orders und stellt in Queue.
 * Wird von customer-notify.ts via dynamischem Import aufgerufen (kein zirkulärer Import).
 */
export async function enqueueForOrder(
  orderId: string,
  locationId: string,
  eventId: string | undefined,
  eventType: CustomerEventType,
  messageDe: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Quick-Check: Config vorhanden und aktiv? (Kurschluss vor DB-Lookup)
    const config = await getNotificationConfig(locationId);
    if (!config || !config.isEnabled || !config.webhookUrl) return;
    if (!config.enabledEvents.includes(eventType)) return;

    // Kundenkontakt aus customer_orders laden
    const sb = createServiceClient();
    const { data: order } = await sb
      .from('customer_orders')
      .select('kunde_name, kunde_telefon')
      .eq('id', orderId)
      .maybeSingle();

    const phone = (order?.kunde_telefon as string | null) ?? null;
    const name  = (order?.kunde_name  as string | null) ?? null;

    if (!phone) return; // Kein Kontakt → kein Versand

    await enqueueCustomerNotification({
      orderId,
      locationId,
      eventId,
      eventType,
      messageDe,
      customerPhone: phone,
      customerEmail: null,
      customerName:  name,
      metadata,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('customer_notification') || msg.includes('42P01')) return;
    console.error('[customer-push] enqueueForOrder:', msg);
  }
}

// ── Process ───────────────────────────────────────────────────────────────────

interface PendingRow {
  id: string;
  location_id: string;
  order_id: string;
  event_type: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_name: string | null;
  message_de: string;
  metadata: Record<string, unknown> | null;
  attempt_count: number;
  webhook_url: string;
  webhook_secret: string | null;
  timeout_ms: number;
  message_prefix: string | null;
}

async function deliverNotification(row: PendingRow): Promise<{ status: number; body: string }> {
  const message = buildMessage(row.message_prefix, row.message_de, row.customer_name);
  const payload = {
    id:         row.id,
    order_id:   row.order_id,
    event_type: row.event_type,
    message:    message,
    phone:      row.customer_phone,
    email:      row.customer_email,
    name:       row.customer_name,
    metadata:   row.metadata,
    timestamp:  new Date().toISOString(),
    api_version: '2026-06',
  };

  const body = JSON.stringify(payload);
  const signature = row.webhook_secret ? sign(row.webhook_secret, body) : null;

  const headers: Record<string, string> = {
    'Content-Type':    'application/json',
    'User-Agent':      'Mise-Notify/1.0',
    'X-Mise-Event':    row.event_type,
    'X-Mise-Order-Id': row.order_id,
  };
  if (signature) headers['X-Mise-Signature'] = signature;

  const timeoutMs = Math.min(row.timeout_ms ?? DEFAULT_TIMEOUT_MS, 15_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(row.webhook_url, {
      method:  'POST',
      headers,
      body,
      signal:  controller.signal,
    });
    const responseBody = await res.text().catch(() => '');
    return { status: res.status, body: responseBody.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verarbeitet ausstehende Benachrichtigungen.
 * Max 50 pro Aufruf (Cron-Safe).
 */
export async function processCustomerNotifications(
  limit = 50,
): Promise<NotificationProcessResult> {
  const sb = createServiceClient();
  const result: NotificationProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  let rows: PendingRow[];
  try {
    const { data, error } = await sb
      .from('v_pending_customer_notifications')
      .select('id, location_id, order_id, event_type, customer_phone, customer_email, customer_name, message_de, metadata, attempt_count, webhook_url, webhook_secret, timeout_ms, message_prefix')
      .limit(limit);

    if (error) {
      if (error.message.includes('v_pending_customer_notifications') || error.code === '42P01') return result;
      console.error('[customer-push] processCustomerNotifications fetch:', error.message);
      return result;
    }
    rows = (data ?? []) as PendingRow[];
  } catch {
    return result;
  }

  await Promise.all(rows.map(async (row) => {
    result.processed++;
    const attempt = row.attempt_count + 1;

    try {
      const { status, body } = await deliverNotification(row);
      const success = status >= 200 && status < 300;

      await sb
        .from('customer_notification_queue')
        .update({
          status:           success ? 'sent' : (attempt >= MAX_ATTEMPTS ? 'failed' : 'pending'),
          attempt_count:    attempt,
          last_attempt_at:  new Date().toISOString(),
          next_retry_at:    success || attempt >= MAX_ATTEMPTS ? null : nextRetryAt(attempt),
          sent_at:          success ? new Date().toISOString() : null,
          webhook_status:   status,
          webhook_response: body.slice(0, 500),
        })
        .eq('id', row.id);

      if (success) result.sent++;
      else if (attempt >= MAX_ATTEMPTS) result.failed++;
      // else stays pending for retry
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes('abort') || msg.includes('timeout');

      await sb
        .from('customer_notification_queue')
        .update({
          status:           attempt >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempt_count:    attempt,
          last_attempt_at:  new Date().toISOString(),
          next_retry_at:    attempt >= MAX_ATTEMPTS ? null : nextRetryAt(attempt),
          webhook_status:   isTimeout ? 408 : 0,
          webhook_response: msg.slice(0, 500),
        })
        .eq('id', row.id);

      if (attempt >= MAX_ATTEMPTS) result.failed++;
    }
  }));

  return result;
}

/**
 * Cron-Wrapper: verarbeitet alle ausstehenden Benachrichtigungen.
 */
export async function processAllCustomerNotifications(): Promise<NotificationProcessResult> {
  try {
    return await processCustomerNotifications(50);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('customer_notification') || msg.includes('42P01')) {
      return { processed: 0, sent: 0, failed: 0, skipped: 0 };
    }
    console.error('[customer-push] processAllCustomerNotifications:', msg);
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }
}

// ── Admin: Log abrufen ────────────────────────────────────────────────────────

export async function getNotificationLog(
  locationId: string,
  opts?: { limit?: number; status?: string },
): Promise<CustomerNotificationEntry[]> {
  const sb = createServiceClient();
  let query = sb
    .from('customer_notification_queue')
    .select('id, location_id, order_id, event_type, customer_phone, customer_email, customer_name, message_de, status, attempt_count, webhook_status, sent_at, created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    id:            row.id as string,
    locationId:    row.location_id as string,
    orderId:       row.order_id as string,
    eventType:     row.event_type as string,
    customerPhone: row.customer_phone as string | null,
    customerEmail: row.customer_email as string | null,
    customerName:  row.customer_name as string | null,
    messageDe:     row.message_de as string,
    status:        row.status as CustomerNotificationEntry['status'],
    attemptCount:  row.attempt_count as number,
    webhookStatus: row.webhook_status as number | null,
    sentAt:        row.sent_at as string | null,
    createdAt:     row.created_at as string,
  }));
}

// ── Admin: Statistiken ────────────────────────────────────────────────────────

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  successRate: number;
}

export async function getNotificationStats(locationId: string): Promise<NotificationStats> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('customer_notification_queue')
    .select('status', { count: 'exact' })
    .eq('location_id', locationId);

  if (error || !data) return { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0, successRate: 0 };

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.status as string] = (counts[row.status as string] ?? 0) + 1;
  }

  const sent    = counts['sent']    ?? 0;
  const failed  = counts['failed']  ?? 0;
  const pending = counts['pending'] ?? 0;
  const skipped = counts['skipped'] ?? 0;
  const total   = sent + failed + pending + skipped;

  return {
    total,
    sent,
    failed,
    pending,
    skipped,
    successRate: total > 0 ? Math.round((sent / Math.max(sent + failed, 1)) * 100) : 0,
  };
}
