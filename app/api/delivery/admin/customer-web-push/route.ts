/**
 * GET  /api/delivery/admin/customer-web-push
 *   ?action=dashboard
 *   → Dashboard: config + stats + recentLog + subscriptions + vapidConfigured
 *
 * POST /api/delivery/admin/customer-web-push
 *   action=save_config   → { enabled?, eventsEnabled?, dailyLimitPerSub? }
 *   action=broadcast     → { title, body, url?, limit? }
 *   action=prune_logs    → bereinigt alte Log-Einträge
 *   action=prune_subs    → bereinigt inaktive Subscriptions
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getCustomerPushDashboard,
  upsertCustomerPushConfig,
  broadcastToLocation,
  pruneCustomerPushLogs,
  pruneInactiveSubscriptions,
} from '@/lib/delivery/customer-web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return (data as { location_id?: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const url = new URL(req.url);
  const override = url.searchParams.get('location_id');
  const lid = override ?? locationId;

  const dashboard = await getCustomerPushDashboard(lid).catch(() => null);
  if (!dashboard) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });

  return NextResponse.json(dashboard, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body as { action: string };

  if (action === 'save_config') {
    const { enabled, eventsEnabled, dailyLimitPerSub } = body as {
      enabled?:          boolean;
      eventsEnabled?:    string[];
      dailyLimitPerSub?: number;
    };
    const updated = await upsertCustomerPushConfig(locationId, { enabled, eventsEnabled: eventsEnabled as never, dailyLimitPerSub });
    return NextResponse.json({ ok: true, config: updated });
  }

  if (action === 'broadcast') {
    const { title, body: msgBody, url: msgUrl, limit } = body as {
      title:  string;
      body:   string;
      url?:   string;
      limit?: number;
    };
    if (!title || !msgBody) return NextResponse.json({ error: 'title und body erforderlich' }, { status: 400 });
    const result = await broadcastToLocation(locationId, title, msgBody, msgUrl ?? '/', limit ?? 500);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune_logs') {
    const { days } = body as { days?: number };
    const deleted = await pruneCustomerPushLogs(days ?? 30);
    return NextResponse.json({ ok: true, deleted });
  }

  if (action === 'prune_subs') {
    const { days } = body as { days?: number };
    const deleted = await pruneInactiveSubscriptions(days ?? 90);
    return NextResponse.json({ ok: true, deleted });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
