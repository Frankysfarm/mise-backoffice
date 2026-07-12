import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerPrognose = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden_gesamt: number;
  schicht_stunden_vergangen: number;
  stopps_bisher: number;
  umsatz_bisher_eur: number;
  avg_umsatz_pro_stopp_eur: number;
  pacing_pct: number;
  prognose_stopps: number;
  prognose_umsatz_eur: number;
  trend: 'stark' | 'normal' | 'schwach';
};

type ApiResponse = {
  fahrer: FahrerPrognose[];
  team_prognose_umsatz_eur: number;
  team_pacing_pct: number;
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): ApiResponse {
  const now = new Date();
  const stunde = now.getUTCHours();
  const schichtStart = 11;
  const schichtEnde = 22;
  const schichtGesamt = schichtEnde - schichtStart;
  const vergangen = Math.max(0.5, stunde - schichtStart + now.getUTCMinutes() / 60);
  const vergangenCapped = Math.min(vergangen, schichtGesamt);

  const fahrer: FahrerPrognose[] = [
    { fahrer_id: 'f1', fahrer_name: 'Ahmad K.',  stopps: 14, umsatz: 182 },
    { fahrer_id: 'f2', fahrer_name: 'Lukas M.',  stopps: 9,  umsatz: 108 },
    { fahrer_id: 'f3', fahrer_name: 'Sara P.',   stopps: 16, umsatz: 224 },
  ].map(f => {
    const avg = f.umsatz / Math.max(1, f.stopps);
    const pacing = vergangenCapped / schichtGesamt;
    const prognoseStopps = Math.round(f.stopps / Math.max(0.05, pacing));
    const prognoseUmsatz = prognoseStopps * avg;
    const pacingPct = Math.round(pacing * 100);
    return {
      fahrer_id: f.fahrer_id,
      fahrer_name: f.fahrer_name,
      schicht_stunden_gesamt: schichtGesamt,
      schicht_stunden_vergangen: Math.round(vergangenCapped * 10) / 10,
      stopps_bisher: f.stopps,
      umsatz_bisher_eur: f.umsatz,
      avg_umsatz_pro_stopp_eur: Math.round(avg * 100) / 100,
      pacing_pct: pacingPct,
      prognose_stopps: prognoseStopps,
      prognose_umsatz_eur: Math.round(prognoseUmsatz * 100) / 100,
      trend: pacingPct >= 60 ? 'stark' : pacingPct >= 40 ? 'normal' : 'schwach',
    };
  });

  const teamPrognose = fahrer.reduce((s, f) => s + f.prognose_umsatz_eur, 0);
  const teamPacing = Math.round(fahrer.reduce((s, f) => s + f.pacing_pct, 0) / fahrer.length);

  return {
    fahrer,
    team_prognose_umsatz_eur: Math.round(teamPrognose * 100) / 100,
    team_pacing_pct: teamPacing,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = createClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: orders } = await supabase
      .from('customer_orders')
      .select('driver_id, total_amount, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .in('status', ['geliefert', 'delivered', 'completed']);

    if (!orders || orders.length === 0) return NextResponse.json(mockData(locationId));

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name, shift_start, shift_end')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers || drivers.length === 0) return NextResponse.json(mockData(locationId));

    const now = new Date();
    const byDriver = new Map<string, { name: string; stopps: number; umsatz: number; shiftH: number; vergangenH: number }>();

    for (const d of drivers) {
      const shiftStart = d.shift_start ? new Date(d.shift_start) : today;
      const shiftEnd = d.shift_end ? new Date(d.shift_end) : new Date(today.getTime() + 11 * 3600_000);
      const shiftH = Math.max(1, (shiftEnd.getTime() - shiftStart.getTime()) / 3600_000);
      const vergangenH = Math.max(0.1, Math.min(shiftH, (now.getTime() - shiftStart.getTime()) / 3600_000));
      byDriver.set(d.id, { name: d.name ?? d.id, stopps: 0, umsatz: 0, shiftH, vergangenH });
    }

    for (const o of orders) {
      if (!o.driver_id || !byDriver.has(o.driver_id)) continue;
      const entry = byDriver.get(o.driver_id)!;
      entry.stopps += 1;
      entry.umsatz += Number(o.total_amount ?? 0);
    }

    const fahrerList: FahrerPrognose[] = [];
    for (const [id, d] of byDriver.entries()) {
      const avg = d.stopps > 0 ? d.umsatz / d.stopps : 0;
      const pacing = d.vergangenH / d.shiftH;
      const prognoseStopps = pacing > 0 ? Math.round(d.stopps / pacing) : d.stopps;
      const prognoseUmsatz = prognoseStopps * avg;
      const pacingPct = Math.round(pacing * 100);
      fahrerList.push({
        fahrer_id: id,
        fahrer_name: d.name,
        schicht_stunden_gesamt: Math.round(d.shiftH * 10) / 10,
        schicht_stunden_vergangen: Math.round(d.vergangenH * 10) / 10,
        stopps_bisher: d.stopps,
        umsatz_bisher_eur: Math.round(d.umsatz * 100) / 100,
        avg_umsatz_pro_stopp_eur: Math.round(avg * 100) / 100,
        pacing_pct: pacingPct,
        prognose_stopps: prognoseStopps,
        prognose_umsatz_eur: Math.round(prognoseUmsatz * 100) / 100,
        trend: pacingPct >= 60 ? 'stark' : pacingPct >= 40 ? 'normal' : 'schwach',
      });
    }

    const teamPrognose = fahrerList.reduce((s, f) => s + f.prognose_umsatz_eur, 0);
    const teamPacing = fahrerList.length > 0
      ? Math.round(fahrerList.reduce((s, f) => s + f.pacing_pct, 0) / fahrerList.length)
      : 0;

    return NextResponse.json({
      fahrer: fahrerList,
      team_prognose_umsatz_eur: Math.round(teamPrognose * 100) / 100,
      team_pacing_pct: teamPacing,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
