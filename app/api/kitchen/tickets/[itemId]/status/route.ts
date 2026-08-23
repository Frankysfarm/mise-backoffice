import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isKitchenTargetStatus, kitchenTransitionError } from '@/lib/kitchen/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdvanceRow = { ticket_id: string; item_status: string; ticket_status: string; order_status: string; was_changed: boolean };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return json({ error: 'Origin nicht erlaubt' }, 403);
  const { itemId } = await params;
  const body = await req.json().catch(() => null);
  const target = body?.status;
  const idempotencyKey = String(req.headers.get('idempotency-key') ?? body?.idempotencyKey ?? '').trim();
  if (!UUID_RE.test(itemId) || !UUID_RE.test(idempotencyKey) || !isKitchenTargetStatus(target)) {
    return json({ error: 'Ungültige Küchenstatus-Anfrage' }, 400);
  }

  const svc = createServiceClient();
  let tenantId: string | null = null;
  let locationId: string | null = null;
  let stationId: string | null = null;
  let actorId: string | null = null;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (user) {
    const { data: employee } = await svc.from('employees').select('id,tenant_id,location_id,rolle,aktiv')
      .eq('auth_user_id', user.id).eq('aktiv', true).maybeSingle();
    if (!employee || !['mitarbeiter', 'teamleiter', 'manager', 'backoffice', 'admin', 'server', 'bartender', 'cook'].includes(employee.rolle)) {
      return json({ error: 'Kein Küchenzugriff' }, 403);
    }
    const { data: item } = await svc.from('kitchen_ticket_items').select('tenant_id,location_id,station_id')
      .eq('order_item_id', itemId).maybeSingle();
    if (!item || item.tenant_id !== employee.tenant_id || item.location_id !== employee.location_id || !item.station_id) {
      return json({ error: 'Küchenposition nicht gefunden' }, 404);
    }
    tenantId = item.tenant_id; locationId = item.location_id; stationId = item.station_id; actorId = employee.id;
  } else {
    const token = String(body?.token ?? '').trim();
    if (!token || token.length > 200) return json({ error: 'Nicht autorisiert' }, 401);
    const { data: station } = await svc.from('kitchen_stations').select('id,tenant_id,location_id')
      .eq('display_token', token).eq('aktiv', true).maybeSingle();
    if (station) {
      stationId = station.id; tenantId = station.tenant_id; locationId = station.location_id;
    } else {
      const { data: device } = await svc.from('kitchen_display_devices').select('station_id,tenant_id,aktiv')
        .eq('device_token', token).eq('aktiv', true).maybeSingle();
      if (device) {
        const { data: deviceStation } = await svc.from('kitchen_stations').select('id,tenant_id,location_id')
          .eq('id', device.station_id).eq('tenant_id', device.tenant_id).eq('aktiv', true).maybeSingle();
        if (deviceStation) { stationId = deviceStation.id; tenantId = deviceStation.tenant_id; locationId = deviceStation.location_id; }
      }
    }
    if (!tenantId || !locationId || !stationId) return json({ error: 'Nicht autorisiert' }, 401);
  }

  const { data: ticketItem } = await svc.from('kitchen_ticket_items').select('id')
    .eq('order_item_id', itemId).eq('tenant_id', tenantId).eq('location_id', locationId).eq('station_id', stationId).maybeSingle();
  if (!ticketItem) return json({ error: 'Küchenposition nicht gefunden' }, 404);
  const { data, error } = await svc.rpc('advance_kitchen_ticket_item_atomic', {
    p_tenant_id: tenantId, p_location_id: locationId, p_ticket_item_id: ticketItem.id,
    p_station_id: stationId, p_actor_employee_id: actorId, p_target_status: target,
    p_idempotency_key: idempotencyKey,
  });
  const result = (Array.isArray(data) ? data[0] : data) as AdvanceRow | null;
  if (error || !result) { const mapped = kitchenTransitionError(error); return json({ error: mapped.error }, mapped.status); }
  return NextResponse.json({ ok: true, ...result }, { headers: PRIVATE_HEADERS });
}

function json(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}
