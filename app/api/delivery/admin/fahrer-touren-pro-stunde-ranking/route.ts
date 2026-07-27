import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_stunde: 2.1, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, touren_pro_stunde: 1.8, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, touren_pro_stunde: 1.5, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_pro_stunde: 1.1, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 1.6,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
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

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, shift_id, created_at')
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

    type Acc = { count: number; shift_hours: number; shifts: Set<string> };
    const byDriver = new Map<string, Acc>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const acc = byDriver.get(t.driver_id) ?? { count: 0, shift_hours: 0, shifts: new Set<string>() };
      acc.count += 1;
      if (t.shift_id && !acc.shifts.has(t.shift_id)) {
        acc.shifts.add(t.shift_id);
        acc.shift_hours += shiftDurMap.get(t.shift_id) ?? 4;
      }
      byDriver.set(t.driver_id, acc);
    }

    const sorted = [...byDriver.entries()]
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: nameMap.get(id) ?? id,
        touren_pro_stunde: Math.round((v.count / Math.max(v.shift_hours, 1)) * 10) / 10,
      }))
      .sort((a, b) => b.touren_pro_stunde - a.touren_pro_stunde);

    if (!sorted.length) return NextResponse.json(MOCK_DATA);

    const n = sorted.length;
    const team_avg = Math.round((sorted.reduce((s, f) => s + f.touren_pro_stunde, 0) / n) * 10) / 10;

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id:         f.fahrer_id,
        fahrer_name:       f.fahrer_name,
        rang,
        touren_pro_stunde: f.touren_pro_stunde,
        rank_delta:        0,
        ampel:             ampelVon(rang, n),
        alert_bottom:      rang > Math.floor(n * 0.75),
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name:  fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[n - 1]?.fahrer_name ?? '',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       n,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
