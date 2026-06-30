/**
 * GET /api/delivery/admin/zonen-auslastung-realtime?location_id=...
 *
 * Phase 522 — Zonen-Auslastungs-Echtzeit-Monitor
 * Zeigt aktive Bestellungen und verfügbare Fahrer je Lieferzone.
 * Auslastungs-Ampel: grün / amber / rot.
 *
 * Response: { ok, zones: ZoneLoad[], summary: LoadSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type LoadLevel = 'ok' | 'busy' | 'overloaded';

export interface ZoneLoad {
  zone: string;
  activeOrders: number;
  pendingOrders: number;
  availableDrivers: number;
  assignedDrivers: number;
  loadLevel: LoadLevel;
  ratioOrdersPerDriver: number | null;
}

export interface LoadSummary {
  totalActiveOrders: number;
  totalPendingOrders: number;
  totalAvailableDrivers: number;
  overloadedZones: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function calcLoadLevel(orders: number, availDrivers: number): LoadLevel {
  if (availDrivers === 0 && orders > 0) return 'overloaded';
  if (availDrivers === 0) return 'ok';
  const ratio = orders / availDrivers;
  if (ratio > 3) return 'overloaded';
  if (ratio > 1.5) return 'busy';
  return 'ok';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - 4 * 3_600_000);

  // Aktive Bestellungen (nicht storniert, nicht geliefert) mit Zone
  const { data: orderRows } = await ssb
    .from('customer_orders')
    .select('id, status, delivery_zone')
    .eq('location_id', locationId)
    .not('status', 'in', '("storniert","cancelled","geliefert","delivered")')
    .gte('bestellt_am', since.toISOString());

  const orders = (orderRows ?? []) as { id: string; status: string; delivery_zone: string | null }[];

  const PENDING_STATUSES = ['neu', 'new', 'bestätigt', 'confirmed', 'offen', 'pending'];
  const ACTIVE_STATUSES  = ['in_zubereitung', 'preparing', 'fertig', 'ready', 'bereit',
                             'unterwegs', 'on_route', 'in_delivery'];

  // Aktive Fahrer-Batches: welche Fahrer sind aktuell welcher Zone zugewiesen
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, zone, status')
    .eq('location_id', locationId)
    .not('status', 'in', '("abgeschlossen","completed","abgebrochen","cancelled")');

  const batches = (batchRows ?? []) as { id: string; driver_id: string | null; zone: string | null; status: string }[];

  // Verfügbare Fahrer (online, kein aktiver Batch)
  const { data: driverRows } = await ssb
    .from('delivery_drivers')
    .select('id, preferred_zone')
    .eq('location_id', locationId)
    .eq('is_online', true);

  const drivers = (driverRows ?? []) as { id: string; preferred_zone: string | null }[];
  const busyDriverIds = new Set(batches.map((b) => b.driver_id).filter(Boolean) as string[]);

  // Alle Zonen sammeln
  const zoneSet = new Set<string>();
  orders.forEach((o) => { if (o.delivery_zone) zoneSet.add(o.delivery_zone); });
  batches.forEach((b) => { if (b.zone) zoneSet.add(b.zone); });
  drivers.forEach((d) => { if (d.preferred_zone) zoneSet.add(d.preferred_zone); });
  if (zoneSet.size === 0) zoneSet.add('A'); // Fallback

  const zones: ZoneLoad[] = Array.from(zoneSet).sort().map((zone) => {
    const activeOrders  = orders.filter((o) => o.delivery_zone === zone && ACTIVE_STATUSES.some((s) => o.status.includes(s))).length;
    const pendingOrders = orders.filter((o) => o.delivery_zone === zone && PENDING_STATUSES.some((s) => o.status.includes(s))).length;
    const assignedDrivers = batches.filter((b) => b.zone === zone).length;
    const availableDrivers = drivers.filter((d) => d.preferred_zone === zone && !busyDriverIds.has(d.id)).length;
    const totalOrders = activeOrders + pendingOrders;
    const ratioOrdersPerDriver = availableDrivers > 0 ? Math.round((totalOrders / availableDrivers) * 10) / 10 : null;
    const loadLevel = calcLoadLevel(totalOrders, availableDrivers + assignedDrivers);

    return { zone, activeOrders, pendingOrders, availableDrivers, assignedDrivers, loadLevel, ratioOrdersPerDriver };
  });

  const summary: LoadSummary = {
    totalActiveOrders:   orders.filter((o) => ACTIVE_STATUSES.some((s) => o.status.includes(s))).length,
    totalPendingOrders:  orders.filter((o) => PENDING_STATUSES.some((s) => o.status.includes(s))).length,
    totalAvailableDrivers: drivers.filter((d) => !busyDriverIds.has(d.id)).length,
    overloadedZones:     zones.filter((z) => z.loadLevel === 'overloaded').length,
  };

  return NextResponse.json({ ok: true, zones, summary, generatedAt: now.toISOString() });
}
