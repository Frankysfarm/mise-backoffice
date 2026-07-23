import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerSchichtDauer {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface SchichtDauerResponse {
  fahrer: FahrerSchichtDauer[];
  team_avg: number;
  kuerzester_name: string;
  laengster_name: string;
  alert_count: number;
  gesamt: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [curRes, prevRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('delivery_shifts')
          .select(`driver_id, started_at, ended_at, profiles!driver_id(full_name)`)
          .gte('started_at', thirtyDaysAgo.toISOString())
          .not('started_at', 'is', null)
          .not('ended_at', 'is', null);
        if (locationId) q = q.eq('location_id', locationId);
        return q;
      })(),
      (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let q = supabase
          .from('delivery_shifts')
          .select(`driver_id, started_at, ended_at`)
          .gte('started_at', thirtyDaysAgo.toISOString())
          .lte('started_at', yesterday.toISOString())
          .not('started_at', 'is', null)
          .not('ended_at', 'is', null);
        if (locationId) q = q.eq('location_id', locationId);
        return q;
      })(),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return NextResponse.json(getMockData());
    }

    const driverMap = new Map<string, { name: string; totalMin: number; count: number }>();
    for (const shift of curRes.data) {
      if (!shift.started_at || !shift.ended_at) continue;
      const durMin = (new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000;
      if (durMin <= 0) continue;
      const name = (shift.profiles as any)?.full_name ?? 'Unbekannt';
      const existing = driverMap.get(shift.driver_id);
      if (existing) {
        existing.totalMin += durMin;
        existing.count += 1;
      } else {
        driverMap.set(shift.driver_id, { name, totalMin: durMin, count: 1 });
      }
    }

    if (driverMap.size === 0) return NextResponse.json(getMockData());

    const drivers = Array.from(driverMap.entries())
      .filter(([, d]) => d.count > 0)
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        dauer_min: Math.round(d.totalMin / d.count),
      }));

    drivers.sort((a, b) => a.dauer_min - b.dauer_min);
    const gesamt = drivers.length;
    const top25idx = Math.ceil(gesamt * 0.75);

    const prevMap = new Map<string, number>();
    if (prevRes.data) {
      const prevDriverMap = new Map<string, { total: number; count: number }>();
      for (const shift of prevRes.data) {
        if (!shift.started_at || !shift.ended_at) continue;
        const durMin = (new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000;
        if (durMin <= 0) continue;
        const ex = prevDriverMap.get(shift.driver_id);
        if (ex) { ex.total += durMin; ex.count += 1; }
        else prevDriverMap.set(shift.driver_id, { total: durMin, count: 1 });
      }
      const prevSorted = Array.from(prevDriverMap.entries())
        .map(([id, d]) => ({ id, avg: Math.round(d.total / d.count) }))
        .sort((a, b) => a.avg - b.avg);
      prevSorted.forEach((f, i) => prevMap.set(f.id, i + 1));
    }

    const ranked: FahrerSchichtDauer[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevMap.get(d.fahrer_id) ?? rang;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      return {
        ...d,
        rang,
        rank_delta: rang - prevRang,
        ampel,
        alert_top: rang > top25idx,
      };
    });

    const teamAvg = Math.round(drivers.reduce((s, d) => s + d.dauer_min, 0) / gesamt);

    return NextResponse.json({
      fahrer: ranked,
      team_avg: teamAvg,
      kuerzester_name: ranked[0]?.fahrer_name ?? '',
      laengster_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_top).length,
      gesamt,
    } satisfies SchichtDauerResponse);
  } catch {
    return NextResponse.json(getMockData());
  }
}

function getMockData(): SchichtDauerResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', dauer_min: 480 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.', dauer_min: 510 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.', dauer_min: 555 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.', dauer_min: 615 },
  ];
  const gesamt = mock.length;
  const top25idx = Math.ceil(gesamt * 0.75);
  const fahrer: FahrerSchichtDauer[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, rang, rank_delta: 0, ampel, alert_top: rang > top25idx };
  });
  const teamAvg = Math.round(mock.reduce((s, d) => s + d.dauer_min, 0) / gesamt);
  return {
    fahrer,
    team_avg: teamAvg,
    kuerzester_name: fahrer[0]?.fahrer_name ?? '',
    laengster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_top).length,
    gesamt,
  };
}
