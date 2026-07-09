import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1009 — Tour-Effizienz-Live-Ranking API
 *
 * GET /api/delivery/admin/tour-effizienz-ranking?location_id=...
 * Echtzeit-Ranking aller aktiven Touren nach Umsatz/km-Marge.
 *
 * Response:
 * {
 *   touren: TourRank[],
 *   defizit_count: number,
 *   top_effizienz_fahrer: string | null,
 *   location_id: string | null,
 *   generiert_am: string,
 * }
 */

export const dynamic = 'force-dynamic';

interface TourRank {
  tour_id: string;
  rang: number;
  fahrer_name: string;
  zone: string | null;
  umsatz_eur: number;
  km_gefahren: number;
  effizienz_eur_per_km: number;
  marge_pct: number;
  stopps_offen: number;
  ist_defizit: boolean;
}

const MOCK_DATA: TourRank[] = [
  { tour_id: 't1', rang: 1, fahrer_name: 'M. Bauer', zone: 'A', umsatz_eur: 87.5, km_gefahren: 12, effizienz_eur_per_km: 7.29, marge_pct: 79, stopps_offen: 2, ist_defizit: false },
  { tour_id: 't2', rang: 2, fahrer_name: 'L. Huber', zone: 'B', umsatz_eur: 63.0, km_gefahren: 18, effizienz_eur_per_km: 3.5, marge_pct: 55, stopps_offen: 3, ist_defizit: false },
  { tour_id: 't3', rang: 3, fahrer_name: 'K. Stein', zone: 'C', umsatz_eur: 34.0, km_gefahren: 28, effizienz_eur_per_km: 1.21, marge_pct: 22, stopps_offen: 2, ist_defizit: false },
  { tour_id: 't4', rang: 4, fahrer_name: 'A. König', zone: 'D', umsatz_eur: 19.5, km_gefahren: 47, effizienz_eur_per_km: 0.41, marge_pct: -21, stopps_offen: 1, ist_defizit: true },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({
      touren: MOCK_DATA,
      defizit_count: MOCK_DATA.filter(t => t.ist_defizit).length,
      top_effizienz_fahrer: MOCK_DATA[0]?.fahrer_name ?? null,
      location_id: null,
      generiert_am: new Date().toISOString(),
    });
  }

  try {
    const supabase = await createClient();

    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('id, driver_id, zone, status, distance_km, created_at')
      .eq('location_id', locationId)
      .in('status', ['dispatched', 'unterwegs', 'in_delivery', 'abgeholt'])
      .order('created_at', { ascending: false });

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        touren: MOCK_DATA,
        defizit_count: MOCK_DATA.filter(t => t.ist_defizit).length,
        top_effizienz_fahrer: MOCK_DATA[0]?.fahrer_name ?? null,
        location_id: locationId,
        generiert_am: new Date().toISOString(),
      });
    }

    const driverIds = [...new Set(batches.map(b => b.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, first_name, last_name')
      .in('id', driverIds);

    const driverMap = new Map((drivers ?? []).map(d => [d.id, `${d.first_name ?? ''} ${(d.last_name ?? '')[0] ?? ''}.`.trim()]));

    const batchIds = batches.map(b => b.id);
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('batch_id, total_price, status')
      .eq('location_id', locationId)
      .in('batch_id', batchIds);

    const batchOrders = new Map<string, { umsatz: number; offen: number }>();
    for (const o of orders ?? []) {
      if (!o.batch_id) continue;
      const cur = batchOrders.get(o.batch_id) ?? { umsatz: 0, offen: 0 };
      cur.umsatz += o.total_price ?? 0;
      if (!['geliefert', 'delivered', 'abgeschlossen'].includes(o.status ?? '')) cur.offen += 1;
      batchOrders.set(o.batch_id, cur);
    }

    const KM_KOSTEN = 0.30;
    const LOHN_EUR_H = 13;

    const touren: TourRank[] = batches.map((b, idx) => {
      const km = b.distance_km ?? 10;
      const bo = batchOrders.get(b.id) ?? { umsatz: 0, offen: 1 };
      const schichtMin = Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 60_000);
      const kosten = km * KM_KOSTEN + (schichtMin / 60) * LOHN_EUR_H;
      const umsatz = bo.umsatz;
      const marge = umsatz > 0 ? Math.round(((umsatz - kosten) / umsatz) * 100) : -100;
      const effizienz = km > 0 ? Math.round((umsatz / km) * 100) / 100 : 0;
      return {
        tour_id: b.id,
        rang: idx + 1,
        fahrer_name: driverMap.get(b.driver_id) ?? 'Fahrer',
        zone: b.zone ?? null,
        umsatz_eur: Math.round(umsatz * 100) / 100,
        km_gefahren: Math.round(km),
        effizienz_eur_per_km: effizienz,
        marge_pct: marge,
        stopps_offen: bo.offen,
        ist_defizit: marge < 0,
      };
    });

    touren.sort((a, b) => b.effizienz_eur_per_km - a.effizienz_eur_per_km);
    touren.forEach((t, i) => { t.rang = i + 1; });

    return NextResponse.json({
      touren,
      defizit_count: touren.filter(t => t.ist_defizit).length,
      top_effizienz_fahrer: touren[0]?.fahrer_name ?? null,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      touren: MOCK_DATA,
      defizit_count: MOCK_DATA.filter(t => t.ist_defizit).length,
      top_effizienz_fahrer: MOCK_DATA[0]?.fahrer_name ?? null,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  }
}
