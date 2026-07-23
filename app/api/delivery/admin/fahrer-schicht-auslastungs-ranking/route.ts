import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerAuslastung {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface AuslastungResponse {
  fahrer: FahrerAuslastung[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

function getMockData(): AuslastungResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', auslastung_pct: 82 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.',  auslastung_pct: 71 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.',   auslastung_pct: 58 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.',   auslastung_pct: 44 },
  ];
  const gesamt = mock.length;
  const bot25idx = Math.ceil(gesamt * 0.75);
  const fahrer: FahrerAuslastung[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, rang, rank_delta: 0, ampel, alert_bottom: rang > bot25idx };
  });
  const teamAvg = Math.round(mock.reduce((s, d) => s + d.auslastung_pct, 0) / gesamt);
  return {
    fahrer,
    team_avg: teamAvg,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    niedrigster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_bottom).length,
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

    const [toursRes, shiftsRes, prevToursRes, prevShiftsRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, returned_at, drivers(full_name)')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('departed_at', thirtyDaysAgo.toISOString())
        .not('departed_at', 'is', null)
        .not('returned_at', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', locationId)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .not('started_at', 'is', null)
        .not('ended_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, returned_at')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('departed_at', sixtyDaysAgo.toISOString())
        .lt('departed_at', thirtyDaysAgo.toISOString())
        .not('departed_at', 'is', null)
        .not('returned_at', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', locationId)
        .gte('started_at', sixtyDaysAgo.toISOString())
        .lt('started_at', thirtyDaysAgo.toISOString())
        .not('started_at', 'is', null)
        .not('ended_at', 'is', null),
    ]);

    if (toursRes.error || shiftsRes.error || !toursRes.data || toursRes.data.length === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    type TourRow = {
      driver_id: string;
      departed_at: string | null;
      returned_at: string | null;
      drivers?: { full_name: string } | null;
    };
    type ShiftRow = {
      driver_id: string;
      started_at: string | null;
      ended_at: string | null;
    };

    const tourData = toursRes.data as TourRow[];
    const shiftData = (shiftsRes.data ?? []) as ShiftRow[];

    const tourMin = new Map<string, { name: string; activeMin: number }>();
    for (const t of tourData) {
      if (!t.departed_at || !t.returned_at) continue;
      const min = (new Date(t.returned_at).getTime() - new Date(t.departed_at).getTime()) / 60000;
      if (min <= 0) continue;
      const name = t.drivers?.full_name ?? t.driver_id;
      const ex = tourMin.get(t.driver_id);
      if (ex) ex.activeMin += min;
      else tourMin.set(t.driver_id, { name, activeMin: min });
    }

    const shiftMin = new Map<string, number>();
    for (const s of shiftData) {
      if (!s.started_at || !s.ended_at) continue;
      const min = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      if (min <= 0) continue;
      shiftMin.set(s.driver_id, (shiftMin.get(s.driver_id) ?? 0) + min);
    }

    const drivers = Array.from(tourMin.entries())
      .filter(([id]) => shiftMin.has(id))
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        auslastung_pct: Math.min(100, Math.round((d.activeMin / (shiftMin.get(id) ?? 1)) * 100)),
      }))
      .sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    if (drivers.length === 0) {
      const data = getMockData();
      if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
      return NextResponse.json(data);
    }

    const gesamt = drivers.length;
    const bot25idx = Math.ceil(gesamt * 0.75);

    const prevTourMin = new Map<string, number>();
    for (const t of (prevToursRes.data ?? []) as TourRow[]) {
      if (!t.departed_at || !t.returned_at) continue;
      const min = (new Date(t.returned_at).getTime() - new Date(t.departed_at).getTime()) / 60000;
      if (min > 0) prevTourMin.set(t.driver_id, (prevTourMin.get(t.driver_id) ?? 0) + min);
    }
    const prevShiftMin = new Map<string, number>();
    for (const s of (prevShiftsRes.data ?? []) as ShiftRow[]) {
      if (!s.started_at || !s.ended_at) continue;
      const min = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      if (min > 0) prevShiftMin.set(s.driver_id, (prevShiftMin.get(s.driver_id) ?? 0) + min);
    }

    const prevRankMap = new Map<string, number>();
    Array.from(prevTourMin.entries())
      .filter(([id]) => prevShiftMin.has(id))
      .map(([id, active]) => ({
        id,
        pct: Math.min(100, Math.round((active / (prevShiftMin.get(id) ?? 1)) * 100)),
      }))
      .sort((a, b) => b.pct - a.pct)
      .forEach((d, i) => prevRankMap.set(d.id, i + 1));

    const ranked: FahrerAuslastung[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(d.fahrer_id) ?? rang;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      return { ...d, rang, rank_delta: rang - prevRang, ampel, alert_bottom: rang > bot25idx };
    });

    const teamAvg = Math.round(drivers.reduce((s, d) => s + d.auslastung_pct, 0) / gesamt);
    const result = driverId ? ranked.filter(f => f.fahrer_id === driverId) : ranked;

    return NextResponse.json({
      fahrer: result,
      team_avg: teamAvg,
      bester_name: ranked[0]?.fahrer_name ?? '',
      niedrigster_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_bottom).length,
      gesamt,
    } satisfies AuslastungResponse);
  } catch {
    const data = getMockData();
    if (driverId) data.fahrer = data.fahrer.filter(f => f.fahrer_id === driverId);
    return NextResponse.json(data);
  }
}
