/**
 * GET /api/delivery/admin/order-wave-detector?location_id=...
 *
 * Bestellungs-Wellenmuster-Erkennung: Erkennt Rush-Perioden in Echtzeit.
 * Vergleicht aktuelle Rate (letzte 30 Min) mit 7-Tage-Durchschnitt.
 * Alert wenn aktuelle Rate > 2× Durchschnitt.
 *
 * Response:
 *   { ok, data: WaveData, generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type WaveLevel = 'normal' | 'elevated' | 'rush' | 'extreme';

export interface WaveData {
  currentRatePerHour: number;
  avgRatePerHour: number;
  multiplier: number;
  level: WaveLevel;
  ordersLast30Min: number;
  peakHour: number | null;
  etaAbklingMin: number | null;
  alertMessage: string | null;
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
  const window30Min = new Date(now.getTime() - 30 * 60_000);
  const window7Days = new Date(now.getTime() - 7 * 24 * 3_600_000);

  // Current orders in last 30 min
  const { data: recentOrders, error: recentError } = await ssb
    .from('customer_orders')
    .select('id, created_at')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', window30Min.toISOString());

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 500 });
  }

  const ordersLast30Min = (recentOrders ?? []).length;
  const currentRatePerHour = ordersLast30Min * 2; // extrapolate 30min → 1h

  // Historical rate: same time window over last 7 days
  // For each of the last 7 days, count orders in the same 30-min window
  const historicalCounts: number[] = [];
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const dayStart = new Date(window30Min.getTime() - dayOffset * 24 * 3_600_000);
    const dayEnd = new Date(now.getTime() - dayOffset * 24 * 3_600_000);
    const { data: historicOrders } = await ssb
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .neq('status', 'storniert')
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());
    historicalCounts.push((historicOrders ?? []).length);
  }

  const avgLast30Min =
    historicalCounts.length > 0
      ? historicalCounts.reduce((s, v) => s + v, 0) / historicalCounts.length
      : 0;
  const avgRatePerHour = avgLast30Min * 2;

  const multiplier = avgRatePerHour > 0 ? Math.round((currentRatePerHour / avgRatePerHour) * 10) / 10 : 1;

  let level: WaveLevel = 'normal';
  if (multiplier >= 3) level = 'extreme';
  else if (multiplier >= 2) level = 'rush';
  else if (multiplier >= 1.4) level = 'elevated';

  // Find peak hour in last 7 days for pattern awareness
  const { data: hourlyData } = await ssb
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', window7Days.toISOString());

  const hourBuckets = new Array<number>(24).fill(0);
  for (const o of hourlyData ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    hourBuckets[h]++;
  }
  const maxCount = Math.max(...hourBuckets);
  const peakHour = maxCount > 0 ? hourBuckets.indexOf(maxCount) : null;

  // ETA for abklingen: rush typically lasts ~45-60 min, estimate based on level
  const etaAbklingMin = level === 'extreme' ? 60 : level === 'rush' ? 45 : level === 'elevated' ? 20 : null;

  let alertMessage: string | null = null;
  if (level === 'extreme') alertMessage = `Extrem-Rush: ${currentRatePerHour} Bestellungen/h (${multiplier}× Durchschnitt)`;
  else if (level === 'rush') alertMessage = `Rush erkannt: ${currentRatePerHour} Bestellungen/h (${multiplier}× Durchschnitt)`;
  else if (level === 'elevated') alertMessage = `Erhöhte Nachfrage: ${currentRatePerHour} Bestellungen/h`;

  return NextResponse.json({
    ok: true,
    data: {
      currentRatePerHour,
      avgRatePerHour,
      multiplier,
      level,
      ordersLast30Min,
      peakHour,
      etaAbklingMin,
      alertMessage,
    } satisfies WaveData,
    generatedAt: now.toISOString(),
  });
}
