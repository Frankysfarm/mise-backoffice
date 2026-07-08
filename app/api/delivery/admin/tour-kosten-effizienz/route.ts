/**
 * GET /api/delivery/admin/tour-kosten-effizienz?location_id=<uuid>
 *
 * Phase 656 — Tour-Kosten-Effizienz-API (Backend)
 * Berechnet Kosten je aktiver Tour (Kraftstoff + Zeit) vs. Einnahmen als Margin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KM_KOSTEN = 0.18; // €/km (Kraftstoff-Pauschale)
const SCHICHT_STUNDENSATZ = 12.0; // €/Stunde (anteilige Lohnkosten)

export interface TourKosten {
  tour_id: string;
  fahrer: string;
  stops: number;
  km_geschaetzt: number;
  einnahmen: number;
  kosten_geschaetzt: number;
  margin: number;
  margin_pct: number;
  bewertung: 'gut' | 'mittel' | 'schlecht';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: batches, error: batchErr } = await supabase
      .from('delivery_batches')
      .select('id, driver_id, started_at, status')
      .eq('location_id', locationId)
      .in('status', ['in_transit', 'returning'])
      .order('started_at', { ascending: false });

    if (batchErr) throw batchErr;

    if (!batches || batches.length === 0) {
      return NextResponse.json({ touren: [], generiert_am: new Date().toISOString() });
    }

    const batchIds = batches.map((b) => b.id as string);
    const driverIds = [...new Set(batches.map((b) => b.driver_id as string).filter(Boolean))];

    const [stopsRes, ordersRes, driversRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('batch_id, id, distance_km')
        .in('batch_id', batchIds),
      supabase
        .from('orders')
        .select('batch_id, total_amount, delivery_fee')
        .in('batch_id', batchIds),
      supabase
        .from('mise_drivers')
        .select('id, vorname, nachname')
        .in('id', driverIds),
    ]);

    if (stopsRes.error) throw stopsRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (driversRes.error) throw driversRes.error;

    const stopsByBatch = new Map<string, number>();
    const kmByBatch = new Map<string, number>();
    for (const s of stopsRes.data ?? []) {
      const bid = s.batch_id as string;
      stopsByBatch.set(bid, (stopsByBatch.get(bid) ?? 0) + 1);
      kmByBatch.set(bid, (kmByBatch.get(bid) ?? 0) + ((s.distance_km as number | null) ?? 2.0));
    }

    const einnahmenByBatch = new Map<string, number>();
    for (const o of ordersRes.data ?? []) {
      const bid = o.batch_id as string;
      const fee = (o.delivery_fee as number | null) ?? 0;
      einnahmenByBatch.set(bid, (einnahmenByBatch.get(bid) ?? 0) + fee);
    }

    const driverMap = new Map<string, string>();
    for (const d of driversRes.data ?? []) {
      driverMap.set(
        d.id as string,
        `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
      );
    }

    const now = Date.now();

    const touren: TourKosten[] = batches.map((b) => {
      const bid = b.id as string;
      const stops = stopsByBatch.get(bid) ?? 1;
      const km = kmByBatch.get(bid) ?? stops * 2.0;
      const einnahmen = einnahmenByBatch.get(bid) ?? 0;
      const startedAt = b.started_at as string | null;
      const stunden = startedAt
        ? (now - new Date(startedAt).getTime()) / 3_600_000
        : 0.5;
      const kosten = km * KM_KOSTEN + stunden * SCHICHT_STUNDENSATZ;
      const margin = einnahmen - kosten;
      const margin_pct = einnahmen > 0 ? Math.round((margin / einnahmen) * 100) : 0;

      const bewertung: TourKosten['bewertung'] =
        margin_pct >= 50 ? 'gut' :
        margin_pct >= 25 ? 'mittel' : 'schlecht';

      return {
        tour_id: bid,
        fahrer: driverMap.get(b.driver_id as string) ?? 'Fahrer',
        stops,
        km_geschaetzt: Math.round(km * 10) / 10,
        einnahmen: Math.round(einnahmen * 100) / 100,
        kosten_geschaetzt: Math.round(kosten * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        margin_pct,
        bewertung,
      };
    });

    touren.sort((a, b) => b.margin_pct - a.margin_pct);

    return NextResponse.json({ touren, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('[tour-kosten-effizienz]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
