/**
 * GET /api/delivery/admin/tagesabschluss-bericht?location_id=<uuid>
 *
 * Phase 686 — Tagesabschluss-Bericht-API
 * Aggregiert Tagesumsatz, Touren, SLA-Pct, Stornos für Location-Reporting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface TagesabschlussBericht {
  datum: string;
  umsatz_gesamt: number;
  bestellungen_gesamt: number;
  lieferungen: number;
  abholungen: number;
  stornos: number;
  storno_rate_pct: number;
  touren_gesamt: number;
  avg_lieferzeit_min: number | null;
  sla_pct: number | null;
  top_artikel: Array<{ name: string; menge: number }>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const heute = new Date();
    const startOfDay = new Date(heute);
    startOfDay.setHours(0, 0, 0, 0);

    const [ordersRes, batchesRes, itemsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, order_type, total_amount, created_at, completed_at, promised_at')
        .eq('location_id', locationId)
        .gte('created_at', startOfDay.toISOString()),
      supabase
        .from('delivery_batches')
        .select('id, status, completed_at')
        .eq('location_id', locationId)
        .gte('created_at', startOfDay.toISOString()),
      supabase
        .from('order_items')
        .select('order_id, product_name, name, quantity')
        .in(
          'order_id',
          (
            await supabase
              .from('orders')
              .select('id')
              .eq('location_id', locationId)
              .gte('created_at', startOfDay.toISOString())
          ).data?.map((o) => o.id as string) ?? [],
        ),
    ]);

    const orders = ordersRes.data ?? [];
    const batches = batchesRes.data ?? [];

    const completed = orders.filter((o) => o.status !== 'cancelled');
    const stornos = orders.filter((o) => o.status === 'cancelled').length;

    const umsatz = completed.reduce((s, o) => s + ((o.total_amount as number | null) ?? 0), 0);
    const lieferungen = orders.filter((o) => o.order_type === 'delivery').length;
    const abholungen = orders.filter((o) => o.order_type !== 'delivery').length;

    // SLA: Bestellungen die rechtzeitig geliefert wurden
    const withSla = completed.filter((o) => o.completed_at && o.promised_at);
    const slaOk = withSla.filter(
      (o) => new Date(o.completed_at as string) <= new Date(o.promised_at as string),
    ).length;
    const slaPct = withSla.length > 0 ? Math.round((slaOk / withSla.length) * 100) : null;

    // Avg Lieferzeit
    const withTime = completed.filter((o) => o.completed_at && o.created_at);
    const avgMin =
      withTime.length > 0
        ? Math.round(
            withTime.reduce(
              (s, o) =>
                s + (new Date(o.completed_at as string).getTime() - new Date(o.created_at as string).getTime()),
              0,
            ) /
              withTime.length /
              60_000,
          )
        : null;

    // Top-Artikel
    const artikelCount = new Map<string, number>();
    for (const item of itemsRes.data ?? []) {
      const name = ((item.product_name ?? item.name ?? 'Artikel') as string).trim();
      artikelCount.set(name, (artikelCount.get(name) ?? 0) + ((item.quantity as number | null) ?? 1));
    }
    const topArtikel = [...artikelCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, menge]) => ({ name, menge }));

    const bericht: TagesabschlussBericht = {
      datum: startOfDay.toISOString().slice(0, 10),
      umsatz_gesamt: Math.round(umsatz * 100) / 100,
      bestellungen_gesamt: orders.length,
      lieferungen,
      abholungen,
      stornos,
      storno_rate_pct: orders.length > 0 ? Math.round((stornos / orders.length) * 100) : 0,
      touren_gesamt: batches.length,
      avg_lieferzeit_min: avgMin,
      sla_pct: slaPct,
      top_artikel: topArtikel,
    };

    return NextResponse.json({ bericht, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('[tagesabschluss-bericht]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
