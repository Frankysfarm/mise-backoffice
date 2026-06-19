/**
 * GET  /api/delivery/admin/item-demand?action=dashboard  — Dashboard
 * GET  /api/delivery/admin/item-demand?action=alerts     — Offene Alarme
 * GET  /api/delivery/admin/item-demand?action=profile&item=X  — Nachfrage-Profil
 * POST /api/delivery/admin/item-demand action=check      — Manuelle Lagerprüfung
 * POST /api/delivery/admin/item-demand action=upsert_stock — Lagerstand anlegen/updaten
 * POST /api/delivery/admin/item-demand action=mark_ordered — Alert als bestellt markieren
 * POST /api/delivery/admin/item-demand action=prune      — Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getItemDemandDashboard,
  checkAllItemStocks,
  computeItemDemandProfile,
  upsertItemStock,
  markAlertOrdered,
  pruneOldAlerts,
} from '@/lib/delivery/item-demand-prediction';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const dashboard = await getItemDemandDashboard(locationId);
      return NextResponse.json({ ok: true, dashboard });
    }

    if (action === 'alerts') {
      const sb = createServiceClient();
      const { data: alerts } = await sb
        .from('v_item_demand_alerts_open')
        .select('*')
        .eq('location_id', locationId);
      return NextResponse.json({ ok: true, alerts: alerts ?? [] });
    }

    if (action === 'profile') {
      const itemName = sp.get('item');
      if (!itemName) return NextResponse.json({ error: 'item erforderlich' }, { status: 400 });
      const days = sp.get('days') ? Number(sp.get('days')) : 28;
      const profile = await computeItemDemandProfile(locationId, itemName, days);
      return NextResponse.json({ ok: true, profile });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* leer */ }
  const action = (body.action as string | undefined) ?? '';

  try {
    if (action === 'check') {
      const result = await checkAllItemStocks(locationId);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'upsert_stock') {
      const item = body.item as {
        itemName: string;
        currentStock: number;
        unit?: string;
        minStockLevel?: number;
        reorderQty?: number;
        leadTimeDays?: number;
        costPerUnit?: number;
        supplierName?: string | null;
      } | undefined;
      if (!item?.itemName) {
        return NextResponse.json({ error: 'item.itemName erforderlich' }, { status: 400 });
      }
      const stock = await upsertItemStock(locationId, item);
      return NextResponse.json({ ok: true, stock });
    }

    if (action === 'mark_ordered') {
      const itemName = body.item_name as string | undefined;
      if (!itemName) return NextResponse.json({ error: 'item_name erforderlich' }, { status: 400 });
      const result = await markAlertOrdered(locationId, itemName);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const days = typeof body.days === 'number' ? body.days : 90;
      const result = await pruneOldAlerts(days);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
