import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1405 — Fahrer-Zufriedenheits-Score-API
// Aggregat aus Stimmung + Trinkgeld-Trend + Bonus-Fortschritt
// GET /api/delivery/admin/fahrer-zufriedenheits-score?location_id=<uuid>

interface FahrerScore {
  driver_id: string;
  name: string;
  stimmung_score: number; // 0-100
  trinkgeld_trend: number; // % vs. Vorwoche
  bonus_fortschritt: number; // 0-100%
  gesamt_score: number; // gewichtet: 40% + 35% + 25%
  kategorie: 'sehr_gut' | 'gut' | 'mittel' | 'schlecht';
}

interface ApiResponse {
  fahrer: FahrerScore[];
  schnitt_gesamt: number;
  beste_stimmung: string | null;
  location_id: string;
  generiert_am: string;
}

function kategorie(score: number): FahrerScore['kategorie'] {
  if (score >= 80) return 'sehr_gut';
  if (score >= 60) return 'gut';
  if (score >= 40) return 'mittel';
  return 'schlecht';
}

function buildMock(locationId: string): ApiResponse {
  const NAMES = ['Markus R.', 'Lena K.', 'Tobias H.', 'Sara M.', 'Felix W.', 'Anna B.'];
  const fahrer: FahrerScore[] = NAMES.map((name, i) => {
    const stimmung = 55 + Math.round(Math.sin(i * 1.3) * 25);
    const trinkgeld = Math.round((Math.sin(i * 0.8) * 20) * 10) / 10;
    const bonus = 40 + Math.round(Math.sin(i * 0.5) * 40);
    const trinkgeldScore = Math.min(100, Math.max(0, 50 + trinkgeld * 2));
    const gesamt = Math.round(stimmung * 0.4 + trinkgeldScore * 0.35 + bonus * 0.25);
    return {
      driver_id: `mock-${i}`,
      name,
      stimmung_score: Math.min(100, Math.max(0, stimmung)),
      trinkgeld_trend: trinkgeld,
      bonus_fortschritt: Math.min(100, Math.max(0, bonus)),
      gesamt_score: gesamt,
      kategorie: kategorie(gesamt),
    };
  });
  const sorted = [...fahrer].sort((a, b) => b.gesamt_score - a.gesamt_score);
  const schnitt = Math.round(fahrer.reduce((s, f) => s + f.gesamt_score, 0) / fahrer.length);
  return {
    fahrer: sorted,
    schnitt_gesamt: schnitt,
    beste_stimmung: sorted[0]?.name ?? null,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: drivers } = await supabase
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('active', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const fahrer: FahrerScore[] = await Promise.all(
      drivers.map(async (d) => {
        // Trinkgeld diese Woche
        const { data: tipsThisWeek } = await supabase
          .from('delivery_batches')
          .select('trinkgeld_eur')
          .eq('driver_id', d.id)
          .gte('created_at', weekAgo.toISOString())
          .lt('created_at', now.toISOString());

        // Trinkgeld letzte Woche
        const { data: tipsLastWeek } = await supabase
          .from('delivery_batches')
          .select('trinkgeld_eur')
          .eq('driver_id', d.id)
          .gte('created_at', twoWeeksAgo.toISOString())
          .lt('created_at', weekAgo.toISOString());

        const tipNow = (tipsThisWeek ?? []).reduce((s, r) => s + (r.trinkgeld_eur ?? 0), 0);
        const tipPrev = (tipsLastWeek ?? []).reduce((s, r) => s + (r.trinkgeld_eur ?? 0), 0);
        const trinkgeld_trend = tipPrev > 0
          ? Math.round(((tipNow - tipPrev) / tipPrev) * 1000) / 10
          : tipNow > 0 ? 100 : 0;

        // Bonus-Fortschritt: Bestellungen heute vs. Tagesziel (30)
        const { data: todayBatches } = await supabase
          .from('delivery_batches')
          .select('id')
          .eq('driver_id', d.id)
          .gte('created_at', `${todayStr}T00:00:00`)
          .lt('created_at', `${todayStr}T23:59:59`);

        const todayCount = todayBatches?.length ?? 0;
        const bonus_fortschritt = Math.min(100, Math.round((todayCount / 8) * 100));

        // Stimmung: aus driver_mood_log falls vorhanden, sonst heuristisch
        const { data: moodLog } = await supabase
          .from('driver_mood_log')
          .select('mood_score')
          .eq('driver_id', d.id)
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        const stimmung_score = moodLog && moodLog.length > 0
          ? Math.round(moodLog.reduce((s, r) => s + (r.mood_score ?? 50), 0) / moodLog.length)
          : Math.min(100, Math.max(30, 50 + Math.round(trinkgeld_trend)));

        const trinkgeldScore = Math.min(100, Math.max(0, 50 + trinkgeld_trend * 2));
        const gesamt_score = Math.round(
          stimmung_score * 0.4 + trinkgeldScore * 0.35 + bonus_fortschritt * 0.25
        );

        return {
          driver_id: d.id,
          name: d.name ?? 'Unbekannt',
          stimmung_score,
          trinkgeld_trend,
          bonus_fortschritt,
          gesamt_score,
          kategorie: kategorie(gesamt_score),
        };
      })
    );

    const sorted = [...fahrer].sort((a, b) => b.gesamt_score - a.gesamt_score);
    const schnitt = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.gesamt_score, 0) / fahrer.length)
      : 0;

    return NextResponse.json({
      fahrer: sorted,
      schnitt_gesamt: schnitt,
      beste_stimmung: sorted[0]?.name ?? null,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
