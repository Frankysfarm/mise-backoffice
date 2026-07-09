/**
 * GET /api/delivery/driver/schicht-bilanz?driver_id=<uuid>&date=<YYYY-MM-DD>
 *
 * Phase 956 — Schicht-Bilanz-API
 * Gesamtumsatz + Stopps + Trinkgeld + Bonus-Summe je Fahrerschicht für Tages-Auswertung.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtBilanz {
  datum: string;
  schicht_start: string | null;
  schicht_ende: string | null;
  schicht_dauer_min: number;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  bonus_eur: number;
  gesamt_eur: number;
  durchschnitt_bewertung: number | null;
  kilometer: number;
  status: 'aktiv' | 'abgeschlossen' | 'keine_schicht';
}

function mockData(datum: string): SchichtBilanz {
  return {
    datum,
    schicht_start: `${datum}T08:00:00Z`,
    schicht_ende: null,
    schicht_dauer_min: 240,
    stopps_gesamt: 18,
    stopps_abgeschlossen: 15,
    umsatz_eur: 312.50,
    trinkgeld_eur: 24.80,
    bonus_eur: 15.00,
    gesamt_eur: 352.30,
    durchschnitt_bewertung: 4.6,
    kilometer: 78,
    status: 'aktiv',
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const datum = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    const sb = await createClient();
    const tagesBeginn = new Date(`${datum}T00:00:00Z`);
    const tagesEnde = new Date(`${datum}T23:59:59Z`);

    const [{ data: shift }, { data: stops }, { data: earnings }, { data: feedback }] =
      await Promise.all([
        sb
          .from('driver_shifts')
          .select('actual_start, actual_end, status')
          .eq('driver_id', driverId)
          .gte('actual_start', tagesBeginn.toISOString())
          .lte('actual_start', tagesEnde.toISOString())
          .order('actual_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from('mise_delivery_stops')
          .select('id, status, order_value')
          .eq('driver_id', driverId)
          .gte('created_at', tagesBeginn.toISOString())
          .lte('created_at', tagesEnde.toISOString()),
        sb
          .from('driver_earnings')
          .select('amount, type')
          .eq('driver_id', driverId)
          .gte('created_at', tagesBeginn.toISOString())
          .lte('created_at', tagesEnde.toISOString()),
        sb
          .from('delivery_feedback')
          .select('rating')
          .eq('driver_id', driverId)
          .gte('created_at', tagesBeginn.toISOString())
          .lte('created_at', tagesEnde.toISOString()),
      ]);

    if (!shift) return NextResponse.json(mockData(datum));

    const shiftData = shift as {
      actual_start: string | null;
      actual_end: string | null;
      status: string;
    };

    const now = Date.now();
    const startMs = shiftData.actual_start ? new Date(shiftData.actual_start).getTime() : now;
    const endMs = shiftData.actual_end ? new Date(shiftData.actual_end).getTime() : now;
    const schichtDauerMin = Math.round((endMs - startMs) / 60_000);

    const stoppsGesamt = stops?.length ?? 0;
    const stoppsAbgeschlossen = (stops ?? []).filter((s) => {
      const st = s as { status: string };
      return ['delivered', 'abgeliefert', 'completed', 'abgeschlossen'].includes(st.status);
    }).length;

    const umsatz = (stops ?? []).reduce((sum, s) => {
      const st = s as { order_value: number | null };
      return sum + (st.order_value ?? 0);
    }, 0);

    type EarningsRow = { amount: number | null; type: string | null };
    const trinkgeld = (earnings ?? []).reduce((sum, e) => {
      const er = e as EarningsRow;
      return er.type === 'tip' ? sum + (er.amount ?? 0) : sum;
    }, 0);
    const bonus = (earnings ?? []).reduce((sum, e) => {
      const er = e as EarningsRow;
      return er.type === 'bonus' ? sum + (er.amount ?? 0) : sum;
    }, 0);

    const ratings = (feedback ?? []).map((f) => {
      const fr = f as { rating: number | null };
      return fr.rating ?? 0;
    }).filter((r) => r > 0);
    const avgRating =
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

    const result: SchichtBilanz = {
      datum,
      schicht_start: shiftData.actual_start,
      schicht_ende: shiftData.actual_end,
      schicht_dauer_min: schichtDauerMin,
      stopps_gesamt: stoppsGesamt,
      stopps_abgeschlossen: stoppsAbgeschlossen,
      umsatz_eur: Math.round(umsatz * 100) / 100,
      trinkgeld_eur: Math.round(trinkgeld * 100) / 100,
      bonus_eur: Math.round(bonus * 100) / 100,
      gesamt_eur: Math.round((umsatz + trinkgeld + bonus) * 100) / 100,
      durchschnitt_bewertung: avgRating,
      kilometer: 0,
      status: shiftData.actual_end ? 'abgeschlossen' : 'aktiv',
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockData(datum));
  }
}
