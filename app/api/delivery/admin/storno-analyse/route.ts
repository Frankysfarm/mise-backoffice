/**
 * GET /api/delivery/admin/storno-analyse?location_id=...&days=30
 *
 * Storno-Analyse-Engine: Stornierungsmuster aus den letzten N Tagen.
 * Phase 514
 *
 * Response: { ok, data: StornoAnalyseData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StornoHourBucket {
  hour: number;
  stornoCount: number;
  totalCount: number;
  stornoRate: number; // 0–100
}

export interface StornoZoneBucket {
  zone: string;
  stornoCount: number;
  totalCount: number;
  stornoRate: number;
}

export interface StornoAnalyseData {
  totalOrders: number;
  totalStornos: number;
  overallRate: number;
  peakStornoHour: number | null;
  worstZone: string | null;
  byHour: StornoHourBucket[];
  byZone: StornoZoneBucket[];
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

  const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') ?? '30', 10)));

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 3_600_000);

  const { data: orders } = await ssb
    .from('customer_orders')
    .select('id, status, created_at, delivery_zone')
    .eq('location_id', locationId)
    .gte('created_at', since.toISOString());

  const allOrders = orders ?? [];
  const stornos = allOrders.filter((o) => (o.status as string) === 'storniert');

  const totalOrders = allOrders.length;
  const totalStornos = stornos.length;
  const overallRate = totalOrders > 0 ? Math.round((totalStornos / totalOrders) * 1000) / 10 : 0;

  // By hour
  const hourTotal = new Array<number>(24).fill(0);
  const hourStorno = new Array<number>(24).fill(0);
  for (const o of allOrders) {
    const h = new Date(o.created_at as string).getUTCHours();
    hourTotal[h]++;
    if ((o.status as string) === 'storniert') hourStorno[h]++;
  }
  const byHour: StornoHourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    stornoCount: hourStorno[h],
    totalCount: hourTotal[h],
    stornoRate: hourTotal[h] > 0 ? Math.round((hourStorno[h] / hourTotal[h]) * 1000) / 10 : 0,
  }));

  // Peak storno hour (by rate, min 5 orders)
  const peakHourBucket = byHour
    .filter((b) => b.totalCount >= 5)
    .reduce<StornoHourBucket | null>((best, b) => (best === null || b.stornoRate > best.stornoRate ? b : best), null);

  // By zone
  const zoneMap = new Map<string, { total: number; storno: number }>();
  for (const o of allOrders) {
    const zone = (o.delivery_zone as string) ?? 'Unbekannt';
    const entry = zoneMap.get(zone) ?? { total: 0, storno: 0 };
    entry.total++;
    if ((o.status as string) === 'storniert') entry.storno++;
    zoneMap.set(zone, entry);
  }
  const byZone: StornoZoneBucket[] = Array.from(zoneMap.entries())
    .map(([zone, { total, storno }]) => ({
      zone,
      stornoCount: storno,
      totalCount: total,
      stornoRate: total > 0 ? Math.round((storno / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.stornoRate - a.stornoRate);

  const worstZone = byZone.find((z) => z.totalCount >= 5)?.zone ?? byZone[0]?.zone ?? null;

  const data: StornoAnalyseData = {
    totalOrders,
    totalStornos,
    overallRate,
    peakStornoHour: peakHourBucket?.hour ?? null,
    worstZone,
    byHour,
    byZone,
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
