import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerPausenDauer {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pausen_dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface PausenDauerResponse {
  fahrer: FahrerPausenDauer[];
  team_avg: number;
  kuerzester_name: string;
  laengster_name: string;
  alert_count: number;
  gesamt: number;
}

function getMockData(): PausenDauerResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', pausen_dauer_min: 15 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.', pausen_dauer_min: 22 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.', pausen_dauer_min: 31 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.', pausen_dauer_min: 48 },
  ];
  const gesamt = mock.length;
  const top25idx = Math.ceil(gesamt * 0.75);
  const fahrer: FahrerPausenDauer[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, rang, rank_delta: 0, ampel, alert_top: rang > top25idx };
  });
  const teamAvg = Math.round(mock.reduce((s, d) => s + d.pausen_dauer_min, 0) / gesamt);
  return {
    fahrer,
    team_avg: teamAvg,
    kuerzester_name: fahrer[0]?.fahrer_name ?? '',
    laengster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_top).length,
    gesamt,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('shift_breaks')
        .select('driver_id, started_at, ended_at, drivers(full_name)')
        .eq('location_id', locationId)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .not('started_at', 'is', null)
        .not('ended_at', 'is', null),
      supabase
        .from('shift_breaks')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', locationId)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .lte('started_at', yesterday.toISOString())
        .not('started_at', 'is', null)
        .not('ended_at', 'is', null),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    type BreakRow = {
      driver_id: string;
      started_at: string | null;
      ended_at: string | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as BreakRow[];
    const prevData = (prevRes.data ?? []) as BreakRow[];

    const driverMap = new Map<string, { name: string; totalMin: number; count: number }>();
    for (const row of curData) {
      if (!row.started_at || !row.ended_at) continue;
      const durMin = (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000;
      if (durMin <= 0) continue;
      const name = row.drivers?.full_name ?? row.driver_id;
      const ex = driverMap.get(row.driver_id);
      if (ex) { ex.totalMin += durMin; ex.count += 1; }
      else driverMap.set(row.driver_id, { name, totalMin: durMin, count: 1 });
    }

    if (driverMap.size === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    const drivers = Array.from(driverMap.entries())
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        pausen_dauer_min: Math.round(d.totalMin / d.count),
      }))
      .sort((a, b) => a.pausen_dauer_min - b.pausen_dauer_min);

    const gesamt = drivers.length;
    const top25idx = Math.ceil(gesamt * 0.75);

    const prevMap = new Map<string, number>();
    if (prevData.length > 0) {
      const prevDriverMap = new Map<string, { total: number; count: number }>();
      for (const row of prevData) {
        if (!row.started_at || !row.ended_at) continue;
        const durMin = (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000;
        if (durMin <= 0) continue;
        const ex = prevDriverMap.get(row.driver_id);
        if (ex) { ex.total += durMin; ex.count += 1; }
        else prevDriverMap.set(row.driver_id, { total: durMin, count: 1 });
      }
      Array.from(prevDriverMap.entries())
        .map(([id, d]) => ({ id, avg: Math.round(d.total / d.count) }))
        .sort((a, b) => a.avg - b.avg)
        .forEach((f, i) => prevMap.set(f.id, i + 1));
    }

    const ranked: FahrerPausenDauer[] = drivers.map((d, i) => {
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

    const teamAvg = Math.round(drivers.reduce((s, d) => s + d.pausen_dauer_min, 0) / gesamt);
    const result = driverId ? ranked.filter(f => f.fahrer_id === driverId) : ranked;

    return NextResponse.json({
      fahrer: result,
      team_avg: teamAvg,
      kuerzester_name: ranked[0]?.fahrer_name ?? '',
      laengster_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_top).length,
      gesamt,
    } satisfies PausenDauerResponse);
  } catch {
    const data = getMockData();
    if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
    return NextResponse.json(data);
  }
}
