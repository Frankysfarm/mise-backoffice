/**
 * GET /api/delivery/driver/schicht-einnahmen-zaehler?driver_id=<uuid>
 *
 * Phase 1774 — Schicht-Einnahmen-Zähler API (Fahrer-App)
 * Echtzeit-Einnahmen heute + Prognose bis Schichtende + Zielfortschritt.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SchichtEinnahmenZaehlerAntwort {
  fahrer_id: string;
  einnahmen_heute_eur: number;
  prognose_schicht_ende_eur: number;
  ziel_eur: number;
  ziel_fortschritt_pct: number;
  bestellungen_heute: number;
  schicht_dauer_h: number;
  generiert_am: string;
}

function buildMock(driverId: string): SchichtEinnahmenZaehlerAntwort {
  return {
    fahrer_id: driverId,
    einnahmen_heute_eur: 87.40,
    prognose_schicht_ende_eur: 132.60,
    ziel_eur: 150.00,
    ziel_fortschritt_pct: 58,
    bestellungen_heute: 11,
    schicht_dauer_h: 8,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select('total_earnings_eur, order_count, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', `${today}T00:00:00Z`);

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const einnahmen_heute_eur = tours.reduce((s: number, t: { total_earnings_eur?: number }) => s + (t.total_earnings_eur ?? 0), 0);
    const bestellungen_heute = tours.reduce((s: number, t: { order_count?: number }) => s + (t.order_count ?? 0), 0);

    // Get driver shift goal
    const { data: goalData } = await supabase
      .from('driver_shift_goals')
      .select('ziel_eur, schicht_dauer_h')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const ziel_eur = goalData?.ziel_eur ?? 150.00;
    const schicht_dauer_h = goalData?.schicht_dauer_h ?? 8;

    // Prognosis
    const now = new Date();
    const shiftStart = new Date(`${today}T10:00:00Z`);
    const elapsedH = Math.max(0.5, (now.getTime() - shiftStart.getTime()) / 3600000);
    const rate = einnahmen_heute_eur / elapsedH;
    const prognose_schicht_ende_eur = Math.max(einnahmen_heute_eur, Math.round(rate * schicht_dauer_h * 100) / 100);
    const ziel_fortschritt_pct = ziel_eur > 0 ? Math.min(100, Math.round(einnahmen_heute_eur / ziel_eur * 100)) : 0;

    return NextResponse.json({
      fahrer_id: driverId,
      einnahmen_heute_eur: Math.round(einnahmen_heute_eur * 100) / 100,
      prognose_schicht_ende_eur,
      ziel_eur,
      ziel_fortschritt_pct,
      bestellungen_heute,
      schicht_dauer_h,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtEinnahmenZaehlerAntwort);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
