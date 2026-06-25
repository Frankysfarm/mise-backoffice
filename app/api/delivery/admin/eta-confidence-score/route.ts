/**
 * GET /api/delivery/admin/eta-confidence-score?location_id=...
 *
 * ETA-Konfidenz-Score je aktiver Tour (0–100).
 * Faktoren:
 *   1. Küchenlast   (20 Punkte): Verhältnis offene Bestellungen zu Kapazität
 *   2. GPS-Frische  (25 Punkte): Letztes GPS-Event je Fahrer (< 2 Min = voll)
 *   3. Zonen-Pünktlichkeit (25 Punkte): Historische SLA-Einhaltung der Zone (30 Tage)
 *   4. Verbleibende Stopps (30 Punkte): Je mehr Stopps, desto unsicherer
 *
 * Response:
 *   { ok, tours: TourEtaConfidence[] }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourEtaConfidence {
  batchId: string;
  zone: string | null;
  driverName: string | null;
  confidence: number;
  confidenceLabel: 'sehr-hoch' | 'hoch' | 'mittel' | 'niedrig' | 'unbekannt';
  remainingStops: number;
  totalStops: number;
  gpsAgeMin: number | null;
  zonePunctualityPct: number | null;
  factors: {
    kuechenScore: number;
    gpsScore: number;
    zonenScore: number;
    stopsScore: number;
  };
}

function toLabel(score: number): TourEtaConfidence['confidenceLabel'] {
  if (score >= 85) return 'sehr-hoch';
  if (score >= 70) return 'hoch';
  if (score >= 50) return 'mittel';
  if (score >= 25) return 'niedrig';
  return 'unbekannt';
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

  const ssb = createServiceClient();
  const now = new Date();

  // Active batches
  const ACTIVE_STATES = ['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance'];
  const { data: batches } = await ssb
    .from('mise_delivery_batches')
    .select('id, zone, assigned_driver_id, created_at, estimated_duration_min, driver:mise_drivers!assigned_driver_id(name)')
    .eq('location_id', locationId)
    .in('status', ACTIVE_STATES);

  if (!batches || batches.length === 0) {
    return NextResponse.json({ ok: true, tours: [] });
  }

  const batchIds = batches.map((b) => b.id);
  const driverIds = batches
    .map((b) => b.assigned_driver_id)
    .filter((id): id is string => !!id);

  // Stops per batch
  const { data: stops } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id, status')
    .in('batch_id', batchIds);

  // Kitchen load: open orders in prep
  const { count: openKitchenCount } = await ssb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['bestätigt', 'zubereitung', 'bereit']);

  // GPS freshness per driver
  const { data: gpsEvents } = await ssb
    .from('driver_gps_events')
    .select('driver_id, created_at')
    .in('driver_id', driverIds)
    .order('created_at', { ascending: false });

  const lastGps = new Map<string, Date>();
  for (const ev of gpsEvents ?? []) {
    if (!lastGps.has(ev.driver_id)) {
      lastGps.set(ev.driver_id, new Date(ev.created_at));
    }
  }

  // Zone punctuality last 30 days
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();
  const zones = [...new Set(batches.map((b) => b.zone).filter(Boolean))] as string[];
  const zonePunctMap = new Map<string, number>();

  if (zones.length > 0) {
    const { data: zoneOrders } = await ssb
      .from('customer_orders')
      .select('delivery_zone, delivered_at, promised_delivery_at')
      .eq('location_id', locationId)
      .eq('status', 'geliefert')
      .in('delivery_zone', zones)
      .gte('created_at', since30d);

    for (const z of zones) {
      const zOrders = (zoneOrders ?? []).filter((o) => o.delivery_zone === z);
      if (zOrders.length === 0) continue;
      const onTime = zOrders.filter((o) => {
        if (!o.delivered_at || !o.promised_delivery_at) return false;
        return new Date(o.delivered_at) <= new Date(o.promised_delivery_at);
      }).length;
      zonePunctMap.set(z, Math.round((onTime / zOrders.length) * 100));
    }
  }

  // Kitchen load score (20 pts): fewer pending = better
  const kitchenLoad = openKitchenCount ?? 0;
  const kuechenScore = kitchenLoad <= 2 ? 20 : kitchenLoad <= 5 ? 14 : kitchenLoad <= 10 ? 8 : 3;

  const tours: TourEtaConfidence[] = batches.map((batch) => {
    const driver = batch.driver as { name: string | null } | null;
    const driverName = driver?.name ?? null;
    const batchStops = (stops ?? []).filter((s) => s.batch_id === batch.id);
    const remaining = batchStops.filter((s) => s.status !== 'delivered' && s.status !== 'geliefert' && s.status !== 'failed').length;
    const total = batchStops.length;

    // GPS score (25 pts)
    let gpsScore = 5;
    let gpsAgeMin: number | null = null;
    if (batch.assigned_driver_id && lastGps.has(batch.assigned_driver_id)) {
      gpsAgeMin = Math.round((now.getTime() - lastGps.get(batch.assigned_driver_id)!.getTime()) / 60_000);
      gpsScore = gpsAgeMin <= 1 ? 25 : gpsAgeMin <= 3 ? 20 : gpsAgeMin <= 7 ? 12 : gpsAgeMin <= 15 ? 6 : 2;
    }

    // Zone score (25 pts)
    const zonePunct = batch.zone ? (zonePunctMap.get(batch.zone) ?? null) : null;
    const zonenScore = zonePunct === null ? 12
      : zonePunct >= 90 ? 25 : zonePunct >= 80 ? 20 : zonePunct >= 70 ? 14 : zonePunct >= 60 ? 8 : 3;

    // Stops score (30 pts): fewer remaining = more confident
    const stopsScore = remaining === 0 ? 30
      : remaining === 1 ? 28 : remaining === 2 ? 22 : remaining === 3 ? 15 : remaining <= 5 ? 8 : 3;

    const confidence = Math.min(100, kuechenScore + gpsScore + zonenScore + stopsScore);

    return {
      batchId: batch.id,
      zone: batch.zone ?? null,
      driverName,
      confidence,
      confidenceLabel: toLabel(confidence),
      remainingStops: remaining,
      totalStops: total,
      gpsAgeMin,
      zonePunctualityPct: zonePunct,
      factors: { kuechenScore, gpsScore, zonenScore, stopsScore },
    };
  });

  return NextResponse.json({ ok: true, tours });
}
