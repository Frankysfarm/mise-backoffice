/**
 * GET /api/delivery/admin/order-wave-history?location_id=...
 *
 * 24h-Histogramm der stündlichen Bestellraten: heute vs. Ø letzte 7 Tage.
 * Phase 510
 *
 * Response: { ok, hours: HourBucket[], peakHourToday, peakHourAvg, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface HourBucket {
  hour: number;        // 0–23 UTC
  todayCount: number;
  avgCount: number;    // Ø letzte 7 Tage (gleiche Stunde)
  ratio: number;       // todayCount / max(1, avgCount)
}

export interface WaveHistoryResponse {
  ok: boolean;
  hours: HourBucket[];
  peakHourToday: number | null;
  peakHourAvg: number | null;
  totalToday: number;
  totalAvg: number;
  generatedAt: string;
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
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 3_600_000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 3_600_000);

  // Heute: alle nicht-stornierten Bestellungen
  const { data: todayOrders } = await ssb
    .from('customer_orders')
    .select('id, created_at')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', todayEnd.toISOString());

  // Letzte 7 Tage (ohne heute)
  const { data: historicOrders } = await ssb
    .from('customer_orders')
    .select('id, created_at')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', sevenDaysAgo.toISOString())
    .lt('created_at', todayStart.toISOString());

  // Bucket heute
  const todayBuckets = new Array<number>(24).fill(0);
  for (const o of todayOrders ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    todayBuckets[h]++;
  }

  // Bucket historisch: summiere je Stunde über 7 Tage → teile durch 7
  const histBuckets = new Array<number>(24).fill(0);
  for (const o of historicOrders ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    histBuckets[h]++;
  }
  const avgBuckets = histBuckets.map((c) => Math.round((c / 7) * 10) / 10);

  const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    todayCount: todayBuckets[h],
    avgCount: avgBuckets[h],
    ratio: avgBuckets[h] > 0 ? Math.round((todayBuckets[h] / avgBuckets[h]) * 100) / 100 : 0,
  }));

  const peakHourToday = todayBuckets.indexOf(Math.max(...todayBuckets));
  const peakHourAvg = avgBuckets.indexOf(Math.max(...avgBuckets));

  const totalToday = todayBuckets.reduce((a, b) => a + b, 0);
  const totalAvg = Math.round(avgBuckets.reduce((a, b) => a + b, 0) * 10) / 10;

  const response: WaveHistoryResponse = {
    ok: true,
    hours,
    peakHourToday: Math.max(...todayBuckets) > 0 ? peakHourToday : null,
    peakHourAvg: Math.max(...avgBuckets) > 0 ? peakHourAvg : null,
    totalToday,
    totalAvg,
    generatedAt: now.toISOString(),
  };

  return NextResponse.json(response);
}
