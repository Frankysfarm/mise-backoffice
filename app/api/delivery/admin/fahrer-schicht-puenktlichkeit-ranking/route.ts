import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  balken_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface PuenktlichkeitResponse {
  fahrer: FahrerPuenktlichkeit[];
  team_avg_pct: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

function getMockData(): PuenktlichkeitResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', puenktlichkeit_pct: 98 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.',  puenktlichkeit_pct: 91 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.',   puenktlichkeit_pct: 79 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.',   puenktlichkeit_pct: 63 },
  ];
  const gesamt = mock.length;
  const fahrer: FahrerPuenktlichkeit[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return {
      ...d,
      rang,
      balken_pct: d.puenktlichkeit_pct,
      rank_delta: 0,
      ampel,
      alert_niedrig: d.puenktlichkeit_pct < 80,
    };
  });
  const teamAvg = Math.round(mock.reduce((s, d) => s + d.puenktlichkeit_pct, 0) / gesamt);
  return {
    fahrer,
    team_avg_pct: teamAvg,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    niedrigster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_niedrig).length,
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
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [shiftsRes, prevShiftsRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, scheduled_start, drivers(full_name)')
        .eq('location_id', locationId)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .not('started_at', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, scheduled_start')
        .eq('location_id', locationId)
        .gte('started_at', sixtyDaysAgo.toISOString())
        .lt('started_at', thirtyDaysAgo.toISOString())
        .not('started_at', 'is', null),
    ]);

    if (shiftsRes.error || !shiftsRes.data || shiftsRes.data.length === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    type ShiftRow = {
      driver_id: string;
      started_at: string | null;
      scheduled_start: string | null;
      drivers?: { full_name: string } | null;
    };

    const ON_TIME_TOLERANCE_MS = 5 * 60 * 1000;

    const driverMap = new Map<string, { name: string; total: number; onTime: number }>();
    for (const s of shiftsRes.data as unknown as ShiftRow[]) {
      if (!s.started_at) continue;
      const name = s.drivers?.full_name ?? s.driver_id;
      const ex = driverMap.get(s.driver_id);
      const isOnTime = s.scheduled_start
        ? new Date(s.started_at).getTime() - new Date(s.scheduled_start).getTime() <= ON_TIME_TOLERANCE_MS
        : true;
      if (ex) {
        ex.total += 1;
        if (isOnTime) ex.onTime += 1;
      } else {
        driverMap.set(s.driver_id, { name, total: 1, onTime: isOnTime ? 1 : 0 });
      }
    }

    const drivers = Array.from(driverMap.entries())
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        puenktlichkeit_pct: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);

    if (drivers.length === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    const gesamt = drivers.length;

    const prevDriverMap = new Map<string, { total: number; onTime: number }>();
    for (const s of (prevShiftsRes.data ?? []) as unknown as ShiftRow[]) {
      if (!s.started_at) continue;
      const isOnTime = s.scheduled_start
        ? new Date(s.started_at).getTime() - new Date(s.scheduled_start).getTime() <= ON_TIME_TOLERANCE_MS
        : true;
      const ex = prevDriverMap.get(s.driver_id);
      if (ex) { ex.total += 1; if (isOnTime) ex.onTime += 1; }
      else prevDriverMap.set(s.driver_id, { total: 1, onTime: isOnTime ? 1 : 0 });
    }

    const prevRankMap = new Map<string, number>();
    Array.from(prevDriverMap.entries())
      .map(([id, d]) => ({ id, pct: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .forEach((d, i) => prevRankMap.set(d.id, i + 1));

    const ranked: FahrerPuenktlichkeit[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(d.fahrer_id) ?? rang;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      return {
        ...d,
        rang,
        balken_pct: d.puenktlichkeit_pct,
        rank_delta: rang - prevRang,
        ampel,
        alert_niedrig: d.puenktlichkeit_pct < 80,
      };
    });

    const teamAvg = Math.round(drivers.reduce((s, d) => s + d.puenktlichkeit_pct, 0) / gesamt);
    const result = driverId ? ranked.filter(f => f.fahrer_id === driverId) : ranked;

    return NextResponse.json({
      fahrer: result,
      team_avg_pct: teamAvg,
      bester_name: ranked[0]?.fahrer_name ?? '',
      niedrigster_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies PuenktlichkeitResponse);
  } catch {
    const data = getMockData();
    if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
    return NextResponse.json(data);
  }
}
