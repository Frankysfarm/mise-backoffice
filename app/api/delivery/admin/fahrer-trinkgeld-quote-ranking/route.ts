import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trinkgeld_quote: number; // Trinkgeld / Bestellwert in %
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, trinkgeld_quote: 12, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, trinkgeld_quote:  9, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, trinkgeld_quote:  6, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trinkgeld_quote:  3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 7.5,
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
      .select('driver_id, trinkgeld_cents, order_total_euro')
      .eq('location_id', location_id)
      .gte('created_at', since)
      .not('driver_id', 'is', null);

    if (error || !tours?.length) return NextResponse.json(MOCK_DATA);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', location_id);

    const nameMap = new Map<string, string>(
      (employees ?? []).map(e => [e.id, `${e.vorname} ${e.nachname.charAt(0)}.`])
    );

    type Acc = { trinkgeld_sum: number; bestellwert_sum: number };
    const byDriver = new Map<string, Acc>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const acc = byDriver.get(t.driver_id) ?? { trinkgeld_sum: 0, bestellwert_sum: 0 };
      acc.trinkgeld_sum   += (t.trinkgeld_cents ?? 0) / 100;
      acc.bestellwert_sum += t.order_total_euro ?? 0;
      byDriver.set(t.driver_id, acc);
    }

    const sorted = [...byDriver.entries()]
      .filter(([, v]) => v.bestellwert_sum > 0)
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: nameMap.get(id) ?? id,
        quote: Math.round((v.trinkgeld_sum / v.bestellwert_sum) * 10000) / 100, // %
      }))
      .sort((a, b) => b.quote - a.quote);

    if (!sorted.length) return NextResponse.json(MOCK_DATA);

    const n = sorted.length;
    const team_avg = Math.round((sorted.reduce((s, f) => s + f.quote, 0) / n) * 100) / 100;

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        trinkgeld_quote: f.quote,
        rank_delta:      0,
        ampel:           ampelVon(rang, n),
        alert_bottom:    rang > Math.floor(n * 0.75),
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
