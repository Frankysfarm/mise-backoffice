/**
 * GET /api/delivery/admin/wochen-performance-vergleich?location_id=<uuid>
 *
 * Phase 691 — Wochen-Performance-Vergleichs-API
 * Vergleicht aktuelle Woche vs. Vorwoche: Umsatz, Touren, SLA, Stornos.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface WochenKennzahl {
  umsatz: number;
  bestellungen: number;
  touren: number;
  storno_rate_pct: number;
  sla_pct: number | null;
  avg_lieferzeit_min: number | null;
}

export interface WochenPerformanceVergleich {
  aktuell: WochenKennzahl;
  vorwoche: WochenKennzahl;
  delta: {
    umsatz_pct: number;
    bestellungen_pct: number;
    touren_pct: number;
    storno_delta_pct: number;
    sla_delta_pct: number | null;
  };
}

async function fetchWocheDaten(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string,
  von: Date,
  bis: Date,
): Promise<WochenKennzahl> {
  const [ordersRes, batchesRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total_amount, order_type, completed_at, promised_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', von.toISOString())
      .lt('created_at', bis.toISOString()),
    supabase
      .from('delivery_batches')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', von.toISOString())
      .lt('created_at', bis.toISOString()),
  ]);

  const orders = ordersRes.data ?? [];
  const batches = batchesRes.data ?? [];

  const stornos = orders.filter((o) => o.status === 'cancelled').length;
  const completed = orders.filter((o) => o.status !== 'cancelled');
  const umsatz = completed.reduce((s, o) => s + ((o.total_amount as number | null) ?? 0), 0);

  const withSla = completed.filter((o) => o.completed_at && o.promised_at);
  const slaOk = withSla.filter(
    (o) => new Date(o.completed_at as string) <= new Date(o.promised_at as string),
  ).length;

  const withTime = completed.filter((o) => o.completed_at && o.created_at);
  const avgMin =
    withTime.length > 0
      ? Math.round(
          withTime.reduce(
            (s, o) =>
              s + (new Date(o.completed_at as string).getTime() - new Date(o.created_at as string).getTime()),
            0,
          ) / withTime.length / 60_000,
        )
      : null;

  return {
    umsatz: Math.round(umsatz * 100) / 100,
    bestellungen: orders.length,
    touren: batches.length,
    storno_rate_pct: orders.length > 0 ? Math.round((stornos / orders.length) * 100) : 0,
    sla_pct: withSla.length > 0 ? Math.round((slaOk / withSla.length) * 100) : null,
    avg_lieferzeit_min: avgMin,
  };
}

function deltaPct(neu: number, alt: number): number {
  if (alt === 0) return 0;
  return Math.round(((neu - alt) / alt) * 100);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
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
      fetchWocheDaten(supabase, locationId, monday, now),
      fetchWocheDaten(supabase, locationId, vormonday, monday),
    ]);

    const delta = {
      umsatz_pct: deltaPct(aktuell.umsatz, vorwoche.umsatz),
      bestellungen_pct: deltaPct(aktuell.bestellungen, vorwoche.bestellungen),
      touren_pct: deltaPct(aktuell.touren, vorwoche.touren),
      storno_delta_pct: aktuell.storno_rate_pct - vorwoche.storno_rate_pct,
      sla_delta_pct:
        aktuell.sla_pct !== null && vorwoche.sla_pct !== null
          ? aktuell.sla_pct - vorwoche.sla_pct
          : null,
    };

    return NextResponse.json({
      aktuell,
      vorwoche,
      delta,
      generiert_am: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[wochen-performance-vergleich]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
