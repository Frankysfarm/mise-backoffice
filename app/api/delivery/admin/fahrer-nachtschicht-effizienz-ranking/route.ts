import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_nacht_lieferungen: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  aktivster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
  fahrer_single?: FahrerRow & { team_avg: number; gesamt: number };
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_nacht_lieferungen: 18, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_nacht_lieferungen: 14, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_nacht_lieferungen:  9, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_nacht_lieferungen:  6, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 11.75,
  aktivster_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): Ampel {
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
    const since30  = new Date(Date.now() - 30 * 86400_000).toISOString();

    // Fetch completed tours in last 30 days; filter for night hours (20:00–06:00 UTC)
    const { data: tours, error } = await supabase
      .from('mise_delivery_tours')
      .select('driver_id, employee_id, started_at, stop_count')
      .eq('location_id', locationId)
      .gte('started_at', since30)
      .not('completed_at', 'is', null);

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(MOCK_DATA);
    }

    // Accumulate night deliveries per driver (hour 20-23 or 0-5)
    const countMap = new Map<string, number>();
    const nameMap  = new Map<string, string>();

    for (const t of tours) {
      const dId = (t.driver_id ?? t.employee_id) as string | null;
      if (!dId) continue;
      const hour = new Date(t.started_at as string).getUTCHours();
      const isNight = hour >= 20 || hour < 6;
      if (!isNight) continue;
      countMap.set(dId, (countMap.get(dId) ?? 0) + (t.stop_count ?? 1));
      if (!nameMap.has(dId)) nameMap.set(dId, dId);
    }

    // Fetch driver names
    const driverIds = [...countMap.keys()];
    if (driverIds.length === 0) return NextResponse.json(MOCK_DATA);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, name')
      .in('id', driverIds);

    for (const e of (employees ?? [])) {
      if (e.id && e.name) nameMap.set(e.id as string, e.name as string);
    }

    const sorted = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, cnt], i) => {
        const rang = i + 1;
        return {
          fahrer_id:              id,
          fahrer_name:            nameMap.get(id) ?? id,
          rang,
          avg_nacht_lieferungen:  Math.round(cnt),
          rank_delta:             0,
          ampel:                  ampelVon(rang, countMap.size),
          alert_niedrig:          rang > Math.ceil(countMap.size * 0.75),
        } satisfies FahrerRow;
      });

    const totalLieferungen = sorted.reduce((s, f) => s + f.avg_nacht_lieferungen, 0);
    const team_avg = sorted.length > 0 ? Math.round((totalLieferungen / sorted.length) * 10) / 10 : 0;
    const alert_count = sorted.filter(f => f.alert_niedrig).length;

    const response: ApiResponse = {
      fahrer: sorted,
      team_avg,
      aktivster_name: sorted[0]?.fahrer_name ?? '',
      wenigster_name: sorted[sorted.length - 1]?.fahrer_name ?? '',
      alert_count,
      gesamt: sorted.length,
    };

    if (driverId) {
      const me = sorted.find(f => f.fahrer_id === driverId);
      if (me) {
        response.fahrer_single = { ...me, team_avg, gesamt: sorted.length };
      }
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
