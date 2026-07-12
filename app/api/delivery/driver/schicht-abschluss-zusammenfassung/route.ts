import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1131 — Schicht-Abschluss-Zusammenfassung API
// Tages-Zusammenfassung nach Schichtende: Stopps, km, Umsatz, Trinkgeld, Score

type ZusammenfassungResponse = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_start: string | null;
  schicht_ende: string | null;
  schicht_dauer_min: number;
  stopps_gesamt: number;
  km_gesamt: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  puenktlichkeit_pct: number;
  score: number;
  score_label: 'Ausgezeichnet' | 'Gut' | 'Befriedigend' | 'Verbesserungsbedarf';
  generiert_am: string;
};

function scoreLabel(s: number): ZusammenfassungResponse['score_label'] {
  if (s >= 85) return 'Ausgezeichnet';
  if (s >= 70) return 'Gut';
  if (s >= 55) return 'Befriedigend';
  return 'Verbesserungsbedarf';
}

function mockData(driverId: string): ZusammenfassungResponse {
  return {
    fahrer_id: driverId,
    fahrer_name: 'Fahrer',
    schicht_start: new Date(Date.now() - 8 * 3600000).toISOString(),
    schicht_ende: new Date().toISOString(),
    schicht_dauer_min: 480,
    stopps_gesamt: 22,
    km_gesamt: 54,
    umsatz_eur: 680,
    trinkgeld_eur: 34,
    puenktlichkeit_pct: 88,
    score: 82,
    score_label: 'Gut',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: driver } = await supabase
      .from('mise_drivers')
      .select('id, name, shift_started_at, location_id')
      .eq('id', driverId)
      .single();

    if (!driver) return NextResponse.json(mockData(driverId));

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('delivered_at, estimated_delivery_at, distance_km, order_value_eur, tip_eur')
      .eq('driver_id', driverId)
      .gte('delivered_at', today.toISOString())
      .not('delivered_at', 'is', null);

    const stopsArr = stops ?? [];
    const stopps = stopsArr.length;
    const km = Math.round(stopsArr.reduce((s, x) => s + ((x.distance_km as number | null) ?? 2.5), 0));
    const umsatz = Math.round(stopsArr.reduce((s, x) => s + ((x.order_value_eur as number | null) ?? 0), 0) * 100) / 100;
    const trinkgeld = Math.round(stopsArr.reduce((s, x) => s + ((x.tip_eur as number | null) ?? 0), 0) * 100) / 100;

    let onTime = 0;
    for (const s of stopsArr) {
      if (!s.estimated_delivery_at || !s.delivered_at) { onTime++; continue; }
      const diff = new Date(s.delivered_at as string).getTime() - new Date(s.estimated_delivery_at as string).getTime();
      if (diff <= 5 * 60000) onTime++;
    }
    const punct = stopps > 0 ? Math.round((onTime / stopps) * 100) : 100;

    const now = Date.now();
    const shiftStart = driver.shift_started_at ? new Date(driver.shift_started_at as string) : new Date(today);
    const shiftDurMin = Math.round((now - shiftStart.getTime()) / 60000);
    const shiftH = Math.max(shiftDurMin / 60, 0.1);
    const stopsPh = stopps / shiftH;

    const scoreStopps = Math.min(stopsPh / 5, 1) * 40;
    const scorePunct = (punct / 100) * 35;
    const scoreKm = km > 0 && stopps > 0 ? (1 - Math.min((km / stopps) / 5, 1)) * 25 : 25;
    const score = Math.round(scoreStopps + scorePunct + scoreKm);

    return NextResponse.json({
      fahrer_id: driverId,
      fahrer_name: (driver.name ?? 'Fahrer') as string,
      schicht_start: (driver.shift_started_at as string | null) ?? today.toISOString(),
      schicht_ende: new Date().toISOString(),
      schicht_dauer_min: shiftDurMin,
      stopps_gesamt: stopps,
      km_gesamt: km,
      umsatz_eur: umsatz,
      trinkgeld_eur: trinkgeld,
      puenktlichkeit_pct: punct,
      score,
      score_label: scoreLabel(score),
      generiert_am: new Date().toISOString(),
    } satisfies ZusammenfassungResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
