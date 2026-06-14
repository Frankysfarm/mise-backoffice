/**
 * GET  /api/delivery/admin/menu-availability?location_id=...
 *        → Dashboard: alle Artikel + Status + Ereignisse
 *        ?action=items  → nur Artikel-Liste
 *        ?action=events → nur Ereignis-Log
 *
 * POST /api/delivery/admin/menu-availability
 * Body: { location_id, action, ...params }
 *   action=add_item     { item_name, auto_disable_enabled?, queue_depth_threshold? }
 *   action=remove_item  { item_name }
 *   action=disable      { item_name, duration_min?, reason, disabled_by }
 *   action=restore      { item_name, restored_by }
 *   action=evaluate     — manuell auto-evaluate auslösen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getManagedItems,
  getRecentEvents,
  addManagedItem,
  removeManagedItem,
  disableItem,
  restoreItem,
  evaluateAutoDisable,
} from '@/lib/delivery/menu-availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromParam = new URL(req.url).searchParams.get('location_id');
  if (fromParam) return fromParam;

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
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = new URL(req.url).searchParams.get('action');

  if (action === 'items') {
    const items = await getManagedItems(locationId);
    return NextResponse.json({ items });
  }
  if (action === 'events') {
    const events = await getRecentEvents(locationId, 50);
    return NextResponse.json({ events });
  }

  const dashboard = await getDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const locationId = (body.location_id as string) ?? (await resolveLocationId(req));
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = body.action as string;

  try {
    switch (action) {
      case 'add_item': {
        const item = await addManagedItem(locationId, {
          itemName:             (body.item_name as string) ?? '',
          autoDisableEnabled:   body.auto_disable_enabled !== false,
          queueDepthThreshold:  typeof body.queue_depth_threshold === 'number'
                                  ? body.queue_depth_threshold : 8,
        });
        return NextResponse.json({ ok: true, item });
      }

      case 'remove_item': {
        const itemName = body.item_name as string;
        if (!itemName) return NextResponse.json({ error: 'item_name fehlt' }, { status: 400 });
        await removeManagedItem(locationId, itemName);
        return NextResponse.json({ ok: true });
      }

      case 'disable': {
        const itemName = body.item_name as string;
        if (!itemName) return NextResponse.json({ error: 'item_name fehlt' }, { status: 400 });
        await disableItem(
          locationId,
          itemName,
          typeof body.duration_min === 'number' ? body.duration_min : null,
          (body.reason as string) ?? 'Manuell deaktiviert',
          (body.disabled_by as string) ?? user.email ?? 'admin',
        );
        return NextResponse.json({ ok: true });
      }

      case 'restore': {
        const itemName = body.item_name as string;
        if (!itemName) return NextResponse.json({ error: 'item_name fehlt' }, { status: 400 });
        await restoreItem(
          locationId,
          itemName,
          (body.restored_by as string) ?? user.email ?? 'admin',
          false,
        );
        return NextResponse.json({ ok: true });
      }

      case 'evaluate': {
        const result = await evaluateAutoDisable(locationId);
        return NextResponse.json({ ok: true, result });
      }

      default:
        return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Interner Fehler' },
      { status: 500 },
    );
  }
}
