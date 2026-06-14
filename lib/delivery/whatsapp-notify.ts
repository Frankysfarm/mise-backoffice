/**
 * lib/delivery/whatsapp-notify.ts
 *
 * WhatsApp Business API Integration — Phase 171
 *
 * Sendet Bestell-Status-Nachrichten via WhatsApp an Kunden.
 * Unterstützt:
 *  - Meta WhatsApp Business Cloud API (empfohlen)
 *  - Twilio WhatsApp API (Fallback)
 *
 * Ereignisse:
 *  driver_assigned   — Fahrer zugewiesen
 *  driver_departing  — Fahrer hat Restaurant verlassen
 *  driver_nearby     — Fahrer ist gleich da
 *  delivered         — Erfolgreich geliefert
 *  cancelled         — Storniert
 *  delayed           — Verspätet
 *
 * Opt-In: Kunden stimmen beim Checkout zu (whatsapp_optins-Tabelle).
 * Template-Nachrichten müssen im WhatsApp Business Manager genehmigt sein.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { CustomerEventType } from './customer-notify';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  locationId: string;
  isEnabled: boolean;
  provider: 'meta' | 'twilio' | 'disabled';
  metaPhoneId: string | null;
  metaAccessToken: string | null;
  twilioSid: string | null;
  twilioToken: string | null;
  twilioWhatsappFrom: string | null;
  templateDriverAssigned: string;
  templateDriverDeparting: string;
  templateDriverNearby: string;
  templateDelivered: string;
  templateCancelled: string;
  templateDelayed: string;
  languageCode: string;
  enabledEvents: CustomerEventType[];
  optinMode: 'explicit' | 'implicit';
  dailyLimitPerNumber: number;
}

export interface WhatsAppSendParams {
  locationId: string;
  orderId: string;
  phone: string;
  eventType: CustomerEventType;
  templateParams?: string[];
  restaurantName?: string;
  etaMin?: number;
  driverName?: string;
}

export interface WhatsAppStats {
  totalMessages: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  last24h: number;
  uniqueRecipients: number;
  activeOptins: number;
  deliveryRatePct: number | null;
}

export interface WhatsAppLogEntry {
  id: string;
  locationId: string;
  orderId: string | null;
  phone: string;
  eventType: string;
  templateName: string | null;
  provider: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  providerMsgId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

// Event → Template-Feld-Mapping
const EVENT_TO_TEMPLATE_KEY: Partial<Record<CustomerEventType, keyof WhatsAppConfig>> = {
  driver_assigned:  'templateDriverAssigned',
  driver_departing: 'templateDriverDeparting',
  driver_nearby:    'templateDriverNearby',
  delivered:        'templateDelivered',
  cancelled:        'templateCancelled',
  delayed:          'templateDelayed',
};

// Nachrichten-Fallback (wenn Template-API nicht konfiguriert)
const FALLBACK_MESSAGES: Partial<Record<CustomerEventType, string>> = {
  driver_assigned:  'Ihr Fahrer wurde zugewiesen und kommt bald! 🛵',
  driver_departing: 'Ihre Bestellung ist jetzt unterwegs zu Ihnen! 🚀',
  driver_nearby:    'Ihr Fahrer ist gleich bei Ihnen — bitte bereit halten! 📍',
  delivered:        'Ihre Bestellung wurde erfolgreich geliefert. Guten Appetit! 🍽️',
  cancelled:        'Ihre Bestellung wurde leider storniert. Wir entschuldigen uns.',
  delayed:          'Ihre Bestellung verzögert sich leicht. Wir bitten um Ihr Verständnis.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────────────────────

function sb() {
  return createServiceClient();
}

// ─────────────────────────────────────────────────────────────────────────────
// Config CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getWhatsAppConfig(locationId: string): Promise<WhatsAppConfig | null> {
  const { data, error } = await sb()
    .from('delivery_whatsapp_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    locationId:               data.location_id,
    isEnabled:                data.is_enabled,
    provider:                 data.provider as WhatsAppConfig['provider'],
    metaPhoneId:              data.meta_phone_id,
    metaAccessToken:          data.meta_access_token,
    twilioSid:                data.twilio_sid,
    twilioToken:              data.twilio_token,
    twilioWhatsappFrom:       data.twilio_whatsapp_from,
    templateDriverAssigned:   data.template_driver_assigned,
    templateDriverDeparting:  data.template_driver_departing,
    templateDriverNearby:     data.template_driver_nearby,
    templateDelivered:        data.template_delivered,
    templateCancelled:        data.template_cancelled,
    templateDelayed:          data.template_delayed,
    languageCode:             data.language_code,
    enabledEvents:            (data.enabled_events ?? []) as CustomerEventType[],
    optinMode:                data.optin_mode as WhatsAppConfig['optinMode'],
    dailyLimitPerNumber:      data.daily_limit_per_number,
  };
}

export async function upsertWhatsAppConfig(
  locationId: string,
  patch: Partial<Omit<WhatsAppConfig, 'locationId'>>,
): Promise<void> {
  const row: Record<string, unknown> = {
    location_id: locationId,
    updated_at:  new Date().toISOString(),
  };

  if (patch.isEnabled          !== undefined) row['is_enabled']               = patch.isEnabled;
  if (patch.provider           !== undefined) row['provider']                 = patch.provider;
  if (patch.metaPhoneId        !== undefined) row['meta_phone_id']            = patch.metaPhoneId;
  if (patch.metaAccessToken    !== undefined) row['meta_access_token']        = patch.metaAccessToken;
  if (patch.twilioSid          !== undefined) row['twilio_sid']               = patch.twilioSid;
  if (patch.twilioToken        !== undefined) row['twilio_token']             = patch.twilioToken;
  if (patch.twilioWhatsappFrom !== undefined) row['twilio_whatsapp_from']     = patch.twilioWhatsappFrom;
  if (patch.templateDriverAssigned  !== undefined) row['template_driver_assigned']  = patch.templateDriverAssigned;
  if (patch.templateDriverDeparting !== undefined) row['template_driver_departing'] = patch.templateDriverDeparting;
  if (patch.templateDriverNearby    !== undefined) row['template_driver_nearby']    = patch.templateDriverNearby;
  if (patch.templateDelivered       !== undefined) row['template_delivered']        = patch.templateDelivered;
  if (patch.templateCancelled       !== undefined) row['template_cancelled']        = patch.templateCancelled;
  if (patch.templateDelayed         !== undefined) row['template_delayed']          = patch.templateDelayed;
  if (patch.languageCode       !== undefined) row['language_code']            = patch.languageCode;
  if (patch.enabledEvents      !== undefined) row['enabled_events']           = patch.enabledEvents;
  if (patch.optinMode          !== undefined) row['optin_mode']               = patch.optinMode;
  if (patch.dailyLimitPerNumber !== undefined) row['daily_limit_per_number'] = patch.dailyLimitPerNumber;

  await sb()
    .from('delivery_whatsapp_config')
    .upsert(row, { onConflict: 'location_id' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Opt-In Management
// ─────────────────────────────────────────────────────────────────────────────

export async function setWhatsAppOptIn(
  locationId: string,
  phone: string,
  optedIn: boolean,
  source: 'checkout' | 'sms_reply' | 'admin' = 'checkout',
): Promise<void> {
  const now = new Date().toISOString();
  await sb()
    .from('whatsapp_optins')
    .upsert(
      {
        location_id:   locationId,
        phone:         normalizePhone(phone),
        opted_in:      optedIn,
        opted_in_at:   optedIn ? now : null,
        opted_out_at:  optedIn ? null : now,
        source,
        updated_at:    now,
      },
      { onConflict: 'location_id,phone' },
    );
}

export async function isOptedIn(locationId: string, phone: string): Promise<boolean> {
  const { data } = await sb()
    .from('whatsapp_optins')
    .select('opted_in')
    .eq('location_id', locationId)
    .eq('phone', normalizePhone(phone))
    .maybeSingle();
  return data?.opted_in === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-Limit Check
// ─────────────────────────────────────────────────────────────────────────────

async function isDailyLimitExceeded(
  locationId: string,
  phone: string,
  limit: number,
): Promise<boolean> {
  if (limit === 0) return false;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await sb()
    .from('whatsapp_message_log')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('phone', normalizePhone(phone))
    .in('status', ['sent', 'delivered'])
    .gte('created_at', since.toISOString());
  return (count ?? 0) >= limit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send via Meta WhatsApp Cloud API
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaMeta(
  config: WhatsAppConfig,
  phone: string,
  templateName: string,
  languageCode: string,
  components: MetaTemplateComponent[],
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  if (!config.metaPhoneId || !config.metaAccessToken) {
    return { success: false, error: 'Meta-Konfiguration unvollständig (Phone-ID oder Access-Token fehlt)' };
  }

  const url = `https://graph.facebook.com/v20.0/${config.metaPhoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to:                phone,
    type:              'template',
    template: {
      name:     templateName,
      language: { code: languageCode },
      components,
    },
  };

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.metaAccessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { success: false, error: `Meta API ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const json = await res.json() as { messages?: Array<{ id: string }> };
    const msgId = json?.messages?.[0]?.id;
    return { success: true, msgId };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send via Twilio
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaTwilio(
  config: WhatsAppConfig,
  phone: string,
  body: string,
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  if (!config.twilioSid || !config.twilioToken || !config.twilioWhatsappFrom) {
    return { success: false, error: 'Twilio-Konfiguration unvollständig' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${config.twilioWhatsappFrom}`,
    To:   `whatsapp:${phone}`,
    Body: body,
  });

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64')}`,
      },
      body:   params.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { success: false, error: `Twilio API ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const json = await res.json() as { sid?: string };
    return { success: true, msgId: json?.sid };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Log helpers
// ─────────────────────────────────────────────────────────────────────────────

async function logMessage(
  locationId: string,
  orderId: string,
  phone: string,
  eventType: string,
  templateName: string | null,
  provider: string,
  status: 'sent' | 'failed',
  providerMsgId?: string,
  errorMessage?: string,
): Promise<void> {
  await sb()
    .from('whatsapp_message_log')
    .insert({
      location_id:     locationId,
      order_id:        orderId || null,
      phone:           normalizePhone(phone),
      event_type:      eventType,
      template_name:   templateName,
      provider,
      status,
      provider_msg_id: providerMsgId ?? null,
      error_message:   errorMessage ?? null,
      sent_at:         status === 'sent' ? new Date().toISOString() : null,
      created_at:      new Date().toISOString(),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Send Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sendet eine WhatsApp-Benachrichtigung an einen Kunden.
 * Fire-and-forget: gibt keine Fehler weiter.
 */
