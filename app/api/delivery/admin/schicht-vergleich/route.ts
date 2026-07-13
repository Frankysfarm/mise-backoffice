import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1361 — Schicht-Vergleich API
 *
 * GET: Aktuelle Schicht vs. Durchschnitt letzte 7 Tage.
 * Metriken: Stopps, Umsatz, Trinkgeld, Pünktlichkeit.
 * Supabase delivery_tours + Mock-Fallback.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtMetrik {
  stopps: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  puenktlich_pct: number;
  touren_anzahl: number;
}

interface DeltaMetrik {
  wert: number;
  delta_abs: number;
  delta_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface SchichtVergleichResponse {
  aktuell: SchichtMetrik;
  durchschnitt_7tage: SchichtMetrik;
  deltas: {
    stopps: DeltaMetrik;
    umsatz_eur: DeltaMetrik;
    trinkgeld_eur: DeltaMetrik;
    puenktlich_pct: DeltaMetrik;
  };
  schicht_datum: string;
  generiert_am: string;
}

function calcDelta(aktuellVal: number, schnittVal: number, hoeherIstBesser = true): DeltaMetrik {
  const delta_abs = aktuellVal - schnittVal;
  const delta_pct = schnittVal !== 0 ? Math.round((delta_abs / schnittVal) * 100) : 0;
  const trend: 'besser' | 'gleich' | 'schlechter' =
    Math.abs(delta_pct) < 2 ? 'gleich' : (hoeherIstBesser ? delta_abs > 0 : delta_abs < 0) ? 'besser' : 'schlechter';
  return { wert: aktuellVal, delta_abs: Math.round(delta_abs * 100) / 100, delta_pct, trend };
}

function buildMock(): SchichtVergleichResponse {
  const aktuell: SchichtMetrik = { stopps: 47, umsatz_eur: 612.50, trinkgeld_eur: 38.20, puenktlich_pct: 82, touren_anzahl: 6 };
  const schnitt: SchichtMetrik = { stopps: 42, umsatz_eur: 580.00, trinkgeld_eur: 34.00, puenktlich_pct: 78, touren_anzahl: 5 };
  return {
    aktuell,
    durchschnitt_7tage: schnitt,
    deltas: {
      stopps: calcDelta(aktuell.stopps, schnitt.stopps),
      umsatz_eur: calcDelta(aktuell.umsatz_eur, schnitt.umsatz_eur),
      trinkgeld_eur: calcDelta(aktuell.trinkgeld_eur, schnitt.trinkgeld_eur),
      puenktlich_pct: calcDelta(aktuell.puenktlich_pct, schnitt.puenktlich_pct),
    },
    schicht_datum: new Date().toISOString().slice(0, 10),
    generiert_am: new Date().toISOString(),
  };
}

function aggregate(rows: Array<{ stopps_abgeschlossen?: number | null; umsatz_eur?: number | null; trinkgeld_eur?: number | null; puenktlich_pct?: number | null }>): SchichtMetrik {
  if (!rows.length) return { stopps: 0, umsatz_eur: 0, trinkgeld_eur: 0, puenktlich_pct: 0, touren_anzahl: 0 };
  return {
    stopps: rows.reduce((s, r) => s + (r.stopps_abgeschlossen ?? 0), 0),
    umsatz_eur: Math.round(rows.reduce((s, r) => s + (r.umsatz_eur ?? 0), 0) * 100) / 100,
    trinkgeld_eur: Math.round(rows.reduce((s, r) => s + (r.trinkgeld_eur ?? 0), 0) * 100) / 100,
    puenktlich_pct: Math.round(rows.reduce((s, r) => s + (r.puenktlich_pct ?? 0), 0) / rows.length),
    touren_anzahl: rows.length,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) return NextResponse.json(buildMock());

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [todayRes, historyRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('stopps_abgeschlossen, umsatz_eur, trinkgeld_eur, puenktlich_pct')
        .eq('location_id', locationId)
        .gte('erstellt_am', todayStart.toISOString()),
      supabase
        .from('delivery_tours')
        .select('stopps_abgeschlossen, umsatz_eur, trinkgeld_eur, puenktlich_pct')
        .eq('location_id', locationId)
        .gte('erstellt_am', sevenDaysAgo.toISOString())
        .lt('erstellt_am', todayStart.toISOString()),
    ]);

    if (todayRes.error || historyRes.error) return NextResponse.json(buildMock());

    const aktuell = aggregate(todayRes.data ?? []);
    const histRaw = aggregate(historyRes.data ?? []);
    const schnitt: SchichtMetrik = {
      stopps: Math.round(histRaw.stopps / 7),
      umsatz_eur: Math.round((histRaw.umsatz_eur / 7) * 100) / 100,
      trinkgeld_eur: Math.round((histRaw.trinkgeld_eur / 7) * 100) / 100,
      puenktlich_pct: histRaw.puenktlich_pct,
      touren_anzahl: Math.round(histRaw.touren_anzahl / 7),
    };

    return NextResponse.json({
      aktuell,
      durchschnitt_7tage: schnitt,
      deltas: {
        stopps: calcDelta(aktuell.stopps, schnitt.stopps),
        umsatz_eur: calcDelta(aktuell.umsatz_eur, schnitt.umsatz_eur),
        trinkgeld_eur: calcDelta(aktuell.trinkgeld_eur, schnitt.trinkgeld_eur),
        puenktlich_pct: calcDelta(aktuell.puenktlich_pct, schnitt.puenktlich_pct),
      },
      schicht_datum: todayStart.toISOString().slice(0, 10),
      generiert_am: now.toISOString(),
    } satisfies SchichtVergleichResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
