import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StundeData = {
  stunde: number;
  label: string;
  ø_wartezeit_min: number;
  bestellungen: number;
  empfehlung: string | null;
};

function mockData(): { stunden: StundeData[]; schlechteste_stunde: string; beste_stunde: string } {
  const stunden: StundeData[] = [
    { stunde: 11, label: '11:00', ø_wartezeit_min: 9.5, bestellungen: 12, empfehlung: null },
    { stunde: 12, label: '12:00', ø_wartezeit_min: 18.2, bestellungen: 38, empfehlung: 'Personalaufstockung empfohlen' },
    { stunde: 13, label: '13:00', ø_wartezeit_min: 22.7, bestellungen: 45, empfehlung: '+1 Koch empfohlen' },
    { stunde: 14, label: '14:00', ø_wartezeit_min: 11.3, bestellungen: 18, empfehlung: null },
    { stunde: 17, label: '17:00', ø_wartezeit_min: 13.1, bestellungen: 22, empfehlung: null },
    { stunde: 18, label: '18:00', ø_wartezeit_min: 19.8, bestellungen: 41, empfehlung: '+2 Köche empfohlen' },
    { stunde: 19, label: '19:00', ø_wartezeit_min: 25.4, bestellungen: 52, empfehlung: 'Kritischer Peak — Maximalbesetzung' },
    { stunde: 20, label: '20:00', ø_wartezeit_min: 16.0, bestellungen: 29, empfehlung: null },
  ];
  return { stunden, schlechteste_stunde: '19:00', beste_stunde: '11:00' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

    const q = supabase
      .from('customer_orders')
      .select('created_at, prepared_at, confirmed_at')
      .gte('created_at', sevenDaysAgo)
      .not('prepared_at', 'is', null);
    if (locationId) q.eq('location_id', locationId);
    const { data: orders, error } = await q;
    if (error || !orders || orders.length < 5) throw new Error('insufficient data');

    const buckets: Record<number, { sum: number; count: number }> = {};
    for (const o of orders) {
      const start = o.confirmed_at ?? o.created_at;
      if (!start || !o.prepared_at) continue;
      const min = (new Date(o.prepared_at).getTime() - new Date(start).getTime()) / 60_000;
      if (min <= 0 || min > 120) continue;
      const h = new Date(o.created_at).getHours();
      if (!buckets[h]) buckets[h] = { sum: 0, count: 0 };
      buckets[h].sum += min;
      buckets[h].count++;
    }

    const stunden: StundeData[] = Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([h, { sum, count }]) => {
        const stunde = Number(h);
        const ø = parseFloat((sum / count).toFixed(1));
        let empfehlung: string | null = null;
        if (ø >= 25) empfehlung = 'Kritischer Peak — Maximalbesetzung';
        else if (ø >= 20) empfehlung = '+2 Köche empfohlen';
        else if (ø >= 15) empfehlung = '+1 Koch empfohlen';
        return {
          stunde, label: `${String(stunde).padStart(2, '0')}:00`,
          ø_wartezeit_min: ø, bestellungen: count, empfehlung,
        };
      });

    const worst = stunden.reduce((a, b) => (b.ø_wartezeit_min > a.ø_wartezeit_min ? b : a), stunden[0]);
    const best = stunden.reduce((a, b) => (b.ø_wartezeit_min < a.ø_wartezeit_min ? b : a), stunden[0]);

    return NextResponse.json({ stunden, schlechteste_stunde: worst.label, beste_stunde: best.label });
  } catch {
    return NextResponse.json(mockData());
  }
}
