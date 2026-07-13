/**
 * GET /api/delivery/driver/trinkgeld-woche
 *   ?driver_id=<uuid>
 *
 * Phase 1269 — Trinkgeld-Wochenübersicht API (Fahrer-App)
 * Summe + Ø Trinkgeld je Tag der laufenden Woche + Trend vs. Vorwoche.
 * Multi-Tenant via driver_id. Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TrinkgeldTag {
  datum: string;
  wochentag: string;
  summe_eur: number;
  anzahl: number;
  schnitt_eur: number;
}

export interface TrinkgeldWocheResponse {
  woche_summe_eur: number;
  woche_anzahl: number;
  woche_schnitt_eur: number;
  vorwoche_summe_eur: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_pct: number;
  tage: TrinkgeldTag[];
  driver_id: string;
  generiert_am: string;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function buildMock(driverId: string): TrinkgeldWocheResponse {
  const tage: TrinkgeldTag[] = [
    { datum: '2026-07-07', wochentag: 'Di', summe_eur: 4.50, anzahl: 3, schnitt_eur: 1.50 },
    { datum: '2026-07-08', wochentag: 'Mi', summe_eur: 6.00, anzahl: 4, schnitt_eur: 1.50 },
    { datum: '2026-07-09', wochentag: 'Do', summe_eur: 3.00, anzahl: 2, schnitt_eur: 1.50 },
    { datum: '2026-07-10', wochentag: 'Fr', summe_eur: 9.00, anzahl: 5, schnitt_eur: 1.80 },
    { datum: '2026-07-11', wochentag: 'Sa', summe_eur: 12.00, anzahl: 6, schnitt_eur: 2.00 },
    { datum: '2026-07-12', wochentag: 'So', summe_eur: 7.50, anzahl: 4, schnitt_eur: 1.88 },
    { datum: '2026-07-13', wochentag: 'Mo', summe_eur: 3.00, anzahl: 2, schnitt_eur: 1.50 },
  ];
  const summe = tage.reduce((s, t) => s + t.summe_eur, 0);
  const anzahl = tage.reduce((s, t) => s + t.anzahl, 0);
  return {
    woche_summe_eur: summe,
    woche_anzahl: anzahl,
    woche_schnitt_eur: anzahl > 0 ? Math.round((summe / anzahl) * 100) / 100 : 0,
    vorwoche_summe_eur: 38.50,
    trend: 'besser',
    trend_pct: 17,
    tage,
    driver_id: driverId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const sb = createClient();
    const now = new Date();

    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const { data: tips, error } = await (sb as any)
      .from('driver_tips')
      .select('amount_eur, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', prevWeekStart.toISOString());

    if (error || !tips?.length) return NextResponse.json(buildMock(driverId));

    const weekTips = tips.filter((t: { created_at: string }) => new Date(t.created_at) >= weekStart);
    const prevTips = tips.filter((t: { created_at: string }) => new Date(t.created_at) < weekStart);

    // Group by day
    const tagMap: Record<string, { summe: number; anzahl: number }> = {};
    weekTips.forEach((t: { amount_eur: number; created_at: string }) => {
      const d = t.created_at.slice(0, 10);
      if (!tagMap[d]) tagMap[d] = { summe: 0, anzahl: 0 };
      tagMap[d].summe += Number(t.amount_eur) || 0;
      tagMap[d].anzahl += 1;
    });

    const tage: TrinkgeldTag[] = Object.entries(tagMap)
      .map(([datum, { summe, anzahl }]) => ({
        datum,
        wochentag: WOCHENTAGE[new Date(datum).getDay()],
        summe_eur: Math.round(summe * 100) / 100,
        anzahl,
        schnitt_eur: anzahl > 0 ? Math.round((summe / anzahl) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.datum.localeCompare(b.datum));

    const woche_summe_eur = Math.round(weekTips.reduce((s: number, t: { amount_eur: number }) => s + (Number(t.amount_eur) || 0), 0) * 100) / 100;
    const woche_anzahl = weekTips.length;
    const vorwoche_summe_eur = Math.round(prevTips.reduce((s: number, t: { amount_eur: number }) => s + (Number(t.amount_eur) || 0), 0) * 100) / 100;

    const trendDiff = woche_summe_eur - vorwoche_summe_eur;
    const trend_pct = vorwoche_summe_eur > 0 ? Math.round(Math.abs(trendDiff / vorwoche_summe_eur) * 100) : 0;
    const trend: 'besser' | 'gleich' | 'schlechter' = trendDiff > 1 ? 'besser' : trendDiff < -1 ? 'schlechter' : 'gleich';

    return NextResponse.json({
      woche_summe_eur,
      woche_anzahl,
      woche_schnitt_eur: woche_anzahl > 0 ? Math.round((woche_summe_eur / woche_anzahl) * 100) / 100 : 0,
      vorwoche_summe_eur,
      trend,
      trend_pct,
      tage,
      driver_id: driverId,
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
