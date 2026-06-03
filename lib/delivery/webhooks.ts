/**
 * lib/delivery/webhooks.ts
 *
 * Phase 25: Webhook System + External Integration Engine
 *
 * Externe Systeme (POS, Payment, Analytics) können Delivery-Events abonnieren.
 * Jede Zustellung wird HMAC-SHA256-signiert. Retries mit exponentiellem Backoff.
 * Auto-Disable nach 10 aufeinanderfolgenden Fehlern.
 *
 * Signatur-Verifikation beim Empfänger:
 *   const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
 *   if (sig !== req.headers['x-mise-signature']) { reject(); }
 *
 * Funktionen:
 *   registerWebhook()       — Webhook anlegen
 *   listWebhooks()          — alle Webhooks einer Location
 *   getWebhook()            — einzelnen Webhook laden
 *   updateWebhook()         — URL / Events / Secret / Status ändern
 *   deleteWebhook()         — löschen (+ alle Delivery-Records via CASCADE)
 *   queueWebhookEvent()     — Event in Delivery-Queue einreihen (fire-and-forget)
 *   processWebhookQueue()   — Queue abarbeiten (Cron-Helfer)
 *   processAllWebhooks()    — Cron-Wrapper: bis zu 100 Deliveries pro Tick
 *   sendTestEvent()         — Test-Payload an Webhook senden
 *   getDeliveryLog()        — Delivery-History für Admin
 */
import 'server-only';
import { createHmac } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { DeliveryEventType } from './events';

// ============================================================
// Konstanten
// ============================================================

const MAX_ATTEMPTS = 5;
const AUTO_DISABLE_AFTER = 10; // consecutive failures
const TIMEOUT_MS = 10_000;
const API_VERSION = '2026-06';

// Retry-Delays in Minuten: 1 min, 5 min, 30 min, 2 h, 8 h
const RETRY_DELAYS_MIN = [1, 5, 30, 120, 480] as const;

// ============================================================
// Typen
// ============================================================

export interface DeliveryWebhook {
  id: string;
  location_id: string;
  url: string;
  secret: string;
  events: DeliveryEventType[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_delivered_at: string | null;
  consecutive_failures: number;
}

export interface WebhookWithStats extends DeliveryWebhook {
  total_delivered: number;
  pending_deliveries: number;
  failed_deliveries: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  location_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  delivered_at: string | null;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  created_at: string;
}

export interface WebhookProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  disabled: number;
}

// ============================================================
// HMAC-Signatur
// ============================================================

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

// ============================================================
// Retry-Backoff
// ============================================================

function nextRetryAt(attempt: number): string {
  const delayMin = RETRY_DELAYS_MIN[Math.min(attempt, RETRY_DELAYS_MIN.length - 1)];
  return new Date(Date.now() + delayMin * 60_000).toISOString();
}

// ============================================================
// CRUD
// ============================================================

export async function registerWebhook(
  locationId: string,
  url: string,
  secret: string,
  events: DeliveryEventType[],
  description?: string,
): Promise<DeliveryWebhook> {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    throw new Error('Webhook-URL muss mit http:// oder https:// beginnen');
  }
  if (secret.length < 16) {
    throw new Error('Secret muss mindestens 16 Zeichen lang sein');
  }
  if (events.length === 0) {
    throw new Error('Mindestens ein Event muss abonniert werden');
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_webhooks')
    .insert({
      location_id: locationId,
      url,
      secret,
      events,
      description: description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as DeliveryWebhook;
}

export async function listWebhooks(locationId: string): Promise<WebhookWithStats[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_webhook_summary')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  return (data ?? []) as unknown as WebhookWithStats[];
}

export async function getWebhook(
  locationId: string,
  webhookId: string,
): Promise<DeliveryWebhook | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_webhooks')
    .select('*')
    .eq('location_id', locationId)
    .eq('id', webhookId)
    .maybeSingle();

  return (data ?? null) as unknown as DeliveryWebhook | null;
}

export async function updateWebhook(
  locationId: string,
  webhookId: string,
  changes: Partial<Pick<DeliveryWebhook, 'url' | 'secret' | 'events' | 'is_active' | 'description'>>,
): Promise<DeliveryWebhook> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_webhooks')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('id', webhookId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as DeliveryWebhook;
}

export async function deleteWebhook(locationId: string, webhookId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('delivery_webhooks')
    .delete()
    .eq('location_id', locationId)
    .eq('id', webhookId);
}

// ============================================================
// Queue
// ============================================================

/**
 * Reiht ein Event in die Delivery-Queue ein.
 * Schreibt einen Eintrag pro abonniertem Webhook.
 * Fire-and-forget — wirft nie, Fehler werden geloggt.
 */
export async function queueWebhookEvent(
  locationId: string,
  eventType: DeliveryEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = createServiceClient();

    const { data: webhooks } = await sb
      .from('delivery_webhooks')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (!webhooks?.length) return;

    const deliveries = webhooks.map((w) => ({
      webhook_id:  w.id as string,
      location_id: locationId,
      event_type:  eventType,
      payload,
    }));

    await sb.from('delivery_webhook_deliveries').insert(deliveries);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[webhooks] queue failed:', err);
  }
}

// ============================================================
// Delivery-Queue verarbeiten
// ============================================================

