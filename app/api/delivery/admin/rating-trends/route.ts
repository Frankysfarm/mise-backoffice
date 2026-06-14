/**
 * GET /api/delivery/admin/rating-trends
 *   ?location_id=...&weeks=12&granularity=week|month
 *
 * Aggregiert Kunden-Bewertungen über mehrere Wochen/Monate.
 * Nutzt customer_ratings (Migration 022) + Fallback auf dispatch_scores.
 *
 * Response:
 * {
 *   buckets: { label, from, to, avgRating, count, pct5, pct4, pct3, pct2, pct1 }[]
 *   overall: { avgRating, totalRatings, trend }
 *   byDriver: { driverId, driverName, avgRating, count, trend }[]
 *   byZone:   { zone, avgRating, count }[]
 *   _fallback?: boolean
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RatingRow {
  rating: number;
  created_at: string;
  driver_id: string | null;
  zone: string | null;
  driver_name: string | null;
}

interface Bucket {
  label: string;
  from: string;
  to: string;
  avgRating: number;
  count: number;
  pct5: number;
  pct4: number;
  pct3: number;
  pct2: number;
  pct1: number;
}

interface DriverStat {
  driverId: string;
  driverName: string | null;
  avgRating: number;
  count: number;
  trend: number;
}

interface ZoneStat {
  zone: string;
  avgRating: number;
  count: number;
}

function bucketLabel(date: Date, granularity: 'week' | 'month'): string {
  if (granularity === 'month') {
    return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }
  const kw = isoWeek(date);
  return `KW ${kw}`;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addWeeks(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 7 * 86400000);
}

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function buildBuckets(granularity: 'week' | 'month', count: number): { from: Date; to: Date; label: string }[] {
  const buckets: { from: Date; to: Date; label: string }[] = [];
  const now = new Date();

  if (granularity === 'week') {
    const weekStart = startOfWeek(now);
    for (let i = count - 1; i >= 0; i--) {
      const from = addWeeks(weekStart, -i);
      const to = addWeeks(from, 1);
      buckets.push({ from, to, label: bucketLabel(from, 'week') });
    }
  } else {
    const monthStart = startOfMonth(now);
    for (let i = count - 1; i >= 0; i--) {
      const from = addMonths(monthStart, -i);
      const to = addMonths(from, 1);
      buckets.push({ from, to, label: bucketLabel(from, 'month') });
    }
  }
  return buckets;
}

function pctOf(arr: number[], target: number): number {
  if (!arr.length) return 0;
  return Math.round((arr.filter(r => r === target).length / arr.length) * 100);
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const granularity = (searchParams.get('granularity') ?? 'week') as 'week' | 'month';
  const count = Math.min(24, Math.max(4, Number(searchParams.get('weeks') ?? '12')));

  const svc = createServiceClient();

  const buckets = buildBuckets(granularity, count);
  const since = buckets[0].from.toISOString();

  // Bewertungen laden (customer_ratings bevorzugt, Fallback auf dispatch_scores)
  let rows: RatingRow[] = [];
  let fallback = false;

  const { data: ratings, error: ratErr } = await svc
    .from('customer_ratings')
    .select(`
      rating, created_at,
      driver_id,
      customer_orders(delivery_zone)
    `)
    .eq('location_id', locationId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(10000);

  if (!ratErr && ratings && ratings.length > 0) {
    rows = ratings.map((r) => {
      const order = Array.isArray(r.customer_orders) ? r.customer_orders[0] : r.customer_orders;
      return {
        rating: Number(r.rating),
        created_at: r.created_at as string,
        driver_id: (r.driver_id as string | null) ?? null,
        zone: (order as { delivery_zone?: string | null } | null)?.delivery_zone ?? null,
        driver_name: null,
      };
    });
  } else {
    // Fallback: dispatch_scores hat score (0-100) → normalisiere auf 1-5
    fallback = true;
    const { data: scores } = await svc
      .from('dispatch_scores')
      .select('score, created_at, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', since)
      .limit(10000);

    rows = (scores ?? []).map((s) => ({
      rating: Math.round(1 + (Number(s.score) / 100) * 4),
      created_at: s.created_at as string,
      driver_id: (s.driver_id as string | null) ?? null,
      zone: null,
      driver_name: null,
    }));
  }

  // Fahrernamen nachladen
  const driverIds = [...new Set(rows.map(r => r.driver_id).filter(Boolean))] as string[];
  if (driverIds.length > 0) {
    const { data: drivers } = await svc
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = new Map<string, string>();
    for (const d of drivers ?? []) nameMap.set(d.id as string, d.name as string);
    rows = rows.map(r => ({ ...r, driver_name: r.driver_id ? (nameMap.get(r.driver_id) ?? null) : null }));
  }

  // Buckets befüllen
  const result: Bucket[] = buckets.map(({ from, to, label }) => {
    const inBucket = rows.filter(r => {
      const ts = new Date(r.created_at).getTime();
      return ts >= from.getTime() && ts < to.getTime();
    });
    const ratings = inBucket.map(r => r.rating);
    return {
      label,
      from: from.toISOString(),
      to: to.toISOString(),
      avgRating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 0,
      count: ratings.length,
      pct5: pctOf(ratings, 5),
      pct4: pctOf(ratings, 4),
      pct3: pctOf(ratings, 3),
      pct2: pctOf(ratings, 2),
      pct1: pctOf(ratings, 1),
    };
  });

  // Overall
  const allRatings = rows.map(r => r.rating);
  const overallAvg = allRatings.length
    ? Math.round((allRatings.reduce((s, r) => s + r, 0) / allRatings.length) * 100) / 100
    : 0;

  // Trend: letzter Bucket vs. vorletzter
  const lastFull = result.filter(b => b.count > 0);
  const trend =
    lastFull.length >= 2
      ? Math.round((lastFull[lastFull.length - 1].avgRating - lastFull[lastFull.length - 2].avgRating) * 100) / 100
      : 0;

  // Pro Fahrer
  const driverMap = new Map<string, { name: string | null; ratings: number[] }>();
  for (const r of rows) {
    if (!r.driver_id) continue;
    if (!driverMap.has(r.driver_id)) driverMap.set(r.driver_id, { name: r.driver_name, ratings: [] });
    driverMap.get(r.driver_id)!.ratings.push(r.rating);
  }

  const halfLen = Math.floor(rows.length / 2);
  const firstHalf = rows.slice(0, halfLen);
  const secondHalf = rows.slice(halfLen);

  const byDriver: DriverStat[] = [...driverMap.entries()]
    .map(([driverId, { name, ratings: dRatings }]) => {
      const avg = dRatings.reduce((s, r) => s + r, 0) / dRatings.length;

      const early = firstHalf.filter(r => r.driver_id === driverId).map(r => r.rating);
      const late = secondHalf.filter(r => r.driver_id === driverId).map(r => r.rating);
      const earlyAvg = early.length ? early.reduce((s, r) => s + r, 0) / early.length : avg;
      const lateAvg = late.length ? late.reduce((s, r) => s + r, 0) / late.length : avg;

      return {
        driverId,
        driverName: name,
        avgRating: Math.round(avg * 100) / 100,
        count: dRatings.length,
        trend: Math.round((lateAvg - earlyAvg) * 100) / 100,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Pro Zone
  const zoneMap = new Map<string, number[]>();
  for (const r of rows) {
    const z = r.zone ?? 'Unbekannt';
    if (!zoneMap.has(z)) zoneMap.set(z, []);
    zoneMap.get(z)!.push(r.rating);
  }

  const byZone: ZoneStat[] = [...zoneMap.entries()]
    .map(([zone, zRatings]) => ({
      zone,
      avgRating: Math.round((zRatings.reduce((s, r) => s + r, 0) / zRatings.length) * 100) / 100,
      count: zRatings.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    buckets: result,
    overall: { avgRating: overallAvg, totalRatings: allRatings.length, trend },
    byDriver,
    byZone,
    granularity,
    _fallback: fallback || undefined,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
