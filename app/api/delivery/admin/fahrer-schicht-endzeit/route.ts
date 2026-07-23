import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerSchichtEndzeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  endzeit_min: number;
  endzeit_str: string;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface SchichtEndzeitResponse {
  fahrer: FahrerSchichtEndzeit[];
  team_avg: number;
  team_avg_str: string;
  fruehester_name: string;
  spaetester_name: string;
  alert_count: number;
  gesamt: number;
}

function minToTimeStr(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = Math.round(min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
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
          .select(`driver_id, ended_at, profiles!driver_id(full_name)`)
          .gte('ended_at', thirtyDaysAgo.toISOString())
          .not('ended_at', 'is', null);
        if (locationId) q = q.eq('location_id', locationId);
        return q;
      })(),
      (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let q = supabase
          .from('delivery_shifts')
          .select(`driver_id, ended_at`)
          .gte('ended_at', thirtyDaysAgo.toISOString())
          .lte('ended_at', yesterday.toISOString())
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
      if (!shift.ended_at) continue;
      const d = new Date(shift.ended_at);
      const minOfDay = d.getHours() * 60 + d.getMinutes();
      const name = (shift.profiles as any)?.full_name ?? 'Unbekannt';
      const existing = driverMap.get(shift.driver_id);
      if (existing) {
        existing.totalMin += minOfDay;
        existing.count += 1;
      } else {
        driverMap.set(shift.driver_id, { name, totalMin: minOfDay, count: 1 });
      }
    }

    if (driverMap.size === 0) return NextResponse.json(getMockData());

    const drivers = Array.from(driverMap.entries())
      .filter(([, d]) => d.count > 0)
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        endzeit_min: Math.round(d.totalMin / d.count),
      }));

    drivers.sort((a, b) => a.endzeit_min - b.endzeit_min);
    const gesamt = drivers.length;
    const top25idx = Math.ceil(gesamt * 0.75);

    const prevMap = new Map<string, number>();
    if (prevRes.data) {
      const prevDriverMap = new Map<string, { total: number; count: number }>();
      for (const shift of prevRes.data) {
        if (!shift.ended_at) continue;
        const d = new Date(shift.ended_at);
        const minOfDay = d.getHours() * 60 + d.getMinutes();
        const ex = prevDriverMap.get(shift.driver_id);
        if (ex) { ex.total += minOfDay; ex.count += 1; }
        else prevDriverMap.set(shift.driver_id, { total: minOfDay, count: 1 });
      }
      const prevSorted = Array.from(prevDriverMap.entries())
        .map(([id, d]) => ({ id, avg: Math.round(d.total / d.count) }))
        .sort((a, b) => a.avg - b.avg);
      prevSorted.forEach((f, i) => prevMap.set(f.id, i + 1));
    }

    const ranked: FahrerSchichtEndzeit[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevMap.get(d.fahrer_id) ?? rang;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      return {
        ...d,
        endzeit_str: minToTimeStr(d.endzeit_min),
        rang,
        rank_delta: rang - prevRang,
        ampel,
        alert_top: rang > top25idx,
      };
    });

    const teamAvgMin = Math.round(drivers.reduce((s, d) => s + d.endzeit_min, 0) / gesamt);

    return NextResponse.json({
      fahrer: ranked,
      team_avg: teamAvgMin,
      team_avg_str: minToTimeStr(teamAvgMin),
      fruehester_name: ranked[0]?.fahrer_name ?? '',
      spaetester_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_top).length,
      gesamt,
    } satisfies SchichtEndzeitResponse);
  } catch {
    return NextResponse.json(getMockData());
  }
}

function getMockData(): SchichtEndzeitResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', endzeit_min: 16 * 60 + 30 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.', endzeit_min: 17 * 60 + 15 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.', endzeit_min: 18 * 60 + 2 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.', endzeit_min: 19 * 60 + 45 },
  ];
  const gesamt = mock.length;
  const top25idx = Math.ceil(gesamt * 0.75);
  const fahrer: FahrerSchichtEndzeit[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, endzeit_str: minToTimeStr(d.endzeit_min), rang, rank_delta: 0, ampel, alert_top: rang > top25idx };
  });
  const teamAvgMin = Math.round(mock.reduce((s, d) => s + d.endzeit_min, 0) / gesamt);
  return {
    fahrer,
    team_avg: teamAvgMin,
    team_avg_str: minToTimeStr(teamAvgMin),
    fruehester_name: fahrer[0]?.fahrer_name ?? '',
    spaetester_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_top).length,
    gesamt,
  };
}
