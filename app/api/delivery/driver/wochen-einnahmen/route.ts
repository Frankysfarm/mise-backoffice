/**
 * GET /api/delivery/driver/wochen-einnahmen?driver_id=<uuid>
 *
 * Phase 696 — Fahrer-Wochen-Einnahmen-API
 * Liefereinnahmen + Trinkgeld diese Woche vs. Vorwoche je Fahrer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function fetchFahrerWoche(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driverId: string,
  von: Date,
  bis: Date,
): Promise<{ einnahmen: number; trinkgeld: number; touren: number }> {
  const [batchesRes, tipsRes] = await Promise.all([
    supabase
      .from('delivery_batches')
      .select('id, tip_amount, orders_count')
      .eq('driver_id', driverId)
      .in('status', ['completed', 'returned'])
      .gte('completed_at', von.toISOString())
      .lt('completed_at', bis.toISOString()),
    supabase
      .from('driver_tips')
      .select('amount')
      .eq('driver_id', driverId)
      .gte('created_at', von.toISOString())
      .lt('created_at', bis.toISOString()),
  ]);

  const batches = batchesRes.data ?? [];
  const touren = batches.length;

  const deliveryFeePerStop = 0.8;
  const einnahmen = batches.reduce(
    (s, b) => s + ((b.orders_count as number | null) ?? 1) * deliveryFeePerStop,
    0,
  );

  const trinkgeld =
    (tipsRes.data ?? []).reduce((s, t) => s + ((t.amount as number | null) ?? 0), 0) +
    batches.reduce((s, b) => s + ((b.tip_amount as number | null) ?? 0), 0);

  return {
    einnahmen: Math.round(einnahmen * 100) / 100,
    trinkgeld: Math.round(trinkgeld * 100) / 100,
    touren,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const vormonday = new Date(monday);
    vormonday.setDate(monday.getDate() - 7);

    const [aktuell, vorwoche] = await Promise.all([
      fetchFahrerWoche(supabase, driverId, monday, now),
      fetchFahrerWoche(supabase, driverId, vormonday, monday),
    ]);

    const deltaPct =
      vorwoche.einnahmen > 0
        ? Math.round(((aktuell.einnahmen - vorwoche.einnahmen) / vorwoche.einnahmen) * 100)
        : 0;

    return NextResponse.json({
      aktuell_eur: aktuell.einnahmen,
      vorwoche_eur: vorwoche.einnahmen,
      delta_pct: deltaPct,
      aktuell_touren: aktuell.touren,
      vorwoche_touren: vorwoche.touren,
      aktuell_trinkgeld: aktuell.trinkgeld,
      vorwoche_trinkgeld: vorwoche.trinkgeld,
      generiert_am: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[wochen-einnahmen]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
