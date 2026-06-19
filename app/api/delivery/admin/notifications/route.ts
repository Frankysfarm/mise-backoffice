/**
 * GET+POST /api/delivery/admin/notifications
 *
 * Delivery Admin Notification Center — Phase 254
 *
 * GET  ?action=list      → aktive Notifications + Summary
 * GET  ?action=summary   → nur Summary-Zahlen (für Badge)
 * POST action=mark_read  → einzelne Notification als gelesen markieren
 * POST action=dismiss    → einzelne Notification verwerfen
 * POST action=dismiss_all → alle Notifications verwerfen
 * POST action=scan       → manuellen Scan auslösen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getActiveNotifications,
  getNotificationSummary,
  markNotificationRead,
  dismissNotification,
  dismissAllNotifications,
  scanNotificationsForLocation,
} from '@/lib/delivery/notification-center';

export const dynamic = 'force-dynamic';

async function getLocationId(sb: Awaited<ReturnType<typeof createClient>>, overrideId?: string): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (overrideId) {
    const { data: emp } = await sb
      .from('employees')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    if (emp?.tenant_id === overrideId) return overrideId;
    return null;
  }

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id, location_id')
    .eq('id', user.id)
    .maybeSingle();

  return emp?.tenant_id ?? emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const overrideLocation = searchParams.get('location_id') ?? undefined;

    const locationId = await getLocationId(sb, overrideLocation);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'summary') {
      const summary = await getNotificationSummary(locationId);
      return NextResponse.json({ summary: summary ?? { totalActive: 0, totalUnread: 0, criticalCount: 0, warningCount: 0 } });
    }

    // action=list (default)
    const [notifications, summary] = await Promise.all([
      getActiveNotifications(locationId),
      getNotificationSummary(locationId),
    ]);

    return NextResponse.json({ notifications, summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as string;

    const overrideLocation = (body.location_id as string) ?? undefined;
    const locationId = await getLocationId(sb, overrideLocation);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'mark_read') {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      await markNotificationRead(id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'dismiss') {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      await dismissNotification(id, user.id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'dismiss_all') {
      const result = await dismissAllNotifications(locationId, user.id);
      return NextResponse.json(result);
    }

    if (action === 'scan') {
      const result = await scanNotificationsForLocation(locationId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
