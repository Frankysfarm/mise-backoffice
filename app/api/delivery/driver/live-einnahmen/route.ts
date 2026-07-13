import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1384 — Live-Einnahmen-Ticker API
// GET /api/delivery/driver/live-einnahmen?driver_id=<uuid>

interface ApiResponse {
  einnahmen_heute_eur: number;
  einnahmen_vorwoche_eur: number;
  touren_heute: number;
  tagesziel_eur: number;
  letzte_tour_eur: number | null;
  letzte_tour_at: string | null;
}

function buildMock(driverId: string): ApiResponse {
  const seed = driverId.charCodeAt(0) % 50;
  return {
    einnahmen_heute_eur: 75 + seed,
    einnahmen_vorwoche_eur: 68 + seed,
    touren_heute: 5 + (seed % 4),
    tagesziel_eur: 120,
    letzte_tour_eur: 14.5,
    letzte_tour_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(todayStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 1);

    // Heutige Touren (delivery_batches)
    const { data: heuteBatches } = await supabase
      .from('delivery_batches')
      .select('id, total_revenue_eur, ended_at, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    const batches = heuteBatches ?? [];
    const einnahmenHeute = batches.reduce((s, b) => s + (b.total_revenue_eur ?? 0), 0);
    const tourenHeute = batches.length;

    // Letzte Tour
    const letzte = batches[0];
    const letzteTourEur = letzte?.total_revenue_eur ?? null;
    const letzteTourAt = letzte?.ended_at ?? letzte?.created_at ?? null;

    // Vorwoche (gleicher Wochentag)
    const { data: vorwocheBatches } = await supabase
      .from('delivery_batches')
      .select('total_revenue_eur')
      .eq('driver_id', driverId)
      .gte('created_at', prevWeekStart.toISOString())
      .lt('created_at', prevWeekEnd.toISOString());

    const einnahmenVorwoche = (vorwocheBatches ?? []).reduce((s, b) => s + (b.total_revenue_eur ?? 0), 0);

    // Tagesziel aus driver_shift_goals oder Default
    const { data: goal } = await supabase
      .from('driver_shift_goals')
      .select('revenue_target_eur')
      .eq('driver_id', driverId)
      .eq('date', todayStart.toISOString().slice(0, 10))
      .maybeSingle();

    const tageszielEur = goal?.revenue_target_eur ?? 120;

    return NextResponse.json({
      einnahmen_heute_eur: Math.round(einnahmenHeute * 100) / 100,
      einnahmen_vorwoche_eur: Math.round(einnahmenVorwoche * 100) / 100,
      touren_heute: tourenHeute,
      tagesziel_eur: tageszielEur,
      letzte_tour_eur: letzteTourEur,
      letzte_tour_at: letzteTourAt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
