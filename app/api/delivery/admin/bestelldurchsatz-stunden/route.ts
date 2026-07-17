import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StundenDurchsatz {
  stunde: number;
  bestellungen: number;
  vortag_bestellungen: number;
  ist_peak: boolean;
}

export interface BestelldurchsatzResponse {
  location_id: string;
  stunden: StundenDurchsatz[];
  peak_stunde: number;
  naechste_stunde_prognose: number;
  team_gesamt_heute: number;
  alert_sinkend: boolean;
  generiert_am: string;
}

function buildMock(): BestelldurchsatzResponse {
  const nowH = new Date().getHours();
  const stunden: StundenDurchsatz[] = Array.from({ length: 24 }, (_, h) => {
    const base = h < 10 ? Math.floor(h * 0.5) : h < 14 ? 8 + Math.floor(Math.random() * 5) : h < 18 ? 4 + Math.floor(Math.random() * 4) : h < 22 ? 10 + Math.floor(Math.random() * 6) : 2;
    const vortag = Math.max(0, base + Math.floor(Math.random() * 3) - 1);
    return { stunde: h, bestellungen: h <= nowH ? base : 0, vortag_bestellungen: vortag, ist_peak: false };
  });
  // mark peaks
  const maxVal = Math.max(...stunden.filter(s => s.bestellungen > 0).map(s => s.bestellungen));
  stunden.forEach(s => { s.ist_peak = s.bestellungen === maxVal && maxVal > 0; });
  const peakH = stunden.find(s => s.ist_peak)?.stunde ?? 20;
  const lastTwo = stunden.filter(s => s.stunde <= nowH && s.stunde >= nowH - 1).map(s => s.bestellungen);
  const alertSinkend = lastTwo.length === 2 && lastTwo[1] > 0 && lastTwo[0] < lastTwo[1] * 0.7;
  const prognose = nowH < 23 ? Math.max(0, (stunden[nowH]?.bestellungen ?? 0) + Math.floor(Math.random() * 3) - 1) : 0;
  return {
    location_id: 'mock',
    stunden,
    peak_stunde: peakH,
    naechste_stunde_prognose: prognose,
    team_gesamt_heute: stunden.reduce((s, h) => s + h.bestellungen, 0),
    alert_sinkend: alertSinkend,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    const [todayRes, yesterdayRes] = await Promise.all([
      sb
        .from('orders')
        .select('id, created_at')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', now.toISOString()),
      sb
        .from('orders')
        .select('id, created_at')
        .eq('location_id', locationId)
        .gte('created_at', yesterdayStart.toISOString())
        .lte('created_at', yesterdayEnd.toISOString()),
    ]);

    if (todayRes.error || yesterdayRes.error) throw new Error('db error');

    const todayOrders = todayRes.data ?? [];
    const yesterdayOrders = yesterdayRes.data ?? [];

    const countByHour = (orders: { created_at: string }[]) => {
      const map: Record<number, number> = {};
      for (const o of orders) {
        const h = new Date(o.created_at).getHours();
        map[h] = (map[h] ?? 0) + 1;
      }
      return map;
    };

    const todayMap = countByHour(todayOrders);
    const yesterdayMap = countByHour(yesterdayOrders);
    const nowH = now.getHours();

    const stunden: StundenDurchsatz[] = Array.from({ length: 24 }, (_, h) => ({
      stunde: h,
      bestellungen: h <= nowH ? (todayMap[h] ?? 0) : 0,
      vortag_bestellungen: yesterdayMap[h] ?? 0,
      ist_peak: false,
    }));

    const maxVal = Math.max(...stunden.filter(s => s.bestellungen > 0).map(s => s.bestellungen), 0);
    if (maxVal > 0) stunden.forEach(s => { s.ist_peak = s.bestellungen === maxVal; });
    const peakH = stunden.find(s => s.ist_peak)?.stunde ?? nowH;

    const lastTwo = [stunden[nowH - 1]?.bestellungen ?? 0, stunden[nowH]?.bestellungen ?? 0];
    const alertSinkend = nowH >= 1 && lastTwo[0] > 0 && lastTwo[1] < lastTwo[0] * 0.7;

    // prognose: avg of same hour ±1 over last 7 days (simplified: use yesterday)
    const prognose = nowH < 23 ? (yesterdayMap[nowH + 1] ?? 0) : 0;

    const body: BestelldurchsatzResponse = {
      location_id: locationId,
      stunden,
      peak_stunde: peakH,
      naechste_stunde_prognose: prognose,
      team_gesamt_heute: todayOrders.length,
      alert_sinkend: alertSinkend,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(buildMock());
  }
}
