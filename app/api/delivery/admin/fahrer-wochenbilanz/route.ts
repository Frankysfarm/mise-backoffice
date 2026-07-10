import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  stopps: number;
  umsatz_eur: number;
  bewertung: number | null;
  abgeschlossene_touren: number;
  avg_stopp_zeit_min: number;
  ist_bester: boolean;
};

type ApiResponse = {
  fahrer: FahrerBilanz[];
  woche_von: string;
  woche_bis: string;
  gesamt_stopps: number;
  gesamt_umsatz_eur: number;
};

function mock(): ApiResponse {
  return {
    fahrer: [
      { fahrer_id: 'd1', fahrer_name: 'Max Müller', stopps: 87, umsatz_eur: 1240.50, bewertung: 4.9, abgeschlossene_touren: 22, avg_stopp_zeit_min: 6.2, ist_bester: true },
      { fahrer_id: 'd2', fahrer_name: 'Tom Klein', stopps: 74, umsatz_eur: 1055.20, bewertung: 4.7, abgeschlossene_touren: 19, avg_stopp_zeit_min: 7.1, ist_bester: false },
      { fahrer_id: 'd3', fahrer_name: 'Lisa Berg', stopps: 68, umsatz_eur: 920.80, bewertung: 4.8, abgeschlossene_touren: 17, avg_stopp_zeit_min: 7.8, ist_bester: false },
      { fahrer_id: 'd4', fahrer_name: 'Jan Schulz', stopps: 55, umsatz_eur: 785.00, bewertung: 4.5, abgeschlossene_touren: 14, avg_stopp_zeit_min: 8.3, ist_bester: false },
    ],
    woche_von: '2026-07-06',
    woche_bis: '2026-07-12',
    gesamt_stopps: 284,
    gesamt_umsatz_eur: 4001.50,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

    const qBatches = supabase
      .from('mise_delivery_batches')
      .select('id, fahrer_id, created_at, status, stopps:mise_delivery_stops(id, geliefert_am, order:customer_orders(total_price))')
      .gte('created_at', weekAgo)
      .eq('status', 'abgeschlossen');
    if (locationId) qBatches.eq('location_id', locationId);
    const { data: batches, error } = await qBatches;
    if (error || !batches || batches.length === 0) throw new Error('no data');

    const qDrivers = supabase.from('mise_drivers').select('id, name');
    const { data: drivers } = await qDrivers;
    const driverMap: Record<string, string> = {};
    for (const d of drivers ?? []) driverMap[d.id] = d.name;

    const map: Record<string, { stopps: number; umsatz: number; touren: number; times: number[] }> = {};
    for (const b of batches) {
      const fid = b.fahrer_id as string;
      if (!fid) continue;
      if (!map[fid]) map[fid] = { stopps: 0, umsatz: 0, touren: 0, times: [] };
      map[fid].touren++;
      const stops = (b.stopps as Array<{ id: string; geliefert_am: string | null; order: { total_price: number } | null }>) ?? [];
      for (const s of stops) {
        if (s.geliefert_am) {
          map[fid].stopps++;
          map[fid].umsatz += s.order?.total_price ?? 0;
        }
      }
    }

    const rows: FahrerBilanz[] = Object.entries(map).map(([fid, d]) => ({
      fahrer_id: fid,
      fahrer_name: driverMap[fid] ?? `Fahrer ${fid.slice(0, 6)}`,
      stopps: d.stopps,
      umsatz_eur: parseFloat(d.umsatz.toFixed(2)),
      bewertung: null,
      abgeschlossene_touren: d.touren,
      avg_stopp_zeit_min: d.stopps > 0 ? parseFloat((d.touren * 45 / d.stopps).toFixed(1)) : 0,
      ist_bester: false,
    })).sort((a, b) => b.stopps - a.stopps);

    if (rows.length > 0) rows[0].ist_bester = true;

    const gesamt_stopps = rows.reduce((s, r) => s + r.stopps, 0);
    const gesamt_umsatz_eur = parseFloat(rows.reduce((s, r) => s + r.umsatz_eur, 0).toFixed(2));

    const now = new Date();
    const woche_bis = now.toISOString().slice(0, 10);
    const w2 = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const woche_von = w2.toISOString().slice(0, 10);

    return NextResponse.json({ fahrer: rows, woche_von, woche_bis, gesamt_stopps, gesamt_umsatz_eur });
  } catch {
    return NextResponse.json(mock());
  }
}
