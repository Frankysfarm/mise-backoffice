import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  quote_vw: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  alert_count: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', trinkgeld_quote: 8.2, quote_vw: 7.4, trend_delta:  0.8, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  trinkgeld_quote: 6.5, quote_vw: 6.0, trend_delta:  0.5, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   trinkgeld_quote: 4.1, quote_vw: 4.5, trend_delta: -0.4, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   trinkgeld_quote: 2.3, quote_vw: 3.5, trend_delta: -1.2, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 5.3,
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 5,
};

function calcAmpel(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const prevSince = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(MOCK);

    const rows = await Promise.all(
      drivers.map(async d => {
        const [{ data: curr }, { data: prev }] = await Promise.all([
          supabase
            .from('delivery_tours')
            .select('tip_amount, order_total')
            .eq('driver_id', d.id)
            .gte('created_at', since)
            .not('order_total', 'is', null),
          supabase
            .from('delivery_tours')
            .select('tip_amount, order_total')
            .eq('driver_id', d.id)
            .gte('created_at', prevSince)
            .lt('created_at', since)
            .not('order_total', 'is', null),
        ]);

        const tip = curr?.reduce((s, r) => s + (r.tip_amount ?? 0), 0) ?? 0;
        const total = curr?.reduce((s, r) => s + (r.order_total ?? 0), 0) ?? 0;
        const tipPrev = prev?.reduce((s, r) => s + (r.tip_amount ?? 0), 0) ?? 0;
        const totalPrev = prev?.reduce((s, r) => s + (r.order_total ?? 0), 0) ?? 0;

        const quote = total > 0 ? Math.round((tip / total) * 1000) / 10 : 0;
        const quotePrev = totalPrev > 0 ? Math.round((tipPrev / totalPrev) * 1000) / 10 : 0;

        return { fahrer_id: d.id, fahrer_name: d.name, trinkgeld_quote: quote, quote_vw: quotePrev };
      }),
    );

    // descending: highest trinkgeld_quote = Rang 1 = best
    rows.sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(i + 1, rows.length);
      return {
        ...r,
        trend_delta: Math.round((r.trinkgeld_quote - r.quote_vw) * 10) / 10,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    const team_avg_quote =
      fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.trinkgeld_quote, 0) / fahrer.length) * 10) / 10
        : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      const rang = fahrer.indexOf(me) + 1;
      return NextResponse.json({ fahrer_single: me, rang, team_avg_quote, gesamt: fahrer.length, ziel_pct: 5 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_quote,
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: fahrer.length,
      ziel_pct: 5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