interface RawDelivery {
  id: string;
  webhook_id: string;
  location_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

interface WebhookRow {
  url: string;
  secret: string;
  is_active: boolean;
}

export async function processWebhookQueue(limit = 50): Promise<WebhookProcessResult> {
  const sb = createServiceClient();
  const now = new Date().toISOString();

  // Offene Deliveries laden (pending = delivered_at IS NULL, unter Attempt-Limit, fällig)
  const { data: pending } = await sb
    .from('delivery_webhook_deliveries')
    .select('id, webhook_id, location_id, event_type, payload, attempt_count')
    .is('delivered_at', null)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pending?.length) return { processed: 0, succeeded: 0, failed: 0, disabled: 0 };

  // Webhook-Details laden (dedupliziert)
  const webhookIds = [...new Set((pending as RawDelivery[]).map((d) => d.webhook_id))];
  const { data: webhookRows } = await sb
    .from('delivery_webhooks')
    .select('id, url, secret, is_active')
    .in('id', webhookIds);

  const webhookMap = new Map<string, WebhookRow>(
    (webhookRows ?? []).map((w) => [w.id as string, w as unknown as WebhookRow]),
  );

  let succeeded = 0;
  let failed = 0;
  let disabled = 0;

  await Promise.all(
    (pending as RawDelivery[]).map(async (delivery) => {
      const hook = webhookMap.get(delivery.webhook_id);

      if (!hook || !hook.is_active) {
        // Webhook deaktiviert — Delivery als erledigt markieren
        await sb
          .from('delivery_webhook_deliveries')
          .update({ delivered_at: now, response_status: 0, response_body: 'webhook_disabled' })
          .eq('id', delivery.id);
        disabled++;
        return;
      }

      const body = JSON.stringify({
        id:          delivery.id,
        event:       delivery.event_type,
        location_id: delivery.location_id,
        payload:     delivery.payload,
        timestamp:   now,
        api_version: API_VERSION,
      });

      const signature = signPayload(hook.secret, body);

      try {
        const resp = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type':     'application/json',
            'X-Mise-Signature': signature,
            'X-Mise-Event':     delivery.event_type,
            'User-Agent':       'Mise-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const responseText = await resp.text().catch(() => '');

        if (resp.ok) {
          await sb
            .from('delivery_webhook_deliveries')
            .update({
              delivered_at:    now,
              response_status: resp.status,
              response_body:   responseText.slice(0, 500),
            })
            .eq('id', delivery.id);

          await sb
            .from('delivery_webhooks')
            .update({ last_delivered_at: now, consecutive_failures: 0 })
            .eq('id', delivery.webhook_id);

          succeeded++;
        } else {
          throw new Error(`HTTP ${resp.status}: ${responseText.slice(0, 200)}`);
        }
      } catch (err) {
        const newAttempt = delivery.attempt_count + 1;
        const isPermanent = newAttempt >= MAX_ATTEMPTS;
        const errMsg = err instanceof Error ? err.message : String(err);

        await sb
          .from('delivery_webhook_deliveries')
          .update({
            attempt_count:   newAttempt,
            response_status: -1,
            response_body:   errMsg.slice(0, 500),
            next_retry_at:   isPermanent ? null : nextRetryAt(newAttempt),
            ...(isPermanent ? { delivered_at: now } : {}),
          })
          .eq('id', delivery.id);

        // Aufeinanderfolgende Fehler zählen + ggf. Webhook auto-deaktivieren
        const { data: hookData } = await sb
          .from('delivery_webhooks')
          .select('consecutive_failures')
          .eq('id', delivery.webhook_id)
          .maybeSingle();

        const consecutiveFails = ((hookData?.consecutive_failures as number) ?? 0) + 1;
        await sb
          .from('delivery_webhooks')
          .update({
            consecutive_failures: consecutiveFails,
            ...(consecutiveFails >= AUTO_DISABLE_AFTER ? { is_active: false } : {}),
          })
          .eq('id', delivery.webhook_id);

        failed++;
      }
    }),
  );

  return { processed: pending.length, succeeded, failed, disabled };
}

export async function processAllWebhooks(): Promise<WebhookProcessResult> {
  return processWebhookQueue(100);
}

// ============================================================
// Test-Event
// ============================================================

/**
 * Sendet ein Test-Event direkt an einen Webhook (ohne Queue).
 * Nützlich beim Anlegen, um URL und Secret zu prüfen.
 */
export async function sendTestEvent(
  locationId: string,
  webhookId: string,
): Promise<{ ok: boolean; status: number; body: string; signature: string }> {
  const hook = await getWebhook(locationId, webhookId);
  if (!hook) throw new Error('Webhook nicht gefunden');

  const now = new Date().toISOString();
  const body = JSON.stringify({
    id:          'test-' + Date.now(),
    event:       'webhook_test',
    location_id: locationId,
    payload: {
      message: 'Dies ist ein Test-Event von Mise Smart Delivery.',
      webhook_id: webhookId,
    },
    timestamp:   now,
    api_version: API_VERSION,
  });

  const signature = signPayload(hook.secret, body);

  try {
    const resp = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Mise-Signature': signature,
        'X-Mise-Event':     'webhook_test',
        'User-Agent':       'Mise-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const responseText = await resp.text().catch(() => '');
    return { ok: resp.ok, status: resp.status, body: responseText.slice(0, 500), signature };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: -1, body: msg, signature };
  }
}

// ============================================================
// Delivery-Log
// ============================================================

export async function getDeliveryLog(
  locationId: string,
  webhookId: string,
  limit = 50,
): Promise<WebhookDelivery[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_webhook_deliveries')
    .select('*')
    .eq('location_id', locationId)
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as WebhookDelivery[];
}
