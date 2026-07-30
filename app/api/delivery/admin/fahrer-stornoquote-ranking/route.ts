import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stornoquote_pct: number;
  balken_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stornoquote_pct:  2, balken_pct: 10, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, stornoquote_pct:  5, balken_pct: 25, rank_delta: -1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, stornoquote_pct:  8, balken_pct: 40, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stornoquote_pct: 14, balken_pct: 70, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 7,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('delivery_orders')
      .select('driver_id, status, profiles!driver_id(full_name)')
      .gte('created_at', since)
      .not('driver_id', 'is', null)
      .eq('location_id', locationId);

    if (!data || data.length === 0) return NextResponse.json(MOCK_DATA);

    const map = new Map<string, { name: string; total: number; storniert: number }>();
    for (const row of data) {
      if (!row.driver_id) continue;
      const name = (row.profiles as { full_name?: string } | null)?.full_name ?? row.driver_id;
      const e = map.get(row.driver_id) ?? { name, total: 0, storniert: 0 };
      e.total += 1;
      if (row.status === 'cancelled') e.storniert += 1;
      map.set(row.driver_id, e);
    }

    const rows = Array.from(map.entries())
      .map(([id, e]) => ({
        fahrer_id: id,
        fahrer_name: e.name,
        stornoquote_pct: e.total > 0 ? Math.round((e.storniert / e.total) * 100) : 0,
      }))
      .sort((a, b) => a.stornoquote_pct - b.stornoquote_pct);

    const gesamt = rows.length;
    const team_avg_pct = gesamt > 0 ? Math.round(rows.reduce((s, r) => s + r.stornoquote_pct, 0) / gesamt) : 0;
    const alert_count = rows.filter(r => r.stornoquote_pct > 10).length;

    const fahrer: FahrerRow[] = rows.map((r, i) => ({
      ...r,
      rang: i + 1,
      balken_pct: Math.min(100, r.stornoquote_pct * 5),
      rank_delta: 0,
      ampel: ampelVon(i + 1, gesamt),
      alert_hoch: r.stornoquote_pct > 10,
    }));

    return NextResponse.json({
      fahrer,
      team_avg_pct,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
