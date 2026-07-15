/**
 * GET /api/delivery/admin/tour-effizienz-history?location_id=<uuid>
 *
 * Phase 1747 — Tour-Effizienz-Score-History-API (Backend)
 * Tour-Score je Fahrer über letzte 7 Tage; Trend (steigend/fallend/stabil);
 * Multi-Tenant via location_id; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesScore {
  datum: string;
  score: number;
  touren: number;
}

export interface FahrerEffizienzHistory {
  driver_id: string;
  fahrer_name: string;
  tage: TagesScore[];
  avg_score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

export interface TourEffizienzHistoryAntwort {
  fahrer: FahrerEffizienzHistory[];
  location_id: string;
  zeitraum_tage: number;
  generiert_am: string;
}

function calcTrend(tage: TagesScore[]): { trend: 'steigend' | 'fallend' | 'stabil'; delta: number } {
  if (tage.length < 2) return { trend: 'stabil', delta: 0 };
  const sorted = [...tage].sort((a, b) => a.datum.localeCompare(b.datum));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avg1 = firstHalf.reduce((s, t) => s + t.score, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((s, t) => s + t.score, 0) / secondHalf.length;
  const delta = Math.round((avg2 - avg1) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function buildMock(locationId: string): TourEffizienzHistoryAntwort {
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const fahrer: FahrerEffizienzHistory[] = [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', scores: [72, 75, 78, 80, 83, 85, 87] },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.',  scores: [90, 88, 85, 83, 80, 79, 77] },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.',  scores: [68, 70, 69, 72, 71, 73, 72] },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.',   scores: [82, 83, 84, 83, 85, 86, 85] },
  ].map(({ driver_id, fahrer_name, scores }) => {
    const tage: TagesScore[] = dates.map((datum, i) => ({
      datum,
      score: scores[i] ?? 70,
      touren: 3 + Math.floor(i % 3),
    }));
    const avg = Math.round(tage.reduce((s, t) => s + t.score, 0) / tage.length);
    const { trend, delta } = calcTrend(tage);
    return { driver_id, fahrer_name, tage, avg_score: avg, trend, trend_delta: delta };
  });

  return { fahrer, location_id: locationId, zeitraum_tage: 7, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const today = new Date();

    const dateStrings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const startDate = dateStrings[0];
    const endDate = dateStrings[6];

    const { data: touren } = await supabase
      .from('delivery_batches')
      .select('id, fahrer_id, startzeit, endzeit, score, employees(vorname, nachname)')
      .gte('startzeit', `${startDate}T00:00:00`)
      .lte('startzeit', `${endDate}T23:59:59`)
      .eq('location_id', locationId)
      .not('score', 'is', null)
      .not('startzeit', 'is', null);

    if (!touren || touren.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const driverDayMap: Record<string, Record<string, number[]>> = {};
    const driverNames: Record<string, string> = {};

    for (const t of touren) {
      const datum = (t.startzeit as string).split('T')[0];
      const id = (t.fahrer_id as string) ?? 'unknown';
      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      if (emp) driverNames[id] = `${(emp as any).vorname} ${(emp as any).nachname[0]}.`;
      if (!driverDayMap[id]) driverDayMap[id] = {};
      if (!driverDayMap[id][datum]) driverDayMap[id][datum] = [];
      driverDayMap[id][datum].push(t.score as number);
    }

    const fahrer: FahrerEffizienzHistory[] = Object.entries(driverDayMap).map(([driver_id, dayMap]) => {
      const tage: TagesScore[] = dateStrings.map(datum => {
        const scores = dayMap[datum] ?? [];
        const score = scores.length > 0
          ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
          : 0;
        return { datum, score, touren: scores.length };
      }).filter(t => t.touren > 0);

      const avg = tage.length > 0
        ? Math.round(tage.reduce((s, t) => s + t.score, 0) / tage.length)
        : 0;
      const { trend, delta } = calcTrend(tage);

      return {
        driver_id,
        fahrer_name: driverNames[driver_id] ?? 'Fahrer',
        tage,
        avg_score: avg,
        trend,
        trend_delta: delta,
      };
    });

    return NextResponse.json({
      fahrer,
      location_id: locationId,
      zeitraum_tage: 7,
      generiert_am: new Date().toISOString(),
    } as TourEffizienzHistoryAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
