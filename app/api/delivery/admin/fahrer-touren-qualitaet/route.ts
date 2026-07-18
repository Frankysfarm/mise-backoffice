/**
 * GET /api/delivery/admin/fahrer-touren-qualitaet?location_id=...
 *
 * Qualitäts-Score je Fahrer heute (Pünktlichkeit + Storno + Kundenbewertung + Abholwartezeit).
 * Alert wenn Score <60. Trend vs. gleicher Wochentag letzte Woche.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DriverQualitaet {
  id: string;
  name: string;
  /** Gesamt-Score 0–100 */
  qualitaetScore: number;
  /** Score gleicher Wochentag letzte Woche */
  qualitaetScoreVW: number;
  trend: 'up' | 'down' | 'neutral';
  alert: boolean;
  /** Komponenten */
  puenktlichkeitScore: number; // 0–100
  stornoScore: number;         // 0–100 (invertiert: 100 = 0% Storno)
  bewertungScore: number;      // 0–100 (aus Kundenbewertungen, Ø×20)
  wartezeitScore: number;      // 0–100 (invertiert: 100 = 0 min Wartezeit)
  touren: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', userId)
    .single();
  return (emp?.location_id as string) ?? null;
}

function calcScore(
  puenktlichkeit: number,
  stornoRate: number,
  bewertungAvg: number,
  wartezeitMin: number,
): number {
  const p = Math.max(0, Math.min(100, puenktlichkeit));
  const s = Math.max(0, Math.min(100, 100 - stornoRate * 5));
  const b = Math.max(0, Math.min(100, bewertungAvg * 20));
  const w = Math.max(0, Math.min(100, 100 - wartezeitMin * 5));
  return Math.round(p * 0.35 + s * 0.25 + b * 0.25 + w * 0.15);
}

