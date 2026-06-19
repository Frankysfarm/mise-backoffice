/**
 * GET  /api/delivery/admin/restock-engine                  — Dashboard
 * GET  /api/delivery/admin/restock-engine?action=alerts    — Alle Alerts (inkl. resolved)
 * POST /api/delivery/admin/restock-engine action=update_stock
 * POST /api/delivery/admin/restock-engine action=seed_materials
 * POST /api/delivery/admin/restock-engine action=update_alert
 * POST /api/delivery/admin/restock-engine action=create_material
 * POST /api/delivery/admin/restock-engine action=deactivate_material
 * POST /api/delivery/admin/restock-engine action=prune
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDashboard,
  seedMaterials,
  updateStock,
  updateAlertStatus,
  createMaterial,
  deactivateMaterial,
  pruneOldMaterialSnapshots,
  type AlertStatus,
} from '@/lib/delivery/restock-engine';

export const dynamic = 'force-dynamic';

async function resolveContext(
  req: NextRequest,
): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return { locationId: qp, userId: user.id };

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getDashboard(ctx.locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  if (action === 'alerts') {
    const svc = createServiceClient();
    const days = Number(req.nextUrl.searchParams.get('days') ?? '30');
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: alerts } = await svc
      .from('restock_alerts')
      .select('*, delivery_materials(name)')
      .eq('location_id', ctx.locationId)
      .gte('triggered_at', since)
      .order('triggered_at', { ascending: false })
      .limit(100);

    return NextResponse.json({ ok: true, alerts: alerts ?? [] });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body as { action: string };

  if (action === 'seed_materials') {
    const result = await seedMaterials(ctx.locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'update_stock') {
    const { material_id, new_stock } = body as { material_id: string; new_stock: number };
    if (!material_id || typeof new_stock !== 'number' || new_stock < 0) {
      return NextResponse.json({ error: 'material_id und new_stock (≥0) erforderlich' }, { status: 400 });
    }
    const result = await updateStock(ctx.locationId, material_id, Math.round(new_stock), ctx.userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_alert') {
    const { alert_id, status, notes } = body as { alert_id: string; status: AlertStatus; notes?: string };
    if (!alert_id || !['open', 'ordered', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'alert_id und gültiger status erforderlich' }, { status: 400 });
    }
    const result = await updateAlertStatus(alert_id, ctx.locationId, status, notes);
    return NextResponse.json({ ok: result.ok });
  }

  if (action === 'create_material') {
    const {
      name, unit, category, current_stock, min_stock_level,
      reorder_qty, cost_per_unit, items_per_order,
      supplier_name, supplier_email, supplier_phone,
    } = body as Record<string, unknown>;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name erforderlich' }, { status: 400 });
    }

    const result = await createMaterial(ctx.locationId, {
      name:            name as string,
      unit:            (unit as string) ?? 'Stück',
      category:        (category as string) ?? 'packaging',
      current_stock:   Number(current_stock ?? 0),
      min_stock_level: Number(min_stock_level ?? 50),
      reorder_qty:     Number(reorder_qty ?? 200),
      cost_per_unit:   Number(cost_per_unit ?? 0),
      items_per_order: Number(items_per_order ?? 1),
      supplier_name:   (supplier_name as string | null) ?? null,
      supplier_email:  (supplier_email as string | null) ?? null,
      supplier_phone:  (supplier_phone as string | null) ?? null,
      last_restocked_at: null,
    } as Parameters<typeof createMaterial>[1]);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === 'deactivate_material') {
    const { material_id } = body as { material_id: string };
    if (!material_id) return NextResponse.json({ error: 'material_id erforderlich' }, { status: 400 });
    const result = await deactivateMaterial(material_id, ctx.locationId);
    return NextResponse.json({ ok: result.ok });
  }

  if (action === 'prune') {
    const days = Number((body as { days?: number }).days ?? 90);
    const result = await pruneOldMaterialSnapshots(days);
    return NextResponse.json({ ok: true, pruned: result.pruned });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
