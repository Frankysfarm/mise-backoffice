/**
 * GET /api/delivery/admin/tages-kosten?location_id=<uuid>
 *
 * Phase 1656 — Tages-Kosten-Hochrechnung-API
 * Materialkosten-Summe + Budget-Limit + Auslastungsgrad + Stunden-Breakdown.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOSTEN_ANTEIL = 0.30; // 30% Materialkosten-Anteil am Umsatz
const DEFAULT_BUDGET = 30000; // 300 € in Cent

interface StundenBreakdown {
  stunde: number;
  umsatz: number;
  kosten: number;
}

interface TagesKostenResponse {
  location_id: string;
  kosten_gesamt: number;
  budget_limit: number;
  auslastungs_pct: number;
  ampel: 'normal' | 'achtung' | 'kritisch';
  stunden: StundenBreakdown[];
  generiert_am: string;
}

function calcAmpel(kosten: number, budget: number): TagesKostenResponse['ampel'] {
  const pct = budget > 0 ? kosten / budget : 0;
  if (pct < 0.75) return 'normal';
  if (pct < 0.95) return 'achtung';
  return 'kritisch';
}

function buildMock(locationId: string): TagesKostenResponse {
  const now = new Date();
  const curHour = now.getHours();
  const stunden: StundenBreakdown[] = [];
  let kosten_gesamt = 0;

  for (let h = 6; h <= Math.min(curHour, 23); h++) {
    const umsatz = Math.round(Math.random() * 8000 + 2000);
    const kosten = Math.round(umsatz * KOSTEN_ANTEIL);
    stunden.push({ stunde: h, umsatz, kosten });
    kosten_gesamt += kosten;
  }

  const budget_limit = DEFAULT_BUDGET;
  return {
    location_id: locationId,
    kosten_gesamt,
    budget_limit,
    auslastungs_pct: Math.round((kosten_gesamt / budget_limit) * 100),
    ampel: calcAmpel(kosten_gesamt, budget_limit),
    stunden,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    let query = (sb as any)
      .from('orders')
      .select('gesamtbetrag, bestellt_am')
      .not('gesamtbetrag', 'is', null)
      .gte('bestellt_am', todayStart.toISOString());

    if (locationId !== 'all') {
      query = query.eq('location_id', locationId);
    }

    const { data: orders, error } = await query;
    if (error || !orders) return NextResponse.json(buildMock(locationId));

    // Stunden-Breakdown
    const byHour: Record<number, { umsatz: number; kosten: number }> = {};
    let kosten_gesamt = 0;

    for (const o of orders as Array<{ gesamtbetrag: number; bestellt_am: string }>) {
      const h = new Date(o.bestellt_am).getHours();
      if (!byHour[h]) byHour[h] = { umsatz: 0, kosten: 0 };
      const kosten = Math.round(o.gesamtbetrag * KOSTEN_ANTEIL);
      byHour[h].umsatz += o.gesamtbetrag;
      byHour[h].kosten += kosten;
      kosten_gesamt += kosten;
    }

    const stunden: StundenBreakdown[] = Object.entries(byHour)
      .map(([h, v]) => ({ stunde: Number(h), ...v }))
      .sort((a, b) => a.stunde - b.stunde);

    // Budget aus Supabase-Config oder Default
    const { data: cfg } = await (sb as any)
      .from('location_settings')
      .select('tages_kosten_budget')
      .eq('location_id', locationId)
      .single();

    const budget_limit = cfg?.tages_kosten_budget ?? DEFAULT_BUDGET;

    return NextResponse.json({
      location_id: locationId,
      kosten_gesamt,
      budget_limit,
      auslastungs_pct: Math.round((kosten_gesamt / budget_limit) * 100),
      ampel: calcAmpel(kosten_gesamt, budget_limit),
      stunden,
      generiert_am: new Date().toISOString(),
    } satisfies TagesKostenResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
