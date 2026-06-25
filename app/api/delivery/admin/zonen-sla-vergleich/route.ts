/**
 * GET /api/delivery/admin/zonen-sla-vergleich?location_id=...&days=7
 *
 * SLA-Einhaltung je Zone im Vergleich (Standard: letzte 7 Tage).
 * Klassifiziert je Zone: pünktlich / zu_spät / kritisch.
 *
 * Response:
 *   { ok, zones: ZoneSlaEntry[], generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZoneSlaEntry {
  zone: string;
  totalOrders: number;
  deliveredOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  slaPct: number;
  avgDeliveryMin: number | null;
  status: 'gut' | 'mittel' | 'kritisch';
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

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '7', 10)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();

  const ssb = createServiceClient();

  const { data: orders } = await ssb
    .from('customer_orders')
    .select('delivery_zone, status, created_at, delivered_at, promised_delivery_at')
    .eq('location_id', locationId)
    .gte('created_at', since)
    .not('delivery_zone', 'is', null);

  const allOrders = (orders ?? []).filter((o) => o.delivery_zone);

  // Group by zone
  const zoneMap = new Map<string, typeof allOrders>();
  for (const o of allOrders) {
    const z = o.delivery_zone as string;
    if (!zoneMap.has(z)) zoneMap.set(z, []);
    zoneMap.get(z)!.push(o);
  }

  const zones: ZoneSlaEntry[] = [];
  for (const [zone, zOrders] of zoneMap) {
    const delivered = zOrders.filter((o) => o.status === 'geliefert');
    const withPromise = delivered.filter((o) => !!o.delivered_at && !!o.promised_delivery_at);
    const onTime = withPromise.filter((o) => new Date(o.delivered_at!) <= new Date(o.promised_delivery_at!));
    const late = withPromise.length - onTime.length;

    const slaPct = withPromise.length > 0 ? Math.round((onTime.length / withPromise.length) * 100) : 0;

    const times = delivered
      .map((o) => {
        if (!o.delivered_at || !o.created_at) return null;
        return (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
      })
      .filter((t): t is number => t !== null && t > 0);
    const avgDeliveryMin = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null;

    const status: ZoneSlaEntry['status'] = slaPct >= 85 ? 'gut' : slaPct >= 70 ? 'mittel' : 'kritisch';

    zones.push({
      zone,
      totalOrders: zOrders.length,
      deliveredOrders: delivered.length,
      onTimeOrders: onTime.length,
      lateOrders: late,
      slaPct,
      avgDeliveryMin,
      status,
    });
  }

  zones.sort((a, b) => a.slaPct - b.slaPct);

  return NextResponse.json({ ok: true, zones, generatedAt: new Date().toISOString() });
}