function mockData(): { drivers: DriverQualitaet[]; teamAvgScore: number; teamAvgScoreVW: number; alertCount: number } {
  const drivers: DriverQualitaet[] = [
    {
      id: 'd1', name: 'Anna K.', touren: 18,
      puenktlichkeitScore: 92, stornoScore: 100, bewertungScore: 90, wartezeitScore: 88,
      qualitaetScore: 93, qualitaetScoreVW: 88, trend: 'up', alert: false,
    },
    {
      id: 'd2', name: 'Ben T.', touren: 22,
      puenktlichkeitScore: 75, stornoScore: 78, bewertungScore: 72, wartezeitScore: 70,
      qualitaetScore: 74, qualitaetScoreVW: 76, trend: 'down', alert: false,
    },
    {
      id: 'd3', name: 'Chris M.', touren: 15,
      puenktlichkeitScore: 55, stornoScore: 45, bewertungScore: 50, wartezeitScore: 60,
      qualitaetScore: 52, qualitaetScoreVW: 60, trend: 'down', alert: true,
    },
    {
      id: 'd4', name: 'Diana P.', touren: 20,
      puenktlichkeitScore: 88, stornoScore: 100, bewertungScore: 84, wartezeitScore: 80,
      qualitaetScore: 89, qualitaetScoreVW: 85, trend: 'up', alert: false,
    },
  ];
  const teamAvgScore = Math.round(drivers.reduce((s, d) => s + d.qualitaetScore, 0) / drivers.length);
  const teamAvgScoreVW = Math.round(drivers.reduce((s, d) => s + d.qualitaetScoreVW, 0) / drivers.length);
  return { drivers, teamAvgScore, teamAvgScoreVW, alertCount: drivers.filter(d => d.alert).length };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let locationId = searchParams.get('location_id');

    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user && !locationId) locationId = await resolveLocationId(user.id);
    } catch {
      // unauthenticated — fall through to mock
    }

    if (!locationId) {
      const mock = mockData();
      return NextResponse.json({ ok: true, ...mock, generatedAt: new Date().toISOString(), mock: true });
    }

    const ssb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    // Same weekday last week
    const vwStart = new Date(todayStart.getTime() - 7 * 24 * 3_600_000);
    const vwEnd = new Date(todayStart.getTime() - 6 * 24 * 3_600_000);

    const { data: driversRaw } = await ssb
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (!driversRaw || driversRaw.length === 0) {
      const mock = mockData();
      return NextResponse.json({ ok: true, ...mock, generatedAt: now.toISOString(), mock: true });
    }

    const driverIds = driversRaw.map((d: { id: string }) => d.id);

    // Today orders
    const { data: ordersToday } = await ssb
      .from('customer_orders')
      .select('driver_id, status, scheduled_for, actual_delivery_at, arrived_at, actual_pickup_at, customer_rating')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart.toISOString());

    // Last week same day orders
    const { data: ordersVW } = await ssb
      .from('customer_orders')
      .select('driver_id, status, scheduled_for, actual_delivery_at, arrived_at, actual_pickup_at, customer_rating')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', vwStart.toISOString())
      .lt('created_at', vwEnd.toISOString());

    function buildScoreMap(
      orders: Array<{
        driver_id: string;
        status: string;
        scheduled_for: string | null;
        actual_delivery_at: string | null;
        arrived_at: string | null;
        actual_pickup_at: string | null;
        customer_rating: number | null;
      }>
    ) {
      const map = new Map<string, {
        total: number; cancelled: number; onTime: number;
        ratingSum: number; ratingCount: number;
        wartezeitSum: number; wartezeitCount: number;
      }>();
      for (const o of orders) {
        const dId = o.driver_id;
        if (!map.has(dId)) {
          map.set(dId, { total: 0, cancelled: 0, onTime: 0, ratingSum: 0, ratingCount: 0, wartezeitSum: 0, wartezeitCount: 0 });
        }
        const e = map.get(dId)!;
        e.total++;
        if (o.status === 'storniert') { e.cancelled++; continue; }
        // Pünktlichkeit: geliefert vor oder innerhalb scheduled_for
        if (o.scheduled_for && o.actual_delivery_at) {
          if (new Date(o.actual_delivery_at) <= new Date(o.scheduled_for)) e.onTime++;
        }
        // Bewertung
        if (o.customer_rating != null) {
          e.ratingSum += o.customer_rating;
          e.ratingCount++;
        }
        // Abholwartezeit: arrived_at → actual_pickup_at
        if (o.arrived_at && o.actual_pickup_at) {
          const wt = (new Date(o.actual_pickup_at).getTime() - new Date(o.arrived_at).getTime()) / 60_000;
          if (wt >= 0) { e.wartezeitSum += wt; e.wartezeitCount++; }
        }
      }
      return map;
    }

    const todayMap = buildScoreMap(
      (ordersToday ?? []) as Array<{
        driver_id: string; status: string; scheduled_for: string | null;
        actual_delivery_at: string | null; arrived_at: string | null;
        actual_pickup_at: string | null; customer_rating: number | null;
      }>
    );
    const vwMap = buildScoreMap(
      (ordersVW ?? []) as Array<{
        driver_id: string; status: string; scheduled_for: string | null;
        actual_delivery_at: string | null; arrived_at: string | null;
        actual_pickup_at: string | null; customer_rating: number | null;
      }>
    );

    const drivers: DriverQualitaet[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { total: 0, cancelled: 0, onTime: 0, ratingSum: 0, ratingCount: 0, wartezeitSum: 0, wartezeitCount: 0 };
      const v = vwMap.get(d.id) ?? { total: 0, cancelled: 0, onTime: 0, ratingSum: 0, ratingCount: 0, wartezeitSum: 0, wartezeitCount: 0 };

      const delivered = t.total - t.cancelled;
      const puenktlichkeit = delivered > 0 ? Math.round((t.onTime / delivered) * 100) : 100;
      const stornoRate = t.total > 0 ? (t.cancelled / t.total) * 100 : 0;
      const bewertungAvg = t.ratingCount > 0 ? t.ratingSum / t.ratingCount : 4;
      const wartezeitAvg = t.wartezeitCount > 0 ? t.wartezeitSum / t.wartezeitCount : 0;

      const stornoScore = Math.max(0, Math.min(100, Math.round(100 - stornoRate * 5)));
      const bewertungScore = Math.max(0, Math.min(100, Math.round(bewertungAvg * 20)));
      const wartezeitScore = Math.max(0, Math.min(100, Math.round(100 - wartezeitAvg * 5)));
      const qualitaetScore = calcScore(puenktlichkeit, stornoRate, bewertungAvg, wartezeitAvg);

      const vDelivered = v.total - v.cancelled;
      const vPuenkt = vDelivered > 0 ? (v.onTime / vDelivered) * 100 : 100;
      const vStorno = v.total > 0 ? (v.cancelled / v.total) * 100 : 0;
      const vBew = v.ratingCount > 0 ? v.ratingSum / v.ratingCount : 4;
      const vWart = v.wartezeitCount > 0 ? v.wartezeitSum / v.wartezeitCount : 0;
      const qualitaetScoreVW = calcScore(vPuenkt, vStorno, vBew, vWart);

      const trend: 'up' | 'down' | 'neutral' =
        qualitaetScore > qualitaetScoreVW + 3 ? 'up'
          : qualitaetScore < qualitaetScoreVW - 3 ? 'down'
          : 'neutral';

      return {
        id: d.id,
        name: d.name as string,
        touren: t.total,
        puenktlichkeitScore: puenktlichkeit,
        stornoScore,
        bewertungScore,
        wartezeitScore,
        qualitaetScore,
        qualitaetScoreVW,
        trend,
        alert: qualitaetScore < 60,
      };
    });

    const teamAvgScore = drivers.length > 0
      ? Math.round(drivers.reduce((s, d) => s + d.qualitaetScore, 0) / drivers.length)
      : 0;
    const teamAvgScoreVW = drivers.length > 0
      ? Math.round(drivers.reduce((s, d) => s + d.qualitaetScoreVW, 0) / drivers.length)
      : 0;
    const alertCount = drivers.filter(d => d.alert).length;

    return NextResponse.json({ ok: true, drivers, teamAvgScore, teamAvgScoreVW, alertCount, generatedAt: now.toISOString() });
  } catch (err) {
    console.error('[fahrer-touren-qualitaet]', err);
    const mock = mockData();
    return NextResponse.json({ ok: true, ...mock, generatedAt: new Date().toISOString(), mock: true });
  }
}
