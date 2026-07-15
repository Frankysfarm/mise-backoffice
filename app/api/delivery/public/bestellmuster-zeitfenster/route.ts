/**
 * GET /api/delivery/public/bestellmuster-zeitfenster?location_id=<uuid>
 *
 * Phase 1746 — Bestellmuster-Zeitfenster (Storefront Backend)
 * Historisches Bestellmuster je Stunde → Hochlast-Erkennung; kein Auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildMock(): object {
  const h = new Date().getHours();
  const hochlast = [12, 13, 18, 19, 20, 21].includes(h);
  const sehrBelebt = [19, 20].includes(h);
  return {
    ist_hochlast: hochlast,
    stunde: h,
    beliebtheitsstufe: sehrBelebt ? 'sehr_belebt' : hochlast ? 'belebt' : 'normal',
    relative_auslastung: sehrBelebt ? 0.9 : hochlast ? 0.7 : 0.4,
    eta_aufschlag_min: sehrBelebt ? 10 : hochlast ? 5 : 0,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const h = new Date().getHours();

  try {
    const supabase = await createClient();
    const vor30Tagen = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

    const { data } = await supabase
      .from('customer_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', vor30Tagen)
      .not('created_at', 'is', null);

    if (!data || data.length === 0) {
      return NextResponse.json(buildMock());
    }

    const stundenZaehler = new Array(24).fill(0);
    const tagZaehler = new Array(24).fill(0);

    for (const o of data) {
      const d = new Date(o.created_at as string);
      stundenZaehler[d.getHours()]++;
      tagZaehler[d.getHours()]++;
    }

    const maxCount = Math.max(...stundenZaehler, 1);
    const currentCount = stundenZaehler[h];
    const relativ = currentCount / maxCount;

    const stufe =
      relativ >= 0.85 ? 'sehr_belebt' :
      relativ >= 0.6  ? 'belebt' :
      relativ >= 0.3  ? 'normal' : 'ruhig';

    const etaAufschlag = stufe === 'sehr_belebt' ? 10 : stufe === 'belebt' ? 5 : 0;

    return NextResponse.json({
      ist_hochlast: relativ >= 0.6,
      stunde: h,
      beliebtheitsstufe: stufe,
      relative_auslastung: Math.round(relativ * 100) / 100,
      eta_aufschlag_min: etaAufschlag,
    });
  } catch {
    return NextResponse.json(buildMock());
  }
}
