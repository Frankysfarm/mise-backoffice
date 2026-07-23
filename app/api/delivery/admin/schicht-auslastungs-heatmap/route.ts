/**
 * GET /api/delivery/admin/schicht-auslastungs-heatmap
 *   ?location_id=<uuid>
 *
 * Phase 1271 — Schicht-Auslastungs-Heatmap-API
 * Bestelldichte je Stunde (0–23) × Zone der letzten 7 Tage als 2D-Matrix.
 * Gibt Zonen-Liste + Stunden-Liste + Matrix[zone][stunde] = Anzahl Bestellungen zurück.
 * Multi-Tenant: location_id on every query. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface HeatmapZelle {
  zone: string;
  stunde: number;
  bestellungen: number;
  intensitaet: 'keine' | 'gering' | 'mittel' | 'hoch' | 'peak';
}

export interface SchichtAuslastungsHeatmapResponse {
  zonen: string[];
  stunden: number[];
  matrix: HeatmapZelle[];
  max_bestellungen: number;
  peak_zone: string | null;
  peak_stunde: number | null;
  location_id: string;
  generiert_am: string;
}

function intensitaetFor(val: number, max: number): HeatmapZelle['intensitaet'] {
  if (max === 0 || val === 0) return 'keine';
  const ratio = val / max;
  if (ratio >= 0.8) return 'peak';
  if (ratio >= 0.5) return 'hoch';
  if (ratio >= 0.25) return 'mittel';
  return 'gering';
}

function buildMock(locationId: string): SchichtAuslastungsHeatmapResponse {
  const zonen = ['Mitte', 'Nord', 'West', 'Süd'];
  const stunden = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const rawData: Record<string, Record<number, number>> = {
    Mitte: { 10: 3, 11: 8, 12: 22, 13: 28, 14: 18, 15: 12, 16: 9, 17: 14, 18: 31, 19: 38, 20: 29, 21: 17, 22: 6 },
    Nord:  { 10: 1, 11: 4, 12: 11, 13: 15, 14: 9,  15: 6,  16: 5,  17: 8,  18: 19, 19: 23, 20: 16, 21: 8,  22: 3 },
    West:  { 10: 2, 11: 6, 12: 16, 13: 19, 14: 13, 15: 8,  16: 7,  17: 11, 18: 24, 19: 29, 20: 20, 21: 12, 22: 4 },
    Süd:   { 10: 1, 11: 3, 12: 9,  13: 12, 14: 7,  15: 4,  16: 3,  17: 6,  18: 14, 19: 18, 20: 12, 21: 7,  22: 2 },
  };

  let max = 0;
  let peakZone: string | null = null;
  let peakStunde: number | null = null;

  const matrix: HeatmapZelle[] = [];
  for (const zone of zonen) {
    for (const stunde of stunden) {
      const val = rawData[zone]?.[stunde] ?? 0;
      if (val > max) { max = val; peakZone = zone; peakStunde = stunde; }
      matrix.push({ zone, stunde, bestellungen: val, intensitaet: 'gering' });
    }
  }
  for (const z of matrix) {
    z.intensitaet = intensitaetFor(z.bestellungen, max);
  }

  return { zonen, stunden, matrix, max_bestellungen: max, peak_zone: peakZone, peak_stunde: peakStunde, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await (sb as any)
      .from('customer_orders')
      .select('created_at, delivery_zone')
      .eq('location_id', locationId)
      .eq('order_type', 'lieferung')
      .gte('created_at', since)
      .not('delivery_zone', 'is', null);

    if (error || !orders?.length) return NextResponse.json(buildMock(locationId));

    const countMap: Record<string, Record<number, number>> = {};
    const zonenSet = new Set<string>();

    for (const o of orders) {
      const zone: string = o.delivery_zone ?? 'Unbekannt';
      const stunde: number = new Date(o.created_at).getHours();
      zonenSet.add(zone);
      if (!countMap[zone]) countMap[zone] = {};
      countMap[zone][stunde] = (countMap[zone][stunde] ?? 0) + 1;
    }

    const zonen = [...zonenSet].sort();
    const stundenSet = new Set<number>();
    for (const z of Object.values(countMap)) for (const h of Object.keys(z)) stundenSet.add(Number(h));
    const stunden = [...stundenSet].sort((a, b) => a - b);

    let max = 0;
    let peakZone: string | null = null;
    let peakStunde: number | null = null;

    const matrix: HeatmapZelle[] = [];
    for (const zone of zonen) {
      for (const stunde of stunden) {
        const val = countMap[zone]?.[stunde] ?? 0;
        if (val > max) { max = val; peakZone = zone; peakStunde = stunde; }
        matrix.push({ zone, stunde, bestellungen: val, intensitaet: 'gering' });
      }
    }
    for (const z of matrix) z.intensitaet = intensitaetFor(z.bestellungen, max);

    return NextResponse.json({ zonen, stunden, matrix, max_bestellungen: max, peak_zone: peakZone, peak_stunde: peakStunde, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