export async function sendWhatsAppNotification(params: WhatsAppSendParams): Promise<void> {
  const { locationId, orderId, phone, eventType, restaurantName, etaMin, driverName } = params;

  try {
    const config = await getWhatsAppConfig(locationId);
    if (!config?.isEnabled || config.provider === 'disabled') return;
    if (!config.enabledEvents.includes(eventType)) return;

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return;

    // Opt-In prüfen
    const opted = await isOptedIn(locationId, normalizedPhone);
    if (!opted) return;

    // Daily-Limit prüfen
    if (await isDailyLimitExceeded(locationId, normalizedPhone, config.dailyLimitPerNumber)) return;

    const templateKey = EVENT_TO_TEMPLATE_KEY[eventType];
    const templateName = templateKey ? String(config[templateKey]) : null;
    const fallbackMsg  = buildFallbackMessage(eventType, { restaurantName, etaMin, driverName });

    let result: { success: boolean; msgId?: string; error?: string };

    if (config.provider === 'meta') {
      const components = buildMetaComponents(eventType, { restaurantName, etaMin, driverName });
      result = await sendViaMeta(
        config,
        normalizedPhone,
        templateName ?? eventType,
        config.languageCode,
        components,
      );
    } else if (config.provider === 'twilio') {
      result = await sendViaTwilio(config, normalizedPhone, fallbackMsg);
    } else {
      return;
    }

    await logMessage(
      locationId,
      orderId,
      normalizedPhone,
      eventType,
      templateName,
      config.provider,
      result.success ? 'sent' : 'failed',
      result.msgId,
      result.error,
    );
  } catch (e) {
    console.error('[whatsapp-notify] sendWhatsAppNotification Fehler:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats & Log
// ─────────────────────────────────────────────────────────────────────────────

export async function getWhatsAppStats(locationId: string): Promise<WhatsAppStats> {
  const { data } = await sb()
    .from('v_whatsapp_stats')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  return {
    totalMessages:    Number(data?.total_messages    ?? 0),
    sentCount:        Number(data?.sent_count        ?? 0),
    deliveredCount:   Number(data?.delivered_count   ?? 0),
    failedCount:      Number(data?.failed_count      ?? 0),
    last24h:          Number(data?.last_24h          ?? 0),
    uniqueRecipients: Number(data?.unique_recipients ?? 0),
    activeOptins:     Number(data?.active_optins     ?? 0),
    deliveryRatePct:  data?.delivery_rate_pct != null ? Number(data.delivery_rate_pct) : null,
  };
}

export async function getWhatsAppLog(
  locationId: string,
  limit = 50,
): Promise<WhatsAppLogEntry[]> {
  const { data } = await sb()
    .from('whatsapp_message_log')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id:            r.id,
    locationId:    r.location_id,
    orderId:       r.order_id,
    phone:         r.phone,
    eventType:     r.event_type,
    templateName:  r.template_name,
    provider:      r.provider,
    status:        r.status,
    providerMsgId: r.provider_msg_id,
    errorMessage:  r.error_message,
    sentAt:        r.sent_at,
    deliveredAt:   r.delivered_at,
    createdAt:     r.created_at,
  }));
}

