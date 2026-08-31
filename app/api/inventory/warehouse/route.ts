import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Bitte erneut anmelden.' }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.locationId !== 'string') return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400 });
  const service = createServiceClient();
  if (body.intent === 'save-place') {
    const { data, error } = await service.rpc('save_inventory_place_as_actor' as any, {
      p_id: typeof body.id === 'string' ? body.id : null,
      p_tenant_id: actor.tenant_id, p_location_id: body.locationId, p_actor_id: actor.id,
      p_area_id: body.areaId, p_parent_id: body.parentId || null, p_name: body.name,
      p_kind: body.kind, p_unit_type: body.unitType || null, p_description: body.description || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, place: data?.[0] });
  }
  if (body.intent === 'stock-action') {
    const { data, error } = await service.rpc('record_inventory_place_action_as_actor' as any, {
      p_tenant_id: actor.tenant_id, p_location_id: body.locationId, p_actor_id: actor.id,
      p_place_id: body.placeId, p_item_id: body.itemId, p_action: body.action,
      p_amount: body.amount, p_target_place_id: body.targetPlaceId || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, stock: data });
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
}
