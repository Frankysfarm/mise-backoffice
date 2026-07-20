/**
 * GET /api/delivery/dispatch/score-rangliste?locationId=<uuid>
 *
 * Phase 2645 — Tour-Score Rangliste Live
 * Echtzeit-Fahrer-Rangliste: Score 0–100, Rank-Trend, Stopp-Dots, ETA, Pünktlichkeit.
 * Supabase: delivery_tours + delivery_assignments; Mock-Fallback wenn keine Daten.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TourStop {
  status: 'delivered' | 'pending' | 'delayed';
  etaMin?: number | null;
}

interface DriverRank {
  rank: number;
  rankTrend: 'up' | 'down' | 'same';
  driverId: string;
  name: string;
  score: number;
  scoreTrend: number;
  stopsCompleted: number;
  stopsTotal: number;
  dots: TourStop[];
  etaNextMin: number | null;
  onTimePct: number;
  isActive: boolean;
}

interface TeamSummary {
  avgScore: number;
  topDriverId: string | null;
  bottomDriverId: string | null;
  activeCount: number;
}

interface ApiResponse {
  drivers: DriverRank[];
  summary: TeamSummary;
}

const MOCK: ApiResponse = {
  summary: { avgScore: 76, topDriverId: 'd1', bottomDriverId: 'd3', activeCount: 4 },
  drivers: [
    { rank: 1, rankTrend: 'up',   driverId: 'd1', name: 'Max M.',  score: 94, scoreTrend: 3,  stopsCompleted: 6, stopsTotal: 8, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 5 }, { status: 'pending', etaMin: 20 }], etaNextMin: 5,  onTimePct: 97, isActive: true },
    { rank: 2, rankTrend: 'same', driverId: 'd2', name: 'Anna S.', score: 82, scoreTrend: 0,  stopsCompleted: 4, stopsTotal: 7, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 8 }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 8,  onTimePct: 88, isActive: true },
    { rank: 3, rankTrend: 'down', driverId: 'd4', name: 'Tom R.',  score: 71, scoreTrend: -5, stopsCompleted: 3, stopsTotal: 6, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 3 }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 3,  onTimePct: 79, isActive: true },
    { rank: 4, rankTrend: 'down', driverId: 'd3', name: 'Lisa K.', score: 55, scoreTrend: -8, stopsCompleted: 2, stopsTotal: 5, dots: [{ status: 'delivered' }, { status: 'delayed', etaMin: 1 }, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 1,  onTimePct: 61, isActive: true },
  ],
};

function calcScore(onTimePct: number, completedRatio: number): number {
  return Math.round(onTimePct * 0.6 + completedRatio * 100 * 0.4);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId') ?? '';

  if (!locationId) {
    return NextResponse.json(MOCK);
  }

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('id, driver_id, driver_name, status, estimated_delivery_at, delivered_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .order('driver_id');

    if (!tours || tours.length === 0) {
      return NextResponse.json(MOCK);
    }

    const now = Date.now();
    type DriverEntry = { name: string; delivered: number; total: number; onTime: number; dots: TourStop[]; etaNextMin: number | null };
    const driverMap = new Map<string, DriverEntry>();

    for (const t of tours) {
      if (!t.driver_id) continue;
      const d: DriverEntry = driverMap.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, delivered: 0, total: 0, onTime: 0, dots: [] as TourStop[], etaNextMin: null };

      d.total++;
      const isDelivered = t.status === 'delivered' || t.status === 'zugestellt';
      if (isDelivered) {
        d.delivered++;
        const onTime = t.estimated_delivery_at && t.delivered_at
          ? new Date(t.delivered_at) <= new Date(t.estimated_delivery_at)
          : true;
        if (onTime) d.onTime++;
        d.dots.push({ status: 'delivered' });
      } else {
        const etaMs = t.estimated_delivery_at ? new Date(t.estimated_delivery_at).getTime() - now : null;
        const etaMin = etaMs !== null ? Math.max(0, Math.round(etaMs / 60000)) : null;
        const delayed = etaMin !== null && etaMin <= 0;
        d.dots.push({ status: delayed ? 'delayed' : 'pending', etaMin: etaMin ?? undefined });
        if (d.etaNextMin === null && etaMin !== null) d.etaNextMin = etaMin;
      }

      driverMap.set(t.driver_id, d);
    }

    const drivers: DriverRank[] = Array.from(driverMap.entries()).map(([id, d]) => {
      const onTimePct = d.delivered > 0 ? Math.round((d.onTime / d.delivered) * 100) : 100;
      const ratio = d.total > 0 ? d.delivered / d.total : 0;
      const score = calcScore(onTimePct, ratio);
      return {
        rank: 0,
        rankTrend: 'same' as const,
        driverId: id,
        name: d.name,
        score,
        scoreTrend: 0,
        stopsCompleted: d.delivered,
        stopsTotal: d.total,
        dots: d.dots,
        etaNextMin: d.etaNextMin,
        onTimePct,
        isActive: true,
      };
    });

    drivers.sort((a, b) => b.score - a.score);
    drivers.forEach((d, i) => { d.rank = i + 1; });

    const avgScore = drivers.length > 0 ? Math.round(drivers.reduce((s, d) => s + d.score, 0) / drivers.length) : 0;

    const summary: TeamSummary = {
      avgScore,
      topDriverId: drivers[0]?.driverId ?? null,
      bottomDriverId: drivers[drivers.length - 1]?.driverId ?? null,
      activeCount: drivers.length,
    };

    return NextResponse.json({ drivers, summary } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
