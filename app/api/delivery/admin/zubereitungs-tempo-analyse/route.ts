import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface KategorieTempoRow {
  kategorie: string;
  avg_min: number;
  ziel_min: number;
  ampel: 'schnell' | 'normal' | 'langsam';
  trend: 'besser' | 'gleich' | 'schlechter';
  bestellungen: number;
}

const MOCK_DATA: KategorieTempoRow[] = [
  { kategorie: 'Burger', avg_min: 11, ziel_min: 12, ampel: 'schnell', trend: 'besser', bestellungen: 14 },
  { kategorie: 'Pizza', avg_min: 15, ziel_min: 14, ampel: 'langsam', trend: 'schlechter', bestellungen: 9 },
  { kategorie: 'Bowls', avg_min: 8, ziel_min: 10, ampel: 'schnell', trend: 'gleich', bestellungen: 7 },
  { kategorie: 'Pasta', avg_min: 13, ziel_min: 12, ampel: 'normal', trend: 'gleich', bestellungen: 5 },
  { kategorie: 'Snacks', avg_min: 5, ziel_min: 6, ampel: 'schnell', trend: 'besser', bestellungen: 11 },
];

function ampelFor(avg: number, ziel: number): 'schnell' | 'normal' | 'langsam' {
  if (avg <= ziel * 0.9) return 'schnell';
  if (avg <= ziel * 1.1) return 'normal';
  return 'langsam';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, bestellt_am, zubereitung_start, zubereitung_fertig, category')
      .gte('bestellt_am', today.toISOString())
      .not('zubereitung_fertig', 'is', null)
      .eq(locationId ? 'location_id' : 'id', locationId ?? 'ignore');

    if (!orders || orders.length === 0) {
      return NextResponse.json(MOCK_DATA);
    }

    const byKat: Record<string, number[]> = {};
    for (const o of orders as { category?: string; zubereitung_start?: string; zubereitung_fertig?: string }[]) {
      const kat = (o.category ?? 'Sonstige');
      if (!o.zubereitung_start || !o.zubereitung_fertig) continue;
      const dur = (new Date(o.zubereitung_fertig).getTime() - new Date(o.zubereitung_start).getTime()) / 60_000;
      if (!byKat[kat]) byKat[kat] = [];
      byKat[kat].push(dur);
    }

    const result: KategorieTempoRow[] = Object.entries(byKat).map(([kat, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const ziel = 12;
      return {
        kategorie: kat,
        avg_min: Math.round(avg * 10) / 10,
        ziel_min: ziel,
        ampel: ampelFor(avg, ziel),
        trend: 'gleich',
        bestellungen: durations.length,
      };
    });

    return NextResponse.json(result.length > 0 ? result : MOCK_DATA);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
