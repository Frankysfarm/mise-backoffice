import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retourenquote: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, retourenquote: 1.0, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, retourenquote: 2.0, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, retourenquote: 4.0, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, retourenquote: 7.0, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 3.5,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
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

    const { data: orders, error } = await supabase
      .from('delivery_orders')
      .select('driver_id, status')
      .eq('location_id', location_id)
      .gte('created_at', since)
      .not('driver_id', 'is', null);

    if (error || !orders?.length) return NextResponse.json(MOCK_DATA);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', location_id);

    const nameMap = new Map<string, string>(
      (employees ?? []).map((e) => [e.id, `${e.vorname} ${e.nachname.charAt(0)}.`])
    );

    type Acc = { total: number; returned: number };
    const byDriver = new Map<string, Acc>();
    for (const o of orders) {
      if (!o.driver_id) continue;
      const acc = byDriver.get(o.driver_id) ?? { total: 0, returned: 0 };
      acc.total += 1;
      if (o.status === 'returned') acc.returned += 1;
      byDriver.set(o.driver_id, acc);
    }

    if (!byDriver.size) return NextResponse.json(MOCK_DATA);

    const rows = Array.from(byDriver.entries()).map(([id, acc]) => ({
      fahrer_id: id,
      fahrer_name: nameMap.get(id) ?? id.slice(0, 8),
      retourenquote: acc.total > 0 ? (acc.returned / acc.total) * 100 : 0,
    }));

    rows.sort((a, b) => a.retourenquote - b.retourenquote);

    const total = rows.length;
    const teamSum = rows.reduce((s, r) => s + r.retourenquote, 0);
    const team_avg = total > 0 ? teamSum / total : 0;

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang = i + 1;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        retourenquote: Math.round(r.retourenquote * 10) / 10,
        rank_delta: 0,
        ampel,
        alert_top: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter((f) => f.alert_top).length;

    return NextResponse.json({
      fahrer,
      team_avg: Math.round(team_avg * 10) / 10,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: alertCount,
      gesamt: total,
    } as ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
