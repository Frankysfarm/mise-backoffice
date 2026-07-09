import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');

  try {
    const supabase = createClient();
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const yesterday = new Date(Date.now() - 86400000);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayStart = yesterday.toISOString();

    let qDrivers = supabase
      .from('mise_drivers')
      .select('id, first_name, last_name');
    if (locationId) qDrivers = qDrivers.eq('location_id', locationId);

    let qOrders = supabase
      .from('customer_orders')
      .select('driver_id, total_price, status, created_at, delivered_at, eta_minutes, driver_rating')
      .gte('created_at', startOfDay);
    if (locationId) qOrders = qOrders.eq('location_id', locationId);

    let qOrdersYesterday = supabase
      .from('customer_orders')
      .select('driver_id, status, delivered_at, eta_minutes, driver_rating')
      .gte('created_at', yesterdayStart)
      .lt('created_at', startOfDay);
    if (locationId) qOrdersYesterday = qOrdersYesterday.eq('location_id', locationId);

    const [driversRes, ordersRes, ordersYestRes] = await Promise.all([qDrivers, qOrders, qOrdersYesterday]);
    const drivers = driversRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const ordersYest = ordersYestRes.data ?? [];

    const fahrerRows = drivers.map(d => {
      const myOrders = orders.filter(o => o.driver_id === d.id);
      const myYest = ordersYest.filter(o => o.driver_id === d.id);
      const delivered = myOrders.filter(o => o.status === 'delivered' || o.status === 'geliefert');

      const lieferungen = delivered.length;
      const withTime = delivered.filter(o => o.delivered_at && o.created_at);
      const avg_lieferzeit_min = withTime.length > 0
        ? Math.round(withTime.reduce((s, o) => s + (new Date(o.delivered_at!).getTime() - new Date(o.created_at!).getTime()) / 60000, 0) / withTime.length)
        : 0;

      const withEta = delivered.filter(o => o.eta_minutes && o.delivered_at);
      const puenktlich = withEta.filter(o => {
        const actualMin = (new Date(o.delivered_at!).getTime() - new Date(o.created_at!).getTime()) / 60000;
        return actualMin <= (o.eta_minutes ?? 30);
      }).length;
      const pünktlichkeit_pct = withEta.length > 0 ? Math.round((puenktlich / withEta.length) * 100) : 0;

      const withRating = delivered.filter(o => o.driver_rating);
      const bewertung = withRating.length > 0
        ? Math.round((withRating.reduce((s, o) => s + Number(o.driver_rating), 0) / withRating.length) * 10) / 10
        : 0;

      const effizienz_score = Math.round(
        (pünktlichkeit_pct * 0.4) + (Math.min(lieferungen / 10, 1) * 30) + ((bewertung / 5) * 30)
      );

      const myYestDelivered = myYest.filter(o => o.status === 'delivered' || o.status === 'geliefert');
      const yesterdayScore = Math.round(
        (myYestDelivered.length / Math.max(lieferungen, 1)) * 50 + effizienz_score * 0.5
      );
      const trend: 'up' | 'down' | 'flat' = effizienz_score > yesterdayScore + 5 ? 'up'
        : effizienz_score < yesterdayScore - 5 ? 'down' : 'flat';

      return {
        fahrer_id: d.id,
        name: `${d.first_name ?? ''} ${(d.last_name ?? '').charAt(0)}.`.trim(),
        lieferungen,
        pünktlichkeit_pct,
        avg_lieferzeit_min,
        bewertung,
        effizienz_score,
        trend,
      };
    }).filter(f => f.lieferungen > 0 || drivers.length <= 5);

    const scores = fahrerRows.map(f => f.effizienz_score).filter(s => s > 0);
    const team_avg_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return NextResponse.json({ fahrer: fahrerRows, team_avg_score });
  } catch {
    return NextResponse.json({ fahrer: [], team_avg_score: 0 });
  }
}
