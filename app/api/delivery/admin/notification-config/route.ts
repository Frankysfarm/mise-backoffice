/**
 * GET  /api/delivery/admin/notification-config
 * POST /api/delivery/admin/notification-config
 *
 * Admin: Kunden-Benachrichtigungs-Konfiguration laden und speichern.
 * Requires: authenticated session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getNotificationConfig,
  upsertNotificationConfig,
  getNotificationStats,
  type CustomerNotificationConfig,
} from '@/lib/delivery/customer-push';
import type { CustomerEventType } from '@/lib/delivery/customer-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_EVENTS: CustomerEventType[] = [
  'driver_assigned',
  'driver_at_restaurant',
  'driver_departing',
  'driver_nearby',
  'delivered',
  'cancelled',
  'delayed',
];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const [config, stats] = await Promise.all([
    getNotificationConfig(locationId),
    getNotificationStats(locationId),
  ]);

  return NextResponse.json({
    config: config ?? {
      locationId,
      isEnabled: false,
      webhookUrl: null,
      webhookSecret: null,
      enabledEvents: ['driver_departing', 'driver_nearby', 'delivered', 'cancelled', 'delayed'],
      messagePrefix: null,
      maxPerOrder: 5,
      timeoutMs: 8000,
    } satisfies Partial<CustomerNotificationConfig>,
    stats,
    availableEvents: VALID_EVENTS,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = (body.location_id ?? body.locationId) as string | undefined;
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  // Validate enabled_events if provided
  const rawEvents = body.enabled_events ?? body.enabledEvents;
  if (rawEvents !== undefined) {
    if (!Array.isArray(rawEvents)) {
      return NextResponse.json({ error: 'enabled_events must be array' }, { status: 400 });
    }
    const invalid = (rawEvents as string[]).filter((e) => !VALID_EVENTS.includes(e as CustomerEventType));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Unknown events: ${invalid.join(', ')}` }, { status: 400 });
    }
  }

  const patch: Parameters<typeof upsertNotificationConfig>[1] = {};

  if (body.is_enabled   !== undefined) patch.isEnabled    = Boolean(body.is_enabled);
  if (body.isEnabled    !== undefined) patch.isEnabled    = Boolean(body.isEnabled);
  if (body.webhook_url  !== undefined) patch.webhookUrl   = (body.webhook_url as string | null);
  if (body.webhookUrl   !== undefined) patch.webhookUrl   = (body.webhookUrl as string | null);
  if (body.webhook_secret !== undefined) patch.webhookSecret = (body.webhook_secret as string | null);
  if (body.webhookSecret  !== undefined) patch.webhookSecret = (body.webhookSecret as string | null);
  if (rawEvents !== undefined) patch.enabledEvents = rawEvents as CustomerEventType[];
  if (body.message_prefix !== undefined) patch.messagePrefix = (body.message_prefix as string | null);
  if (body.messagePrefix  !== undefined) patch.messagePrefix = (body.messagePrefix as string | null);
  if (body.max_per_order !== undefined) patch.maxPerOrder = Number(body.max_per_order);
  if (body.maxPerOrder   !== undefined) patch.maxPerOrder = Number(body.maxPerOrder);
  if (body.timeout_ms    !== undefined) patch.timeoutMs   = Math.min(Number(body.timeout_ms), 15_000);
  if (body.timeoutMs     !== undefined) patch.timeoutMs   = Math.min(Number(body.timeoutMs), 15_000);

  const updated = await upsertNotificationConfig(locationId, patch);
  if (!updated) return NextResponse.json({ error: 'Save failed' }, { status: 500 });

  return NextResponse.json({ config: updated });
}
