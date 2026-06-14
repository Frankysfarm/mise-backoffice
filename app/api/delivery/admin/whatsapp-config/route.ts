/**
 * GET  /api/delivery/admin/whatsapp-config
 * POST /api/delivery/admin/whatsapp-config
 *
 * Admin-API für WhatsApp Business API Konfiguration.
 * GET  action=config|stats|log|optins
 * POST action=save_config|set_optin|webhook_status|send_test
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getWhatsAppConfig,
  upsertWhatsAppConfig,
  getWhatsAppStats,
  getWhatsAppLog,
  getOptinList,
  setWhatsAppOptIn,
  sendWhatsAppNotification,
  handleMetaWebhookStatus,
} from '@/lib/delivery/whatsapp-notify';
import type { CustomerEventType } from '@/lib/delivery/customer-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'config';

  if (action === 'stats') {
    const [config, stats] = await Promise.all([
      getWhatsAppConfig(locationId),
      getWhatsAppStats(locationId),
    ]);
    return NextResponse.json({ config, stats });
  }

  if (action === 'log') {
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);
    const log = await getWhatsAppLog(locationId, limit);
    return NextResponse.json({ log });
  }

  if (action === 'optins') {
    const list = await getOptinList(locationId);
    return NextResponse.json({ optins: list });
  }

  // default: config + stats
  const [config, stats] = await Promise.all([
    getWhatsAppConfig(locationId),
    getWhatsAppStats(locationId),
  ]);
  return NextResponse.json({ config, stats });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body['action'] as string;

  if (action === 'save_config') {
    await upsertWhatsAppConfig(locationId, {
      isEnabled:              body['isEnabled']              as boolean | undefined,
      provider:               body['provider']              as 'meta' | 'twilio' | 'disabled' | undefined,
      metaPhoneId:            body['metaPhoneId']           as string | null | undefined,
      metaAccessToken:        body['metaAccessToken']       as string | null | undefined,
      twilioSid:              body['twilioSid']             as string | null | undefined,
      twilioToken:            body['twilioToken']           as string | null | undefined,
      twilioWhatsappFrom:     body['twilioWhatsappFrom']    as string | null | undefined,
      templateDriverAssigned: body['templateDriverAssigned'] as string | undefined,
      templateDriverDeparting:body['templateDriverDeparting'] as string | undefined,
      templateDriverNearby:   body['templateDriverNearby']   as string | undefined,
      templateDelivered:      body['templateDelivered']      as string | undefined,
      templateCancelled:      body['templateCancelled']      as string | undefined,
      templateDelayed:        body['templateDelayed']        as string | undefined,
      languageCode:           body['languageCode']           as string | undefined,
      enabledEvents:          body['enabledEvents']          as CustomerEventType[] | undefined,
      optinMode:              body['optinMode']              as 'explicit' | 'implicit' | undefined,
      dailyLimitPerNumber:    body['dailyLimitPerNumber']    as number | undefined,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'set_optin') {
    const phone = String(body['phone'] ?? '');
    const optedIn = Boolean(body['optedIn']);
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
    await setWhatsAppOptIn(locationId, phone, optedIn, 'admin');
    return NextResponse.json({ ok: true });
  }

  if (action === 'send_test') {
    const phone = String(body['phone'] ?? '');
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
    await sendWhatsAppNotification({
      locationId,
      orderId:       'test-order',
      phone,
      eventType:     'driver_departing',
      restaurantName: 'Test Restaurant',
      etaMin:        25,
      driverName:    'Test Fahrer',
    });
    return NextResponse.json({ ok: true, note: 'Testnachricht in die Warteschlange eingereiht' });
  }

  if (action === 'webhook_status') {
    const msgId    = String(body['providerMsgId'] ?? '');
    const status   = body['status'] as 'delivered' | 'read' | 'failed';
    if (!msgId || !status) return NextResponse.json({ error: 'providerMsgId and status required' }, { status: 400 });
    await handleMetaWebhookStatus(msgId, status);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
