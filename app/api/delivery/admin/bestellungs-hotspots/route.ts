import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HotspotStunde {
  stunde: number;
  anzahl: number;
  anteilPct: number;
  stufe: 'peak' | 'hoch' | 'mittel' | 'niedrig';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });

  const supabase = createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .eq('location_id', locationId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('status', 'eq', 'cancelled');

  const orders = data ?? [];
  const stundenZahl: Record<number, number> = {};
  for (let h = 0; h < 24; h++) stundenZahl[h] = 0;

  for (const o of orders) {
    const h = new Date(o.created_at).getHours();
    stundenZahl[h] = (stundenZahl[h] ?? 0) + 1;
  }

  const gesamt = Object.values(stundenZahl).reduce((a, b) => a + b, 0);
  const maxAnzahl = Math.max(...Object.values(stundenZahl), 1);

  const stunden: HotspotStunde[] = Object.entries(stundenZahl).map(([h, anzahl]) => {
    const anteilPct = gesamt > 0 ? Math.round((anzahl / gesamt) * 1000) / 10 : 0;
    const relPct = (anzahl / maxAnzahl) * 100;
    let stufe: HotspotStunde['stufe'] = 'niedrig';
    if (relPct >= 80) stufe = 'peak';
    else if (relPct >= 50) stufe = 'hoch';
    else if (relPct >= 25) stufe = 'mittel';
    return { stunde: parseInt(h, 10), anzahl, anteilPct, stufe };
  }).sort((a, b) => a.stunde - b.stunde);

  const peakStunde = stunden.reduce((best, s) => s.anzahl > best.anzahl ? s : best, stunden[0]);

  return NextResponse.json({
    ok: true,
    stunden,
    peakStunde: peakStunde.stunde,
    gesamt7Tage: gesamt,
    generatedAt: now.toISOString(),
  });
}
