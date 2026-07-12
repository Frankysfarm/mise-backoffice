import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1128 — Tages-Bestellmuster-Heatmap-API
// Bestellhäufigkeit nach Wochentag × Stunde als 7×24-Matrix der letzten 4 Wochen

type Cell = {
  wochentag: number; // 0=Mo … 6=So
  stunde: number;    // 0–23
  anzahl: number;
  intensitaet: 'leer' | 'niedrig' | 'mittel' | 'hoch' | 'peak';
};

type ApiResponse = {
  matrix: Cell[][];
  max_anzahl: number;
  peak_wochentag: number;
  peak_stunde: number;
  location_id: string | null;
  generiert_am: string;
};

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function intensitaet(count: number, max: number): Cell['intensitaet'] {
  if (max === 0 || count === 0) return 'leer';
  const pct = count / max;
  if (pct <= 0.15) return 'niedrig';
  if (pct <= 0.40) return 'mittel';
  if (pct <= 0.75) return 'hoch';
  return 'peak';
}

function buildMatrix(counts: number[][]): { matrix: Cell[][]; max: number; peakDay: number; peakHour: number } {
  let max = 0;
  let peakDay = 0;
  let peakHour = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (counts[d][h] > max) { max = counts[d][h]; peakDay = d; peakHour = h; }
    }
  }
  const matrix: Cell[][] = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => ({
      wochentag: d, stunde: h, anzahl: counts[d][h],
      intensitaet: intensitaet(counts[d][h], max),
    }))
  );
  return { matrix, max, peakDay, peakHour };
}

function mockData(locationId: string | null): ApiResponse {
  const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  // Simulate realistic patterns: lunch 11-13 + dinner 17-20, peaks Fr/Sa
  const PEAK_HOURS = [12, 13, 18, 19, 20];
  const SHOULDER = [11, 14, 17, 21];
  for (let d = 0; d < 7; d++) {
    const dayMult = d >= 4 ? 1.5 : 1.0; // Fr/Sa/So higher
    for (let h = 0; h < 24; h++) {
      let base = 0;
      if (PEAK_HOURS.includes(h)) base = Math.round((8 + Math.random() * 12) * dayMult);
      else if (SHOULDER.includes(h)) base = Math.round((3 + Math.random() * 6) * dayMult);
      else if (h >= 9 && h <= 22) base = Math.round(1 + Math.random() * 3);
      counts[d][h] = base;
    }
  }
  const { matrix, max, peakDay, peakHour } = buildMatrix(counts);
  return { matrix, max_anzahl: max, peak_wochentag: peakDay, peak_stunde: peakHour, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from('customer_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', since);

    if (error || !orders?.length) return NextResponse.json(mockData(locationId));

    const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const o of orders) {
      const d = new Date(o.created_at as string);
      // JS getDay() returns 0=Su … 6=Sa; convert to 0=Mo … 6=So
      const jsDay = d.getUTCDay();
      const day = jsDay === 0 ? 6 : jsDay - 1;
      const hour = d.getUTCHours();
      counts[day][hour] += 1;
    }

    // Normalize to 4-week average
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) counts[d][h] = Math.round(counts[d][h] / 4);

    const { matrix, max, peakDay, peakHour } = buildMatrix(counts);
    return NextResponse.json({ matrix, max_anzahl: max, peak_wochentag: peakDay, peak_stunde: peakHour, location_id: locationId, generiert_am: new Date().toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
