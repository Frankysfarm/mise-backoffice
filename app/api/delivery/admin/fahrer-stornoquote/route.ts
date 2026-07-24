import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_quote: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, storno_quote:  1, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, storno_quote:  3, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, storno_quote:  7, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, storno_quote: 12, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg: 5.75,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const now = Date.now();
    const t30 = new Date(now - 30 * 86400000).toISOString();
    const t60 = new Date(now - 60 * 86400000).toISOString();
    const today = new Date(now).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('driver_id, status, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('created_at', t30)
        .lte('created_at', today),
      supabase
        .from('delivery_orders')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .gte('created_at', t60)
        .lt('created_at', t30),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      const result = driver_id
        ? { ...MOCK, fahrer: MOCK.fahrer.filter(f => f.fahrer_id === driver_id) }
        : MOCK;
      return NextResponse.json(result);
    }

    type OrderRow = { driver_id: string | null; status: string | null; drivers?: { full_name: string } | null };
    const cur = curRes.data as OrderRow[];
    const prev = (prevRes.data ?? []) as OrderRow[];

    const driverIds = [...new Set(cur.map(r => r.driver_id).filter(Boolean))] as string[];
    if (!driverIds.length) return NextResponse.json(MOCK);

    function calcQuote(rows: OrderRow[], dId: string): number {
      const mine = rows.filter(r => r.driver_id === dId);
      if (!mine.length) return 0;
      const cancelled = mine.filter(r => r.status === 'cancelled' || r.status === 'storniert').length;
      return Math.round((cancelled / mine.length) * 1000) / 10;
    }

    const curQuotes = driverIds.map(id => {
      const nameRow = cur.find(r => r.driver_id === id);
      return {
        fahrer_id: id,
        fahrer_name: (nameRow?.drivers as { full_name: string } | null)?.full_name ?? id,
        storno_quote: calcQuote(cur, id),
      };
    });

    const sorted = [...curQuotes].sort((a, b) => a.storno_quote - b.storno_quote);
    const n = sorted.length;

    const prevQuotes = driverIds.map(id => ({ id, q: calcQuote(prev, id) }));
    const prevSorted = [...prevQuotes].sort((a, b) => a.q - b.q).map(v => v.id);

    const top25 = Math.ceil(n * 0.25);
    const bot25 = Math.floor(n * 0.75);

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevIdx >= 0 ? prevIdx + 1 : rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        storno_quote: f.storno_quote,
        rank_delta: prevRang - rang,
        ampel: rang <= top25 ? 'gruen' : rang <= bot25 ? 'gelb' : 'rot',
        alert_hoch: rang > bot25,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.storno_quote, 0) / n) * 10) / 10;
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[n - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: n,
    } satisfies ApiResponse);
  } catch {
    const result = driver_id
      ? { ...MOCK, fahrer: MOCK.fahrer.filter(f => f.fahrer_id === driver_id) }
      : MOCK;
    return NextResponse.json(result);
  }
}