export async function getOptinList(
  locationId: string,
  limit = 100,
): Promise<Array<{ phone: string; optedIn: boolean; source: string; updatedAt: string }>> {
  const { data } = await sb()
    .from('whatsapp_optins')
    .select('phone, opted_in, source, updated_at')
    .eq('location_id', locationId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    phone:     r.phone,
    optedIn:   r.opted_in,
    source:    r.source ?? 'unknown',
    updatedAt: r.updated_at,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Delivery-Status per Webhook aktualisieren (Meta sendet Callbacks)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMetaWebhookStatus(
  providerMsgId: string,
  newStatus: 'delivered' | 'read' | 'failed',
): Promise<void> {
  await sb()
    .from('whatsapp_message_log')
    .update({
      status:       newStatus,
      delivered_at: newStatus === 'delivered' ? new Date().toISOString() : undefined,
    })
    .eq('provider_msg_id', providerMsgId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Interne Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

interface MessageContext {
  restaurantName?: string;
  etaMin?: number;
  driverName?: string;
}

type MetaTemplateComponent = {
  type: 'body';
  parameters: Array<{ type: 'text'; text: string }>;
};

function buildMetaComponents(
  event: CustomerEventType,
  ctx: MessageContext,
): MetaTemplateComponent[] {
  const params: string[] = [];

  if (event === 'driver_assigned' || event === 'driver_departing') {
    if (ctx.driverName) params.push(ctx.driverName);
    if (ctx.etaMin) params.push(`${ctx.etaMin}`);
  } else if (event === 'driver_nearby') {
    params.push('2');
  } else if (event === 'delivered') {
    if (ctx.restaurantName) params.push(ctx.restaurantName);
  }

  if (params.length === 0) return [];
  return [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) }];
}

function buildFallbackMessage(event: CustomerEventType, ctx: MessageContext): string {
  let msg = FALLBACK_MESSAGES[event] ?? 'Status-Update zu Ihrer Bestellung.';

  if (ctx.driverName && (event === 'driver_assigned' || event === 'driver_departing')) {
    msg = msg.replace('Ihr Fahrer', ctx.driverName);
  }
  if (ctx.etaMin && event === 'driver_departing') {
    msg += ` Voraussichtliche Ankunft: ${ctx.etaMin} Minuten.`;
  }
  if (ctx.restaurantName && event === 'delivered') {
    msg = `Ihre Bestellung von ${ctx.restaurantName} wurde erfolgreich geliefert. Guten Appetit! 🍽️`;
  }

  return msg;
}

function normalizePhone(raw: string): string {
  let p = raw.replace(/\s/g, '').replace(/-/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+49' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}
