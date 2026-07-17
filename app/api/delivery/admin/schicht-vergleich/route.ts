/**
 * Phase 2206 — Schicht-Vergleich-API
 *
 * GET /api/delivery/admin/schicht-vergleich?location_id=<uuid>
 * Vergleich heute vs. gestern vs. 7-Tage-Ø für Einnahmen/Stopps/km; Trend-Pfeile
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type TrendPfeil = 'hoch' | 'runter' | 'gleich';

export interface SchichtVergleichMetrik {
  heute: number;
  gestern: number;
  avg7: number;
  trend_gestern: TrendPfeil;
  trend_avg7: TrendPfeil;
  delta_gestern_pct: number;
  delta_avg7_pct: number;
  alert: boolean;
}

export interface SchichtVergleichAntwort {
  location_id: string;
  einnahmen: SchichtVergleichMetrik;
  stopps: SchichtVergleichMetrik;
  km: SchichtVergleichMetrik;
  generiert_am: string;
}

const MOCK: SchichtVergleichAntwort = {
  location_id: 'mock',
  einnahmen: { heute: 312.5, gestern: 287.0, avg7: 295.3, trend_gestern: 'hoch', trend_avg7: 'hoch', delta_gestern_pct: 8.9, delta_avg7_pct: 5.8, alert: false },
  stopps:    { heute: 24,    gestern: 21,    avg7: 22.4,  trend_gestern: 'hoch', trend_avg7: 'hoch', delta_gestern_pct: 14.3, delta_avg7_pct: 7.1, alert: false },
  km:        { heute: 187,   gestern: 204,   avg7: 198.5, trend_gestern: 'runter', trend_avg7: 'runter', delta_gestern_pct: -8.3, delta_avg7_pct: -5.8, alert: false },
  generiert_am: new Date().toISOString(),
};

function pfeil(delta: number): TrendPfeil {
  if (delta > 2) return 'hoch';
  if (delta < -2) return 'runter';
  return 'gleich';
}

function pct(heute: number, vergleich: number): number {
  if (vergleich === 0) return 0;
  return Math.round(((heute - vergleich) / vergleich) * 1000) / 10;
}

function metrik(heute: number, gestern: number, avg7: number, alertSchwelle = -15): SchichtVergleichMetrik {
  const delta_gestern_pct = pct(heute, gestern);
  const delta_avg7_pct = pct(heute, avg7);
  return {
    heute,
    gestern,
    avg7: Math.round(avg7 * 10) / 10,
    trend_gestern: pfeil(delta_gestern_pct),
    trend_avg7: pfeil(delta_avg7_pct),
    delta_gestern_pct,
    delta_avg7_pct,
    alert: delta_gestern_pct < alertSchwelle,
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const jetzt = new Date();
  const heuteStart = new Date(jetzt); heuteStart.setHours(0, 0, 0, 0);
  const gesternStart = new Date(heuteStart.getTime() - 86400000);
  const gesternEnde = new Date(heuteStart.getTime() - 1);
  const vor7 = new Date(heuteStart.getTime() - 7 * 86400000);

  try {
    const supabase = await createClient();

    async function sumPeriode(von: Date, bis: Date) {
      const { data } = await supabase
        .from('mise_delivery_batches')
        .select('revenue_eur, stop_count, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('delivered_at', von.toISOString())
        .lte('delivered_at', bis.toISOString());
      const rows = data ?? [];
      return {
        einnahmen: rows.reduce((s: number, r: { revenue_eur: number | null }) => s + (r.revenue_eur ?? 0), 0),
        stopps: rows.reduce((s: number, r: { stop_count: number | null }) => s + (r.stop_count ?? 0), 0),
        km: rows.reduce((s: number, r: { distance_km: number | null }) => s + (r.distance_km ?? 0), 0),
      };
    }

    const [heute, gestern, woche] = await Promise.all([
      sumPeriode(heuteStart, jetzt),
      sumPeriode(gesternStart, gesternEnde),
      sumPeriode(vor7, gesternEnde),
    ]);

    const avg7 = {
      einnahmen: woche.einnahmen / 7,
      stopps: woche.stopps / 7,
      km: woche.km / 7,
    };

    return NextResponse.json({
      location_id: locationId,
      einnahmen: metrik(Math.round(heute.einnahmen * 100) / 100, Math.round(gestern.einnahmen * 100) / 100, avg7.einnahmen, -15),
      stopps:    metrik(heute.stopps, gestern.stopps, avg7.stopps, -20),
      km:        metrik(Math.round(heute.km * 10) / 10, Math.round(gestern.km * 10) / 10, avg7.km, -20),
      generiert_am: jetzt.toISOString(),
    } satisfies SchichtVergleichAntwort);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
