import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });

  const supabase = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from('orders')
    .select('created_at, delivered_at, estimated_delivery_at')
    .eq('location_id', locationId)
    .eq('is_delivery', true)
    .not('delivered_at', 'is', null)
    .gte('created_at', sevenDaysAgo.toISOString());

  type OrderRow = { created_at: string; delivered_at: string | null; estimated_delivery_at: string | null };
  const orders: OrderRow[] = (data as OrderRow[] | null) ?? [];
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const vergangeneOrders = orders.filter((o) => new Date(o.created_at) < todayStart);

  function durchschnittMinuten(liste: OrderRow[]): number | null {
    const zeiten = liste
      .filter((o) => o.delivered_at && o.created_at)
      .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60_000);
    if (zeiten.length === 0) return null;
    return Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length);
  }

  const tempoHeute = durchschnittMinuten(todayOrders);
  const tempoSchnitt = durchschnittMinuten(vergangeneOrders);

  let status: 'schneller' | 'langsamer' | 'normal' | 'keine_daten' = 'keine_daten';
  let deltaPct = 0;

  if (tempoHeute !== null && tempoSchnitt !== null && tempoSchnitt > 0) {
    deltaPct = Math.round(((tempoHeute - tempoSchnitt) / tempoSchnitt) * 100);
    if (deltaPct <= -10) status = 'schneller';
    else if (deltaPct >= 10) status = 'langsamer';
    else status = 'normal';
  } else if (tempoHeute !== null) {
    status = 'normal';
  }

  return NextResponse.json({
    ok: true,
    tempoHeute,
    tempoSchnitt,
    deltaPct,
    status,
    lieferungenHeute: todayOrders.filter((o) => o.delivered_at).length,
    generatedAt: now.toISOString(),
  });
}
