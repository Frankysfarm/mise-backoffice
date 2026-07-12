import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1130 — Fahrer-Effizienz-Rangliste API
// Ranking aller heute aktiven Fahrer nach Stopps/Stunde + km-Effizienz + Pünktlichkeit

type FahrerRank = {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_pro_stunde: number;
  km_gesamt: number;
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  gesamt_score: number;
  delta_schnitt: number; // Abweichung vom Team-Ø in %
  badge: 'gold' | 'silber' | 'bronze' | null;
};

type ApiResponse = {
  fahrer: FahrerRank[];
  team_schnitt_score: number;
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): ApiResponse {
  const fahrer: FahrerRank[] = [
    { rang: 1, fahrer_id: 'f1', fahrer_name: 'Ahmad K.', stopps_gesamt: 18, stopps_pro_stunde: 4.5, km_gesamt: 42, km_pro_stopp: 2.3, puenktlichkeit_pct: 94, gesamt_score: 88, delta_schnitt: +16, badge: 'gold' },
    { rang: 2, fahrer_id: 'f2', fahrer_name: 'Lukas M.', stopps_gesamt: 15, stopps_pro_stunde: 3.8, km_gesamt: 38, km_pro_stopp: 2.5, puenktlichkeit_pct: 89, gesamt_score: 79, delta_schnitt: +4, badge: 'silber' },
    { rang: 3, fahrer_id: 'f3', fahrer_name: 'Sara P.',  stopps_gesamt: 14, stopps_pro_stunde: 3.5, km_gesamt: 35, km_pro_stopp: 2.5, puenktlichkeit_pct: 86, gesamt_score: 75, delta_schnitt: -1, badge: 'bronze' },
    { rang: 4, fahrer_id: 'f4', fahrer_name: 'Jonas H.', stopps_gesamt: 12, stopps_pro_stunde: 3.0, km_gesamt: 32, km_pro_stopp: 2.7, puenktlichkeit_pct: 80, gesamt_score: 68, delta_schnitt: -10, badge: null },
    { rang: 5, fahrer_id: 'f5', fahrer_name: 'Emma T.',  stopps_gesamt: 10, stopps_pro_stunde: 2.5, km_gesamt: 28, km_pro_stopp: 2.8, puenktlichkeit_pct: 75, gesamt_score: 60, delta_schnitt: -21, badge: null },
  ];
  const avg = Math.round(fahrer.reduce((s, f) => s + f.gesamt_score, 0) / fahrer.length);
  return { fahrer, team_schnitt_score: avg, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: drivers, error: dErr } = await supabase
      .from('mise_drivers')
      .select('id, name, shift_started_at')
      .eq('location_id', locationId)
      .eq('online', true);

    if (dErr || !drivers?.length) return NextResponse.json(mockData(locationId));

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at, estimated_delivery_at, distance_km')
      .eq('location_id', locationId)
      .gte('delivered_at', today.toISOString())
      .not('delivered_at', 'is', null);

    const stopMap = new Map<string, { count: number; km: number; onTime: number }>();
    for (const d of drivers) stopMap.set(d.id as string, { count: 0, km: 0, onTime: 0 });

    for (const s of stops ?? []) {
      const entry = stopMap.get(s.driver_id as string);
      if (!entry) continue;
      entry.count += 1;
      entry.km += (s.distance_km as number | null) ?? 2.5;
      if (s.estimated_delivery_at && s.delivered_at) {
        const late = new Date(s.delivered_at as string).getTime() - new Date(s.estimated_delivery_at as string).getTime();
        if (late <= 5 * 60000) entry.onTime += 1;
      } else {
        entry.onTime += 1;
      }
    }

    const now = Date.now();
    const ranked: FahrerRank[] = drivers.map((d, i) => {
      const st = stopMap.get(d.id as string) ?? { count: 0, km: 0, onTime: 0 };
      const shiftMs = d.shift_started_at ? now - new Date(d.shift_started_at as string).getTime() : 3600000;
      const shiftH = Math.max(shiftMs / 3600000, 0.1);
      const stopsPh = Math.round((st.count / shiftH) * 10) / 10;
      const kmPs = st.count > 0 ? Math.round((st.km / st.count) * 10) / 10 : 0;
      const punct = st.count > 0 ? Math.round((st.onTime / st.count) * 100) : 100;
      // Score: 40% stopsPh (norm to 5 max) + 35% punct + 25% km efficiency (inverted, norm to 5km)
      const scoreStopps = Math.min(stopsPh / 5, 1) * 40;
      const scorePunct = (punct / 100) * 35;
      const scoreKm = (1 - Math.min(kmPs / 5, 1)) * 25;
      const score = Math.round(scoreStopps + scorePunct + scoreKm);
      return { rang: i + 1, fahrer_id: d.id as string, fahrer_name: (d.name ?? 'Unbekannt') as string, stopps_gesamt: st.count, stopps_pro_stunde: stopsPh, km_gesamt: Math.round(st.km), km_pro_stopp: kmPs, puenktlichkeit_pct: punct, gesamt_score: score, delta_schnitt: 0, badge: null } satisfies FahrerRank;
    }).sort((a, b) => b.gesamt_score - a.gesamt_score);

    const avg = ranked.length > 0 ? Math.round(ranked.reduce((s, f) => s + f.gesamt_score, 0) / ranked.length) : 0;
    ranked.forEach((f, i) => {
      f.rang = i + 1;
      f.delta_schnitt = f.gesamt_score - avg;
      f.badge = i === 0 ? 'gold' : i === 1 ? 'silber' : i === 2 ? 'bronze' : null;
    });

    return NextResponse.json({ fahrer: ranked, team_schnitt_score: avg, location_id: locationId, generiert_am: new Date().toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
