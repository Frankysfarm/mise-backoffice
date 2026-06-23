/**
 * GET /api/delivery/admin/driver-score-summary
 *   ?driver_id=...&location_id=...
 *   Kombinierter Score-Überblick für einen einzelnen Fahrer:
 *   Pünktlichkeit + Kundenbewertung + GPS-Aktivität + Schicht-Engagement
 *
 *   ?location_id=...&action=all
 *   Score-Überblick für alle aktiven Fahrer einer Location
 *
 * Datenquellen:
 *   - mise_drivers (name, vehicle, state, rating)
 *   - customer_orders (gelieferte Bestellungen in letzten 30 Tagen für Pünktlichkeit)
 *   - driver_score_history (historische Scores wenn vorhanden)
 *   - driver_gps_events (GPS-Frische / letzte Aktivität)
 *
 * Response (single driver):
 *   { ok, driver, compositeScore, punctualityScore, ratingScore, gpsActivityScore,
 *     engagementScore, deliveriesLast30d, avgDeliveryMinLast30d, grade, trend }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DriverScoreSummaryEntry {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  state: string;
  compositeScore: number;
  punctualityScore: number;
  ratingScore: number;
  gpsActivityScore: number;
  engagementScore: number;
  deliveriesLast30d: number;
  avgDeliveryMin: number | null;
  lastActiveAt: string | null;
  grade: Grade;
  trend: 'up' | 'stable' | 'down';
}

function toGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
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

async function buildScoreSummary(
  ssb: Awaited<ReturnType<typeof createServiceClient>>,
  drivers: Array<{ id: string; name: string | null; vehicle: string | null; state: string; rating: number | null }>,
  locationId: string,
): Promise<DriverScoreSummaryEntry[]> {
  if (drivers.length === 0) return [];

  const driverIds = drivers.map((d) => d.id);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();

  // Delivered orders in last 30 days
  const { data: ordersData } = await ssb
    .from('customer_orders')
    .select('driver_id, created_at, delivered_at, promised_delivery_at')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .in('driver_id', driverIds)
    .gte('created_at', since30d);

  const ordersByDriver = new Map<string, Array<{
    created_at: string;
    delivered_at: string | null;
    promised_delivery_at: string | null;
  }>>();
  for (const o of ordersData ?? []) {
    const oid = o.driver_id as string;
    if (!ordersByDriver.has(oid)) ordersByDriver.set(oid, []);
    ordersByDriver.get(oid)!.push({
      created_at: o.created_at as string,
      delivered_at: o.delivered_at as string | null,
      promised_delivery_at: o.promised_delivery_at as string | null,
    });
  }

  // Latest GPS event per driver
  const { data: gpsData } = await ssb
    .from('driver_gps_events')
    .select('driver_id, created_at')
    .in('driver_id', driverIds)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  const latestGpsMap = new Map<string, string>();
  for (const g of gpsData ?? []) {
    const did = g.driver_id as string;
    if (!latestGpsMap.has(did)) latestGpsMap.set(did, g.created_at as string);
  }

  // Latest score history per driver (last 2 weeks trend)
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000).toISOString();
  const { data: historyData } = await ssb
    .from('driver_score_history')
    .select('driver_id, composite_score, week_start')
    .in('driver_id', driverIds)
    .gte('week_start', since14d)
    .order('week_start', { ascending: false });

  // Build trend map: latest 2 history entries per driver
  const historyByDriver = new Map<string, number[]>();
  for (const h of historyData ?? []) {
    const did = h.driver_id as string;
    if (!historyByDriver.has(did)) historyByDriver.set(did, []);
    const arr = historyByDriver.get(did)!;
    if (arr.length < 2) arr.push(Number(h.composite_score));
  }

  const nowMs = Date.now();

  return drivers.map((d) => {
    const orders = ordersByDriver.get(d.id) ?? [];
    const deliveriesLast30d = orders.length;

    // Pünktlichkeit: Anteil gelieferter Bestellungen die pünktlich waren
    const onTimeCount = orders.filter((o) => {
      if (!o.delivered_at || !o.promised_delivery_at) return false;
      return new Date(o.delivered_at) <= new Date(o.promised_delivery_at);
    }).length;
    const punctualityPct = deliveriesLast30d > 0 ? (onTimeCount / deliveriesLast30d) * 100 : 50;
    const punctualityScore = Math.round(Math.min(100, punctualityPct));

    // Lieferzeit-Durchschnitt
    const deliveryTimes = orders
      .filter((o) => o.delivered_at)
      .map((o) => Math.floor((new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60_000));
    const avgDeliveryMin = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((s, t) => s + t, 0) / deliveryTimes.length)
      : null;

    // Kundenbewertung: 0–5 → 0–100
    const rating = d.rating ?? 4.0;
    const ratingScore = Math.round(Math.min(100, (rating / 5) * 100));

    // GPS-Aktivität: wie frisch ist das letzte GPS-Signal (last 60 Min = 100%)
    const lastGpsAt = latestGpsMap.get(d.id) ?? null;
    let gpsActivityScore = 30; // Basis: unbekannt
    if (lastGpsAt) {
      const ageMin = (nowMs - new Date(lastGpsAt).getTime()) / 60_000;
      if (ageMin <= 5) gpsActivityScore = 100;
      else if (ageMin <= 15) gpsActivityScore = 85;
      else if (ageMin <= 30) gpsActivityScore = 65;
      else if (ageMin <= 60) gpsActivityScore = 40;
      else gpsActivityScore = 15;
    }
    if (d.state === 'offline') gpsActivityScore = Math.min(gpsActivityScore, 20);

    // Engagement-Score: basiert auf Lieferungen und Aktivitätsstatus
    let engagementScore = 50;
    if (deliveriesLast30d >= 60) engagementScore = 100;
    else if (deliveriesLast30d >= 40) engagementScore = 85;
    else if (deliveriesLast30d >= 20) engagementScore = 70;
    else if (deliveriesLast30d >= 10) engagementScore = 55;
    else engagementScore = 35;

    if (d.state === 'available') engagementScore = Math.min(100, engagementScore + 10);
    else if (d.state === 'offline') engagementScore = Math.max(0, engagementScore - 15);

    // Composite: gewichteter Schnitt
    const compositeScore = Math.round(
      punctualityScore * 0.35 +
      ratingScore * 0.30 +
      gpsActivityScore * 0.20 +
      engagementScore * 0.15,
    );

    // Trend aus History
    const history = historyByDriver.get(d.id) ?? [];
    let trend: 'up' | 'stable' | 'down' = 'stable';
    if (history.length >= 2) {
      const diff = history[0] - history[1];
      if (diff >= 5) trend = 'up';
      else if (diff <= -5) trend = 'down';
    }

    return {
      driverId: d.id,
      driverName: d.name ?? null,
      vehicle: d.vehicle ?? null,
      state: d.state ?? 'offline',
      compositeScore,
      punctualityScore,
      ratingScore,
      gpsActivityScore,
      engagementScore,
      deliveriesLast30d,
      avgDeliveryMin,
      lastActiveAt: lastGpsAt,
      grade: toGrade(compositeScore),
      trend,
    };
  });
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const driverId = searchParams.get('driver_id');
  const action = searchParams.get('action');

  const ssb = createServiceClient();

  if (action === 'all' || !driverId) {
    // All active drivers for this location
    const { data: driversData } = await ssb
      .from('mise_drivers')
      .select('id, name, vehicle, state, rating')
      .eq('location_id', locationId)
      .eq('active', true)
      .order('name', { ascending: true });

    const drivers = (driversData ?? []) as Array<{
      id: string;
      name: string | null;
      vehicle: string | null;
      state: string;
      rating: number | null;
    }>;

    const summaries = await buildScoreSummary(ssb, drivers, locationId);
    summaries.sort((a, b) => b.compositeScore - a.compositeScore);

    return NextResponse.json({
      ok: true,
      total: summaries.length,
      summaries,
      generatedAt: new Date().toISOString(),
    });
  }

  // Single driver
  const { data: driverData, error } = await ssb
    .from('mise_drivers')
    .select('id, name, vehicle, state, rating')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (error || !driverData) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  const driver = driverData as { id: string; name: string | null; vehicle: string | null; state: string; rating: number | null };
  const [summary] = await buildScoreSummary(ssb, [driver], locationId);

  return NextResponse.json({ ok: true, ...summary, generatedAt: new Date().toISOString() });
}
