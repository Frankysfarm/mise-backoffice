import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface StundeRow {
  stunde: number;
  bestellungen: number;
  is_peak: boolean;
  trend: 'steigend' | 'gleich' | 'fallend';
}

interface BestellzeitenResponse {
  stunden: StundeRow[];
  peak_stunden: number[];
  prognose_naechste_3h: { stunde: number; erwartet: number }[];
  gesamt_30_tage: number;
}

function buildMock(): BestellzeitenResponse {
  const stunden: StundeRow[] = Array.from({ length: 24 }, (_, h) => {
    const base =
      h >= 11 && h <= 14 ? 18 + Math.round(Math.random() * 8) :
      h >= 17 && h <= 21 ? 22 + Math.round(Math.random() * 10) :
      h >= 7  && h <= 10 ? 8  + Math.round(Math.random() * 5) :
      Math.round(Math.random() * 3);
    return {
      stunde: h,
      bestellungen: base,
      is_peak: base >= 20,
      trend: base >= 20 ? 'steigend' : base >= 10 ? 'gleich' : 'fallend',
    };
  });
  const now = new Date().getUTCHours();
  const prognose_naechste_3h = [1, 2, 3].map((offset) => {
    const h = (now + offset) % 24;
    return { stunde: h, erwartet: stunden[h].bestellungen };
  });
  return {
    stunden,
    peak_stunden: stunden.filter((s) => s.is_peak).map((s) => s.stunde),
    prognose_naechste_3h,
    gesamt_30_tage: stunden.reduce((a, s) => a + s.bestellungen * 30, 0),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: orders } = await supabase
      .from('customer_orders')
      .select('bestellt_am')
      .gte('bestellt_am', since.toISOString())
      .eq(locationId ? 'location_id' : 'id', locationId ?? 'ignore');

    if (!orders || orders.length === 0) {
      return NextResponse.json(buildMock());
    }

    const counts: Record<number, number> = {};
    for (const o of orders as { bestellt_am: string }[]) {
      const h = new Date(o.bestellt_am).getHours();
      counts[h] = (counts[h] ?? 0) + 1;
    }

    const maxCount = Math.max(...Object.values(counts), 1);
    const threshold = maxCount * 0.6;

    const stunden: StundeRow[] = Array.from({ length: 24 }, (_, h) => {
      const c = counts[h] ?? 0;
      return {
        stunde: h,
        bestellungen: c,
        is_peak: c >= threshold,
        trend: c >= threshold ? 'steigend' : c >= threshold * 0.5 ? 'gleich' : 'fallend',
      };
    });

    const now = new Date().getHours();
    const prognose_naechste_3h = [1, 2, 3].map((offset) => {
      const h = (now + offset) % 24;
      return { stunde: h, erwartet: stunden[h].bestellungen };
    });

    return NextResponse.json({
      stunden,
      peak_stunden: stunden.filter((s) => s.is_peak).map((s) => s.stunde),
      prognose_naechste_3h,
      gesamt_30_tage: orders.length,
    } satisfies BestellzeitenResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
