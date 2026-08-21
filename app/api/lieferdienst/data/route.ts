import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/lieferdienst/data?location_id=... */
export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const requestedLocationId = req.nextUrl.searchParams.get('location_id');
  const locationId = actor.location_id ?? requestedLocationId;
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }
  if (actor.location_id && requestedLocationId && requestedLocationId !== actor.location_id) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 });
  }
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 });
  }

  const svc = createServiceClient();
  const operationalCutoff = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

  const [{ data: orders }, { data: driverLinks }, { data: menu }] = await Promise.all([
    svc.from('customer_orders')
      .select('id, bestellnummer, typ, status, kunde_name, kunde_telefon, kunde_adresse, kunde_plz, kunde_stadt, kunde_notiz, gesamtbetrag, bestellt_am, bestaetigt_am, zubereitung_start, fertig_am, fahrer_id, mise_driver_id, tisch_id, items:order_items(id, name, menge, einzelpreis, notiz, extras)')
      .eq('tenant_id', actor.tenant_id)
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
      .gte('bestellt_am', operationalCutoff)
      .order('bestellt_am', { ascending: false })
      .limit(100),
    svc.from('mise_driver_tenants')
      .select('driver:driver_id!inner(id, name, phone, state, active, vehicle, last_position_at)')
      .eq('tenant_id', actor.tenant_id)
      .eq('status', 'active'),
    svc.from('menu_items')
      .select('id, name, preis, beschreibung, allergene, category_id, verfuegbar, beliebt, ausverkauft_bis_schicht')
      .eq('location_id', locationId)
      .order('sort_order_in_category'),
  ]);

  const drivers = (driverLinks ?? [])
    .map((link: any) => link.driver)
    .filter((driver: any) => driver?.active);

  return NextResponse.json({
    orders: (orders ?? []).map(mapOrder),
    drivers: (drivers ?? []).map(mapDriver),
    menu: (menu ?? []).map(mapMenuItem),
  });
}

function mapOrder(o: any) {
  const STATUS_MAP: Record<string, string> = {
    'neu': 'pending',
    'bestätigt': 'accepted',
    'in_zubereitung': 'accepted',
    'fertig': 'done',
    'unterwegs': 'done',
    'storniert': 'rejected',
  };
  const TYPE_MAP: Record<string, string> = {
    'lieferung': 'delivery',
    'abholung': 'takeaway',
    'vor_ort': 'dine_in',
  };
  return {
    id: o.id,
    orderNumber: o.bestellnummer,
    type: TYPE_MAP[o.typ] || 'delivery',
    status: STATUS_MAP[o.status] || 'pending',
    createdAt: o.bestellt_am,
    acceptedAt: o.bestaetigt_am,
    customerName: o.kunde_name,
    customerPhone: o.kunde_telefon,
    customerAddress: o.kunde_adresse,
    customerPlz: o.kunde_plz,
    customerCity: o.kunde_stadt,
    customerNote: o.kunde_notiz,
    totalAmount: Number(o.gesamtbetrag),
    driverId: o.mise_driver_id ?? o.fahrer_id,
    tableId: o.tisch_id,
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      name: it.name,
      quantity: it.menge,
      price: Number(it.einzelpreis),
      notes: it.notiz,
      modifiers: Array.isArray(it.extras) ? it.extras.map((e: any) => e?.name).filter(Boolean) : [],
      category: 'main',
    })),
  };
}

function mapDriver(d: any) {
  const STATUS_MAP: Record<string, string> = {
    'available': 'available',
    'assigned': 'picking_up',
    'delivering': 'delivering',
    'offline': 'offline',
  };
  const VEHICLE_MAP: Record<string, string> = {
    'bike': 'bike',
    'scooter': 'scooter',
    'car': 'car',
  };
  return {
    id: d.id,
    name: d.name,
    phone: d.phone ?? '',
    status: STATUS_MAP[d.state] || 'offline',
    queuedOrders: 0,
    vehicleType: VEHICLE_MAP[d.vehicle] || 'bike',
  };
}

function mapMenuItem(m: any) {
  return {
    id: m.id,
    name: m.name,
    description: m.beschreibung ?? '',
    price: Number(m.preis),
    allergies: Array.isArray(m.allergene) ? m.allergene : [],
    categoryId: m.category_id,
    available: m.verfuegbar,
    popular: m.beliebt,
    soldOut: !!m.ausverkauft_bis_schicht,
  };
}
