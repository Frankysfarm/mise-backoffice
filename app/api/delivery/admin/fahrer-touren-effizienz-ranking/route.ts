import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_score: number;
  touren_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.',  rang: 1, effizienz_score: 92, touren_pro_stunde: 2.3, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',    rang: 2, effizienz_score: 78, touren_pro_stunde: 2.0, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',   rang: 3, effizienz_score: 61, touren_pro_stunde: 1.6, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',    rang: 4, effizienz_score: 38, touren_pro_stunde: 1.1, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_score: 67,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
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

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, shift_id, distance_km, created_at')
      .eq('location_id', location_id)
      .gte('created_at', since)
      .not('driver_id', 'is', null);

    if (error || !tours?.length) return NextResponse.json(MOCK_DATA);

    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('id, started_at, ended_at')
      .eq('location_id', location_id)
      .gte('started_at', since);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', location_id);

    const nameMap = new Map<string, string>(
      (employees ?? []).map(e => [e.id, `${e.vorname} ${e.nachname.charAt(0)}.`])
    );

    const shiftDurMap = new Map<string, number>();
    for (const s of shifts ?? []) {
      if (s.started_at && s.ended_at) {
        const dur = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
        shiftDurMap.set(s.id, Math.max(dur, 0.5));
      }
    }

    type Acc = { count: number; shift_hours: number; total_km: number; shifts: Set<string> };
    const byDriver = new Map<string, Acc>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const acc = byDriver.get(t.driver_id) ?? { count: 0, shift_hours: 0, total_km: 0, shifts: new Set<string>() };
      acc.count += 1;
      acc.total_km += (t.distance_km as number | null) ?? 0;
      if (t.shift_id && !acc.shifts.has(t.shift_id)) {
        acc.shifts.add(t.shift_id);
        acc.shift_hours += shiftDurMap.get(t.shift_id) ?? 4;
      }
      byDriver.set(t.driver_id, acc);
    }

    const computed = [...byDriver.entries()].map(([id, v]) => {
      const hours = Math.max(v.shift_hours, 0.5);
      const touren_pro_stunde = Math.round((v.count / hours) * 10) / 10;
      const km_pro_tour = v.count > 0 ? v.total_km / v.count : 0;
      // Score: 60% von Touren/h (Benchmark 2.5/h = 100%), 40% von km-Effizienz (Benchmark 8km/Tour = 100%)
      const deliveryScore = Math.min(60, (touren_pro_stunde / 2.5) * 60);
      const kmScore = km_pro_tour > 0 ? Math.min(40, (8 / km_pro_tour) * 40) : 0;
      const effizienz_score = Math.round(deliveryScore + kmScore);
      return { fahrer_id: id, fahrer_name: nameMap.get(id) ?? id, effizienz_score, touren_pro_stunde };
    });

    computed.sort((a, b) => b.effizienz_score - a.effizienz_score);

    if (!computed.length) return NextResponse.json(MOCK_DATA);

    const n = computed.length;
    const team_avg_score = Math.round(computed.reduce((s, f) => s + f.effizienz_score, 0) / n);

    const fahrer: FahrerRow[] = computed.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        effizienz_score: f.effizienz_score,
        touren_pro_stunde: f.touren_pro_stunde,
        rank_delta: 0,
        ampel: ampelVon(rang, n),
        alert_bottom: rang > Math.floor(n * 0.75),
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_score,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[n - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: n,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
