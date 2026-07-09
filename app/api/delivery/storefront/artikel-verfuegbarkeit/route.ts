/**
 * GET /api/delivery/storefront/artikel-verfuegbarkeit?location_id=<uuid>&item_ids=<id1,id2,...>
 *
 * Phase 960 — Produktverfügbarkeits-Indikator (Storefront)
 * Liefert Verfügbarkeitsstatus je Artikel: verfügbar / wenige_uebrig / ausverkauft.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VerfuegbarkeitsStatus = 'verfuegbar' | 'wenige_uebrig' | 'ausverkauft';

interface ArtikelVerfuegbarkeit {
  item_id: string;
  status: VerfuegbarkeitsStatus;
  anzahl_uebrig: number | null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const itemIdsRaw = url.searchParams.get('item_ids');

  if (!locationId || !itemIdsRaw) {
    return NextResponse.json({ items: [] });
  }

  const itemIds = itemIdsRaw.split(',').filter(Boolean).slice(0, 100);

  try {
    const sb = await createClient();

    const { data: stockData } = await sb
      .from('menu_item_stock')
      .select('item_id, quantity, is_available')
      .eq('location_id', locationId)
      .in('item_id', itemIds);

    if (!stockData || stockData.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items: ArtikelVerfuegbarkeit[] = (stockData as {
      item_id: string;
      quantity: number | null;
      is_available: boolean | null;
    }[]).map((row) => {
      const qty = row.quantity ?? null;
      let status: VerfuegbarkeitsStatus = 'verfuegbar';

      if (row.is_available === false || qty === 0) {
        status = 'ausverkauft';
      } else if (qty !== null && qty <= 3) {
        status = 'wenige_uebrig';
      }

      return { item_id: row.item_id, status, anzahl_uebrig: qty };
    });

    return NextResponse.json({ items, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
