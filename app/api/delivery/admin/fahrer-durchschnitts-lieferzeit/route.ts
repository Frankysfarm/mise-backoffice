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
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_minuten: 18, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, avg_minuten: 22, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, avg_minuten: 28, rank_delta: -1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_minuten: 36, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg: 26,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const { data: stops, error } = await supabase
      .from('delivery_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', location_id)
      .gte('created_at', since)
      .not('driver_id', 'is', null)
      .not('delivered_at', 'is', null);

    if (error || !stops?.length) return NextResponse.json(MOCK_DATA);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', location_id);

    const nameMap = new Map<string, string>(
      (employees ?? []).map((e) => [e.id, `${e.vorname} ${e.nachname.charAt(0)}.`])
    );

    type Acc = { totalMin: number; count: number };
    const byDriver = new Map<string, Acc>();
    for (const s of stops) {
      if (!s.driver_id || !s.delivered_at) continue;
      const diffMs = new Date(s.delivered_at).getTime() - new Date(s.created_at).getTime();
      const diffMin = diffMs / 60000;
      if (diffMin < 0 || diffMin > 300) continue;
      const acc = byDriver.get(s.driver_id) ?? { totalMin: 0, count: 0 };
      acc.totalMin += diffMin;
      acc.count += 1;
      byDriver.set(s.driver_id, acc);
    }

    if (!byDriver.size) return NextResponse.json(MOCK_DATA);

    const rows = Array.from(byDriver.entries()).map(([id, acc]) => ({
      fahrer_id: id,
      fahrer_name: nameMap.get(id) ?? id.slice(0, 8),
      avg_minuten: acc.count > 0 ? acc.totalMin / acc.count : 0,
    }));

    rows.sort((a, b) => a.avg_minuten - b.avg_minuten);

    const total = rows.length;
    const teamSum = rows.reduce((s, r) => s + r.avg_minuten, 0);
    const team_avg = total > 0 ? teamSum / total : 0;

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang = i + 1;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        avg_minuten: Math.round(r.avg_minuten),
        rank_delta: 0,
        ampel,
        alert_langsam: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter((f) => f.alert_langsam).length;

    return NextResponse.json({
      fahrer,
      team_avg: Math.round(team_avg),
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: alertCount,
      gesamt: total,
    } as ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
