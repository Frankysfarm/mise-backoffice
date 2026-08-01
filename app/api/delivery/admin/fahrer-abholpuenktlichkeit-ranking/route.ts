import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_minuten: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_minuten: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
  fahrer_single?: FahrerRow & { team_avg_minuten: number; gesamt: number };
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_minuten: 2.1, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_minuten: 3.8, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_minuten: 5.2, rank_delta: -1, ampel: 'gelb',  alert_langsam: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_minuten: 7.6, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_minuten: 4.7,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const since30  = new Date(Date.now() - 30 * 86400000).toISOString();

    // Fetch stops where driver picked up (status delivered/returned) with pickup timing
    const { data: stops, error } = await supabase
      .from('mise_delivery_stops')
      .select('driver_id, picked_up_at, ready_at, employee_id')
      .eq('location_id', locationId)
      .gte('updated_at', since30)
      .not('picked_up_at', 'is', null)
      .not('ready_at', 'is', null);

    if (error || !stops || stops.length === 0) return NextResponse.json(MOCK_DATA);

    // Group by driver and compute avg pickup delay in minutes
    const map = new Map<string, { total: number; count: number; name: string }>();
    for (const s of stops) {
      const dId = (s.driver_id ?? s.employee_id) as string | null;
      if (!dId) continue;
      const diff = (new Date(s.picked_up_at as string).getTime() - new Date(s.ready_at as string).getTime()) / 60000;
      if (diff < 0) continue;
      const entry = map.get(dId) ?? { total: 0, count: 0, name: dId };
      entry.total += diff;
      entry.count += 1;
      map.set(dId, entry);
    }

    // Fetch driver names
    const driverIds = [...map.keys()];
    if (driverIds.length === 0) return NextResponse.json(MOCK_DATA);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverIds);

    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) nameMap.set(p.id, p.full_name ?? p.id);
    for (const [id, entry] of map) entry.name = nameMap.get(id) ?? id;

    // Build sorted list (ASCENDING — lowest avg = best)
    const rows = [...map.entries()]
      .filter(([, e]) => e.count >= 3)
      .map(([id, e]) => ({ fahrer_id: id, avg_minuten: e.total / e.count, name: e.name }))
      .sort((a, b) => a.avg_minuten - b.avg_minuten);

    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    const gesamt     = rows.length;
    const teamAvg    = rows.reduce((s, r) => s + r.avg_minuten, 0) / gesamt;
    const prevSince  = new Date(Date.now() - 60 * 86400000).toISOString();

    const { data: prevStops } = await supabase
      .from('mise_delivery_stops')
      .select('driver_id, picked_up_at, ready_at, employee_id')
      .eq('location_id', locationId)
      .gte('updated_at', prevSince)
      .lt('updated_at', since30)
      .not('picked_up_at', 'is', null)
      .not('ready_at', 'is', null);

    const prevMap = new Map<string, { total: number; count: number }>();
    for (const s of prevStops ?? []) {
      const dId = (s.driver_id ?? s.employee_id) as string | null;
      if (!dId) continue;
      const diff = (new Date(s.picked_up_at as string).getTime() - new Date(s.ready_at as string).getTime()) / 60000;
      if (diff < 0) continue;
      const entry = prevMap.get(dId) ?? { total: 0, count: 0 };
      entry.total += diff;
      entry.count += 1;
      prevMap.set(dId, entry);
    }

    const prevRows = [...prevMap.entries()]
      .filter(([, e]) => e.count >= 3)
      .map(([id, e]) => ({ fahrer_id: id, avg_minuten: e.total / e.count }))
      .sort((a, b) => a.avg_minuten - b.avg_minuten);

    const prevRankMap = new Map(prevRows.map((r, i) => [r.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang        = i + 1;
      const prevRang    = prevRankMap.get(r.fahrer_id) ?? rang;
      const rank_delta  = prevRang - rang; // positive = moved up
      const ampel       = ampelVon(rang, gesamt);
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.name,
        rang,
        avg_minuten:  Math.round(r.avg_minuten * 10) / 10,
        rank_delta,
        ampel,
        alert_langsam: r.avg_minuten > 5,
      };
    });

    const response: ApiResponse = {
      fahrer,
      team_avg_minuten: Math.round(teamAvg * 10) / 10,
      schnellste_name:  fahrer[0]?.fahrer_name ?? '',
      langsamste_name:  fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_langsam).length,
      gesamt,
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      if (me) {
        (response as ApiResponse & { fahrer_single: unknown }).fahrer_single = {
          ...me,
          team_avg_minuten: response.team_avg_minuten,
          gesamt,
        };
      }
    }

    return NextResponse.json(response satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
