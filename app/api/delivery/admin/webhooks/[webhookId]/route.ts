/**
 * GET    /api/delivery/admin/webhooks/[webhookId]?location_id=...
 * PATCH  /api/delivery/admin/webhooks/[webhookId]
 * DELETE /api/delivery/admin/webhooks/[webhookId]
 * POST   /api/delivery/admin/webhooks/[webhookId]?action=test
 * GET    /api/delivery/admin/webhooks/[webhookId]?location_id=...&log=true
 *
 * GET — Webhook-Details + optionaler Delivery-Log (?log=true&limit=50)
 * PATCH — Felder aktualisieren: url, secret, events, is_active, description
 * DELETE — Webhook löschen (CASCADE auf delivery_webhook_deliveries)
 * POST ?action=test — Test-Event direkt senden (ohne Queue)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  sendTestEvent,
  getDeliveryLog,
} from '@/lib/delivery/webhooks';
import type { DeliveryEventType } from '@/lib/delivery/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const webhook = await getWebhook(locationId, params.webhookId);
  if (!webhook) return NextResponse.json({ error: 'Webhook nicht gefunden' }, { status: 404 });

  if (searchParams.get('log') === 'true') {
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);
    const log = await getDeliveryLog(locationId, params.webhookId, limit);
    return NextResponse.json({ webhook, log });
  }

  return NextResponse.json({ webhook });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    location_id?: string;
    url?: string;
    secret?: string;
    events?: string[];
    is_active?: boolean;
    description?: string;
  };

  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const changes: Parameters<typeof updateWebhook>[2] = {};
  if (body.url !== undefined)         changes.url        = body.url;
  if (body.secret !== undefined)      changes.secret     = body.secret;
  if (body.events !== undefined)      changes.events     = body.events as DeliveryEventType[];
  if (body.is_active !== undefined)   changes.is_active  = body.is_active;
  if (body.description !== undefined) changes.description = body.description ?? null;

  try {
    const webhook = await updateWebhook(locationId, params.webhookId, changes);
    return NextResponse.json({ webhook });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const existing = await getWebhook(locationId, params.webhookId);
  if (!existing) return NextResponse.json({ error: 'Webhook nicht gefunden' }, { status: 404 });

  await deleteWebhook(locationId, params.webhookId);
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action');
  if (action !== 'test') {
    return NextResponse.json({ error: 'Unbekannte Aktion. Unterstützt: ?action=test' }, { status: 400 });
  }

  const body = await req.json() as { location_id?: string };
  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const result = await sendTestEvent(locationId, params.webhookId);
    return NextResponse.json({
      ok:        result.ok,
      status:    result.status,
      body:      result.body,
      signature: result.signature,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
