/**
 * GET /api/delivery/admin/schicht-kapazitaets-prognose?location_id=...
 *
 * Schicht-Kapazitäts-Prognose: 4h-Vorausschau für Bestellvolumen vs. Fahrer-Verfügbarkeit.
 * Phase 513
 *
 * Response: { ok, slots: CapacitySlot[], summary: CapacitySummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type CapacityLevel = 'ok' | 'tight' | 'critical' | 'idle';

export interface CapacitySlot {
  hourUtc: number;
  label: string;
  expectedOrders: number;
  availableDrivers: number;
  ordersPerDriver: number;
  level: CapacityLevel;
}

export interface CapacitySummary {
  totalExpected: number;
  peakHour: number | null;
  peakLevel: CapacityLevel;
  avgOrdersPerDriver: number;
  onlineDriversNow: number;
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

function slotLevel(ordersPerDriver: number, availableDrivers: number): CapacityLevel {
  if (availableDrivers === 0) return 'critical';
  if (ordersPerDriver >= 4) return 'critical';
  if (ordersPerDriver >= 2.5) return 'tight';
  if (ordersPerDriver < 0.5) return 'idle';
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
  const nowHour = now.getUTCHours();

  // Online drivers right now
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
  const { data: gpsData } = await ssb
    .from('driver_gps_events')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('recorded_at', fiveMinAgo.toISOString());

  const onlineDriverIds = [...new Set((gpsData ?? []).map((g) => g.driver_id as string))];
  const onlineDriversNow = onlineDriverIds.length;

  // Historical order volumes by hour from last 4 weeks (same weekday)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 3_600_000);
  const { data: historicOrders } = await ssb
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', fourWeeksAgo.toISOString())
    .lt('created_at', now.toISOString());

  // Build hour buckets for same weekday (0=Sun…6=Sat)
  const todayWeekday = now.getUTCDay();
  const hourSums = new Array<number>(24).fill(0);
  const hourCounts = new Array<number>(24).fill(0);

  for (const o of historicOrders ?? []) {
    const d = new Date(o.created_at as string);
    if (d.getUTCDay() === todayWeekday) {
      hourSums[d.getUTCHours()]++;
      hourCounts[d.getUTCHours()]++;
    }
  }

  // Avg per hour across same-weekday occurrences (up to 4 weeks = 4 occurrences)
  const avgPerHour = hourSums.map((s, h) => {
    const weeks = 4;
    return Math.round((s / weeks) * 10) / 10;
  });

  // Next 4 hours (incl. current)
  const slots: CapacitySlot[] = [];
  for (let i = 0; i < 4; i++) {
    const h = (nowHour + i) % 24;
    const expectedOrders = Math.round(avgPerHour[h]);
    const availableDrivers = onlineDriversNow;
    const ordersPerDriver = availableDrivers > 0 ? expectedOrders / availableDrivers : expectedOrders;
    const level = slotLevel(ordersPerDriver, availableDrivers);
    const hourLabel = `${String(h).padStart(2, '0')}:00`;
    slots.push({
      hourUtc: h,
      label: i === 0 ? `${hourLabel} (jetzt)` : hourLabel,
      expectedOrders,
      availableDrivers,
      ordersPerDriver: Math.round(ordersPerDriver * 10) / 10,
      level,
    });
  }

  const peakSlot = slots.reduce((best, s) => s.expectedOrders > best.expectedOrders ? s : best, slots[0]);
  const totalExpected = slots.reduce((sum, s) => sum + s.expectedOrders, 0);
  const avgOPD = onlineDriversNow > 0
    ? Math.round((totalExpected / onlineDriversNow) * 10) / 10
    : 0;

  const summary: CapacitySummary = {
    totalExpected,
    peakHour: peakSlot?.hourUtc ?? null,
    peakLevel: peakSlot?.level ?? 'ok',
    avgOrdersPerDriver: avgOPD,
    onlineDriversNow,
  };

  return NextResponse.json({ ok: true, slots, summary, generatedAt: now.toISOString() });
}
