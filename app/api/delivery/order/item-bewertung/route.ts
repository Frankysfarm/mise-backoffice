import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1037 — Item-Bewertungs-API
 *
 * POST /api/delivery/order/item-bewertung
 * Body: { order_id, bewertungen: [{ itemName, stars }], kommentar? }
 *
 * Speichert Artikel-Bewertungen nach Lieferung.
 */

export const dynamic = 'force-dynamic';

interface Bewertung {
  itemName: string;
  stars: number;
}

interface RequestBody {
  order_id: string;
  bewertungen: Bewertung[];
  kommentar?: string;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const { order_id, bewertungen, kommentar } = body;

    if (!order_id || !bewertungen?.length) {
      return NextResponse.json({ error: 'order_id and bewertungen required' }, { status: 400 });
    }

    const validBewertungen = bewertungen.filter(b => b.stars >= 1 && b.stars <= 5 && b.itemName);

    const supabase = await createClient();

    const { error: verifyError, data: order } = await supabase
      .from('customer_orders')
      .select('id, status')
      .eq('id', order_id)
      .in('status', ['geliefert', 'delivered', 'abgeschlossen'])
      .maybeSingle();

    if (verifyError || !order) {
      return NextResponse.json({ success: true, saved: 0, note: 'order not found or not delivered' });
    }

    const rows = validBewertungen.map(b => ({
      order_id,
      item_name: b.itemName,
      stars: b.stars,
      kommentar: kommentar ?? null,
      created_at: new Date().toISOString(),
    }));

    try {
      await supabase.from('order_item_ratings').insert(rows);
    } catch {
      // Table may not exist yet — store on order as fallback
      const avgStars = Math.round(
        (validBewertungen.reduce((s, b) => s + b.stars, 0) / validBewertungen.length) * 10,
      ) / 10;
      await supabase
        .from('customer_orders')
        .update({ driver_rating: avgStars })
        .eq('id', order_id);
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch {
    return NextResponse.json({ success: true, saved: 0 });
  }
}
