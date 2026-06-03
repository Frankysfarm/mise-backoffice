/**
 * GET   /api/delivery/admin/webhooks?location_id=...
 * POST  /api/delivery/admin/webhooks
 *
 * GET — Liste aller Webhooks mit Statistiken (aus v_webhook_summary VIEW).
 *   Query: location_id (Pflicht)
 *   Response: { webhooks: WebhookWithStats[], total: number }
 *
 * POST — Neuen Webhook registrieren.
 *   Body: { location_id, url, secret, events[], description? }
 *   Response: { webhook: DeliveryWebhook }
 *
 * Beide Endpunkte erfordern authentifizierten Admin-Nutzer.
 * Graceful-Fallback wenn Migration 025 noch nicht ausgeführt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listWebhooks,
  registerWebhook,
} from '@/lib/delivery/webhooks';
import type { DeliveryEventType } from '@/lib/delivery/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const webhooks = await listWebhooks(locationId);
    return NextResponse.json({ webhooks, total: webhooks.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Graceful Fallback wenn Tabelle noch nicht existiert
    if (msg.includes('relation') && msg.includes('delivery_webhooks')) {
      return NextResponse.json({ webhooks: [], total: 0, migration_pending: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    location_id?: string;
    url?: string;
    secret?: string;
    events?: string[];
    description?: string;
  };

  if (!body.location_id) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!body.url)         return NextResponse.json({ error: 'url fehlt' }, { status: 400 });
  if (!body.secret)      return NextResponse.json({ error: 'secret fehlt' }, { status: 400 });
  if (!body.events?.length) return NextResponse.json({ error: 'events[] fehlt oder leer' }, { status: 400 });

  try {
    const webhook = await registerWebhook(
      body.location_id,
      body.url,
      body.secret,
      body.events as DeliveryEventType[],
      body.description,
    );
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('duplicate') || msg.includes('unique') ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
