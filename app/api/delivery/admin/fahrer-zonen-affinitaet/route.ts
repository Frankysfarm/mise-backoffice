/**
 * GET /api/delivery/admin/fahrer-zonen-affinitaet
 *
 * Fahrer-Zonen-Affinität: Welche Fahrer liefern am besten in welche Zone?
 *
 * Erweitert die bestehende Zone-Affinity-Matrix (Pünktlichkeit + Vertrautheit)
 * um Kunden-Bewertungen (stars aus customer_delivery_ratings je Zone).
 *
 * Kombinierter Score (0–100):
 *   50% Affinitäts-Score  (aus driver_zone_stats via zone-affinity engine)
 *   30% Bewertungs-Score  (avg_stars / 5 × 30, 0 wenn keine Bewertungen)
 *   20% Pünktlichkeits-Bonus (on_time_count / total × 20)
 *
 * Empfehlung: Zone mit höchstem Combined-Score je Fahrer.
 *
 * Multi-Tenant: alle Queries filtern location_id.
 * Response: FahrerZonenAffinitaetRow[] + topDriverPerZone
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZoneName = 'A' | 'B' | 'C' | 'D';

interface ZoneScore {
  affinityScore: number;
  totalDeliveries: number;
  onTimeCount: number;
  avgStars: number | null;
  ratingCount: number;
  combinedScore: number;
}

export interface FahrerZonenAffinitaetRow {
  driverId: string;
  driverName: string;
  zones: Record<ZoneName, ZoneScore | null>;
  bestZone: ZoneName | null;
  totalDeliveries: number;
  lastDeliveryAt: string | null;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!emp?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', emp.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Load driver zone stats
  const { data: zoneStats } = await ssb
    .from('driver_zone_stats')
    .select('driver_id, zone_name, total_deliveries, on_time_count, avg_delivery_min, last_delivery_at')
    .eq('location_id', locationId)
    .order('total_deliveries', { ascending: false });

  if (!zoneStats || zoneStats.length === 0) {
    return NextResponse.json({ ok: true, rows: [], topDriverPerZone: { A: null, B: null, C: null, D: null } });
  }

  // Collect driver IDs
  const driverIds = [...new Set(zoneStats.map((r) => r.driver_id as string))];

  // Load driver names
  const { data: drivers } = await ssb
    .from('drivers')
    .select('id, name')
    .eq('location_id', locationId)
    .in('id', driverIds);

  const driverNameMap = new Map<string, string>();
  for (const d of drivers ?? []) {
    driverNameMap.set(d.id as string, (d.name as string) ?? 'Fahrer');
  }

  // Load customer ratings per driver, aggregated by delivery zone
  // customer_delivery_ratings → join customer_orders for zone
  const { data: ratings } = await ssb
    .from('customer_delivery_ratings')
    .select('driver_id, stars, order_id')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .not('driver_id', 'is', null);

  // Load zone info for rated orders
  const ratedOrderIds = [...new Set((ratings ?? []).map((r) => r.order_id as string))];
  let orderZoneMap = new Map<string, string>();
  if (ratedOrderIds.length > 0) {
    const { data: orders } = await ssb
      .from('customer_orders')
      .select('id, delivery_zone')
      .in('id', ratedOrderIds)
      .not('delivery_zone', 'is', null);
    for (const o of orders ?? []) {
      orderZoneMap.set(o.id as string, o.delivery_zone as string);
    }
  }

  // Aggregate ratings: driverId × zone → { sumStars, count }
  const ratingAgg = new Map<string, { sumStars: number; count: number }>();
  for (const r of ratings ?? []) {
    const zone = orderZoneMap.get(r.order_id as string);
    if (!zone) continue;
    const key = `${r.driver_id as string}|${zone}`;
    const cur = ratingAgg.get(key) ?? { sumStars: 0, count: 0 };
    cur.sumStars += Number(r.stars ?? 0);
    cur.count += 1;
    ratingAgg.set(key, cur);
  }

  // Compute affinity score: 60% familiarity + 40% punctuality (same formula as zone-affinity engine)
  function computeAffinity(total: number, onTime: number): number {
    const familiarity = Math.min(60, total * 3);
    const performance = total > 0 ? (onTime / total) * 40 : 0;
    return Math.round(familiarity + performance);
  }

  // Build per-driver per-zone data
  type DriverZoneMap = Record<ZoneName, ZoneScore | null>;
  const driverMap = new Map<string, { zones: DriverZoneMap; lastAt: string | null; totalDel: number }>();

  for (const row of zoneStats) {
    const dId = row.driver_id as string;
    const zone = row.zone_name as ZoneName;
    if (!['A', 'B', 'C', 'D'].includes(zone)) continue;

    if (!driverMap.has(dId)) {
      driverMap.set(dId, { zones: { A: null, B: null, C: null, D: null }, lastAt: null, totalDel: 0 });
    }
    const entry = driverMap.get(dId)!;

    const total = Number(row.total_deliveries ?? 0);
    const onTime = Number(row.on_time_count ?? 0);
    const affinity = computeAffinity(total, onTime);

    const rKey = `${dId}|${zone}`;
    const rData = ratingAgg.get(rKey);
    const avgStars = rData && rData.count > 0 ? rData.sumStars / rData.count : null;
    const ratingCount = rData?.count ?? 0;

    const ratingScore = avgStars != null ? (avgStars / 5) * 30 : 0;
    const punctScore = total > 0 ? (onTime / total) * 20 : 0;
    const combinedScore = Math.round(affinity * 0.5 + ratingScore + punctScore);

    entry.zones[zone] = { affinityScore: affinity, totalDeliveries: total, onTimeCount: onTime, avgStars, ratingCount, combinedScore };
    entry.totalDel += total;

    const lastAt = row.last_delivery_at as string | null;
    if (lastAt && (!entry.lastAt || lastAt > entry.lastAt)) {
      entry.lastAt = lastAt;
    }
  }

  // Build response rows + find best zone per driver
  const rows: FahrerZonenAffinitaetRow[] = [];
  for (const [dId, data] of driverMap) {
    let bestZone: ZoneName | null = null;
    let bestScore = -1;
    for (const z of ['A', 'B', 'C', 'D'] as ZoneName[]) {
      const s = data.zones[z]?.combinedScore ?? -1;
      if (s > bestScore) { bestScore = s; bestZone = z; }
    }
    rows.push({
      driverId: dId,
      driverName: driverNameMap.get(dId) ?? 'Fahrer',
      zones: data.zones,
      bestZone,
      totalDeliveries: data.totalDel,
      lastDeliveryAt: data.lastAt,
    });
  }

  rows.sort((a, b) => b.totalDeliveries - a.totalDeliveries);

  // Top driver per zone
  const topDriverPerZone: Record<ZoneName, { driverId: string; driverName: string; score: number } | null> = {
    A: null, B: null, C: null, D: null,
  };
  for (const z of ['A', 'B', 'C', 'D'] as ZoneName[]) {
    let best: FahrerZonenAffinitaetRow | null = null;
    let bestScore = -1;
    for (const row of rows) {
      const s = row.zones[z]?.combinedScore ?? -1;
      if (s > bestScore) { bestScore = s; best = row; }
    }
    if (best && bestScore >= 0) {
      topDriverPerZone[z] = { driverId: best.driverId, driverName: best.driverName, score: bestScore };
    }
  }

  return NextResponse.json({ ok: true, rows, topDriverPerZone, total: rows.length });
}
