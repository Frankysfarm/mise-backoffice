import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/driver/v1/orders/active
 *
 * Liefert die aktuelle aktive Tour des eingeloggten Drivers
 * (Batch + Stops + Order-Detail + Items für jeden Stop)
 * oder { active: null } wenn keine offene Tour.
 */
export async function GET(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  const c = sb();
  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select(
      'id,driver_id,state,total_distance_km,total_eta_min,reason_text,created_at,picked_up_at,polyline',
    )
    .eq('driver_id', m.driver.id)
    .not('state', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch) {
    return NextResponse.json({ ok: true, active: null });
  }

  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select(
      'id,batch_id,order_id,type,sequence,lat,lng,address,eta_min,arrived_at,completed_at,pick_verification,delivery_proof,issue_type,issue_detail',
    )
    .eq('batch_id', batch.id)
    .order('sequence', { ascending: true });

  // Order-IDs einsammeln (unique)
  const orderIds = [...new Set((stops ?? []).map((s) => s.order_id))];

  const { data: orders } = orderIds.length
    ? await c
        .from('customer_orders')
        .select(
          'id,bestellnummer,status,typ,kunde_name,kunde_telefon,kunde_adresse,kunde_plz,kunde_stadt,kunde_etage,kunde_lieferhinweis,gesamtbetrag,driver_payout,kunde_lat,kunde_lng,location_id',
        )
        .in('id', orderIds)
    : { data: [] };

  // Items pro Order
  const { data: items } = orderIds.length
    ? await c
        .from('order_items')
        .select('id,order_id,name,menge,einzelpreis,extras,notiz')
        .in('order_id', orderIds)
    : { data: [] };

  // Locations (für Restaurant-Name + Adresse beim Pickup-Stop)
  const locationIds = [...new Set((orders ?? []).map((o) => o.location_id))];
  const { data: locations } = locationIds.length
    ? await c
        .from('locations')
        .select('id,name,adresse,plz,stadt,telefon,tenant_id')
        .in('id', locationIds)
    : { data: [] };

  const tenantIds = [...new Set((locations ?? []).map((l) => l.tenant_id))];
  const { data: tenants } = tenantIds.length
    ? await c.from('tenants').select('id,name').in('id', tenantIds)
    : { data: [] };

  const ordersById = new Map((orders ?? []).map((o) => [o.id, o]));
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }
  const locationsById = new Map((locations ?? []).map((l) => [l.id, l]));
  const tenantsById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const enrichedStops = (stops ?? []).map((s) => {
    const order = ordersById.get(s.order_id);
    const loc = order ? locationsById.get(order.location_id) : null;
    const tenant = loc ? tenantsById.get(loc.tenant_id) : null;
    return {
      ...s,
      order: order
        ? {
            ...order,
            items: itemsByOrder.get(order.id) ?? [],
            restaurant_name: tenant?.name ?? loc?.name ?? null,
            restaurant_address: loc?.adresse ?? null,
            restaurant_phone: loc?.telefon ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({
    ok: true,
    active: {
      batch,
      stops: enrichedStops,
    },
  });
}
