import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1356 — Bestellungs-Durchsatz API
 *
 * GET: Bestellungen pro Stunde heute + Vergleich mit gestern.
 * Peak-Stunde + Prognose für nächste 2h.
 * Supabase customer_orders + Mock-Fallback.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StundenEintrag {
  stunde: number;    // 0-23
  label: string;     // "09:00"
  heute: number;
  gestern: number;
}

interface Response {
  stunden: StundenEintrag[];
  peak_stunde: number | null;
  peak_anzahl: number;
  gesamt_heute: number;
  gesamt_gestern: number;
  prognose_naechste_2h: number;
  generiert_am: string;
}

function buildMock(now: Date): Response {
  const h = now.getHours();
  const stunden: StundenEintrag[] = Array.from({ length: 24 }, (_, i) => {
    const base = i >= 11 && i <= 14 ? 8 : i >= 18 && i <= 21 ? 12 : i >= 7 && i <= 9 ? 5 : 1;
    return {
      stunde: i,
      label: `${String(i).padStart(2, '0')}:00`,
      heute: i <= h ? Math.max(0, base + Math.round((Math.random() - 0.5) * 4)) : 0,
      gestern: Math.max(0, base + Math.round((Math.random() - 0.5) * 3)),
    };
  });
  const peak = stunden.reduce((a, b) => (b.heute > a.heute ? b : a), stunden[0]);
  const prognose = stunden[h]?.heute
    ? Math.round(stunden[h].heute * 1.1 + stunden[(h + 1) % 24].gestern * 0.9)
    : 5;
  return {
    stunden,
    peak_stunde: peak.heute > 0 ? peak.stunde : null,
    peak_anzahl: peak.heute,
    gesamt_heute: stunden.reduce((s, e) => s + e.heute, 0),
    gesamt_gestern: stunden.reduce((s, e) => s + e.gestern, 0),
    prognose_naechste_2h: prognose,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const now = new Date();

  if (!locationId) {
    return NextResponse.json(buildMock(now));
  }

  try {
    const supabase = await createClient();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const [todayRes, yesterdayRes] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('created_at')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', now.toISOString()),
      supabase
        .from('customer_orders')
        .select('created_at')
        .eq('location_id', locationId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayEnd.toISOString()),
    ]);

    if (todayRes.error || yesterdayRes.error) throw new Error('DB error');

    const todayRows = todayRes.data ?? [];
    const yesterdayRows = yesterdayRes.data ?? [];

    const stunden: StundenEintrag[] = Array.from({ length: 24 }, (_, i) => ({
      stunde: i,
      label: `${String(i).padStart(2, '0')}:00`,
      heute: 0,
      gestern: 0,
    }));

    for (const row of todayRows) {
      const h = new Date(row.created_at).getHours();
      stunden[h].heute++;
    }
    for (const row of yesterdayRows) {
      const h = new Date(row.created_at).getHours();
      stunden[h].gestern++;
    }

    const currentH = now.getHours();
    const peak = stunden.slice(0, currentH + 1).reduce((a, b) => (b.heute > a.heute ? b : a), stunden[0]);
    const prognose = Math.round(
      (stunden[currentH]?.heute ?? 0) * 1.1 +
      (stunden[(currentH + 1) % 24]?.gestern ?? 0) * 0.9
    );

    const result: Response = {
      stunden,
      peak_stunde: peak.heute > 0 ? peak.stunde : null,
      peak_anzahl: peak.heute,
      gesamt_heute: todayRows.length,
      gesamt_gestern: yesterdayRows.length,
      prognose_naechste_2h: prognose,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(buildMock(now));
  }
}
