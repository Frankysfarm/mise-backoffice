/**
 * GET /api/delivery/admin/zone-live-heatmap
 *   ?location_id=<uuid>
 *
 * Live-Dichte je Lieferzone (A/B/C/D):
 *   - Aktive Touren mit Stopps in dieser Zone
 *   - Offene Bestellungen letzte 2h
 *   - Ø Lieferzeit aus abgeschlossenen Bestellungen heute
 *   - HeatLevel: low / medium / high / critical
 *
 * Response: { zones: ZoneLiveRow[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type HeatLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ZoneLiveRow {
  zoneId:          string;
  zoneName:        string;
  zoneLabel:       string;
  activeTours:     number;
  pendingOrders:   number;
  avgDeliveryMin:  number | null;
  heatLevel:       HeatLevel;
  color:           string;
}

function calcHeatLevel(activeTours: number, pendingOrders: number): HeatLevel {
  const load = activeTours + pendingOrders * 0.5;
  if (load >= 8) return 'critical';
  if (load >= 5) return 'high';
  if (load >= 2) return 'medium';
  return 'low';
}

const ZONE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

const ZONE_LABELS: Record<string, string> = {
  A: 'Express',
  B: 'Standard',
  C: 'Weit',
  D: 'Außerhalb',
};

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const svc = createServiceClient();

  // Load zone configs for this location
  const { data: zoneRows } = await svc
    .from('delivery_zones')
    .select('id, name, label, color')
    .eq('location_id', locationId)
    .eq('active', true)
    .order('name', { ascending: true });

  type ZoneRow = { id: string; name: string; label: string; color: string | null };
  const zones: ZoneRow[] = zoneRows && zoneRows.length > 0
    ? (zoneRows as ZoneRow[])
    : (['A', 'B', 'C', 'D'] as const).map(n => ({
        id: n,
        name: n,
        label: ZONE_LABELS[n] ?? n,
        color: ZONE_COLORS[n] ?? '#888',
      }));

  // Now + 2h window
  const nowMs = Date.now();
  const twoHAgo = new Date(nowMs - 2 * 3_600_000).toISOString();
  const todayStart = new Date(nowMs);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartStr = todayStart.toISOString();

  // Active delivery batches: zones derived from customer_orders.delivery_zone
  const { data: activeBatches } = await svc
    .from('mise_delivery_batches')
    .select('id, zone')
    .eq('location_id', locationId)
    .in('state', ['on_route', 'at_restaurant', 'assigned', 'pending_acceptance']);

  type BatchRow = { id: string; zone: string | null };
  const batches = (activeBatches ?? []) as BatchRow[];

  // Count active tours per zone (batch.zone = 'A'/'B'/'C'/'D')
  const activeByZone = new Map<string, number>();
  for (const b of batches) {
    const z = b.zone ?? 'A';
    activeByZone.set(z, (activeByZone.get(z) ?? 0) + 1);
  }

  // Pending orders in last 2h per zone
  const { data: pendingRows } = await svc
    .from('customer_orders')
    .select('delivery_zone')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'bestätigt', 'fertig'])
    .gte('created_at', twoHAgo);

  type PendingRow = { delivery_zone: string | null };
  const pendingByZone = new Map<string, number>();
  for (const o of (pendingRows ?? []) as PendingRow[]) {
    const z = o.delivery_zone ?? 'A';
    pendingByZone.set(z, (pendingByZone.get(z) ?? 0) + 1);
  }

  // Avg delivery time today per zone (delivered orders)
  const { data: deliveredRows } = await svc
    .from('customer_orders')
    .select('delivery_zone, bestellt_am, geliefert_am')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .gte('bestellt_am', todayStartStr)
    .not('geliefert_am', 'is', null);

  type DeliveredRow = { delivery_zone: string | null; bestellt_am: string; geliefert_am: string };
  const deliveryTimesMap = new Map<string, number[]>();
  for (const o of (deliveredRows ?? []) as DeliveredRow[]) {
    if (!o.geliefert_am || !o.bestellt_am) continue;
    const diffMin = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
    if (diffMin <= 0 || diffMin > 180) continue;
    const z = o.delivery_zone ?? 'A';
    if (!deliveryTimesMap.has(z)) deliveryTimesMap.set(z, []);
    deliveryTimesMap.get(z)!.push(diffMin);
  }

  const result: ZoneLiveRow[] = zones.map(zone => {
    const activeTours   = activeByZone.get(zone.name) ?? 0;
    const pendingOrders = pendingByZone.get(zone.name) ?? 0;
    const times         = deliveryTimesMap.get(zone.name) ?? [];
    const avgDeliveryMin = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null;

    return {
      zoneId:         zone.id,
      zoneName:       zone.name,
      zoneLabel:      zone.label ?? ZONE_LABELS[zone.name] ?? zone.name,
      activeTours,
      pendingOrders,
      avgDeliveryMin,
      heatLevel:      calcHeatLevel(activeTours, pendingOrders),
      color:          zone.color ?? ZONE_COLORS[zone.name] ?? '#888',
    };
  });

  return NextResponse.json({ ok: true, zones: result, generatedAt: new Date().toISOString() });
}
