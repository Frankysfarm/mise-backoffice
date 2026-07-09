import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');

  try {
    const supabase = createClient();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString();
    const endOfLastWeekDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString();

    let queryToday = supabase
      .from('customer_orders')
      .select('total_price, created_at')
      .gte('created_at', startOfDay);
    if (locationId) queryToday = queryToday.eq('location_id', locationId);

    let queryLastWeek = supabase
      .from('customer_orders')
      .select('total_price, created_at')
      .gte('created_at', lastWeek)
      .lt('created_at', endOfLastWeekDay);
    if (locationId) queryLastWeek = queryLastWeek.eq('location_id', locationId);

    const [todayRes, lastWeekRes] = await Promise.all([queryToday, queryLastWeek]);

    const todayOrders = todayRes.data ?? [];
    const lastWeekOrders = lastWeekRes.data ?? [];

    const umsatz_heute = todayOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    const umsatz_vorwoche = lastWeekOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    const bestellungen_heute = todayOrders.length;
    const avg_bestellwert = bestellungen_heute > 0 ? umsatz_heute / bestellungen_heute : 0;
    const last_order_eur = todayOrders.length > 0
      ? Number(todayOrders[todayOrders.length - 1].total_price) || 0
      : 0;

    return NextResponse.json({
      umsatz_heute,
      umsatz_vorwoche,
      umsatz_ziel: umsatz_vorwoche * 1.1,
      bestellungen_heute,
      avg_bestellwert,
      last_order_eur,
      letzte_aktualisierung: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      umsatz_heute: 0,
      umsatz_vorwoche: 0,
      umsatz_ziel: 3200,
      bestellungen_heute: 0,
      avg_bestellwert: 0,
      last_order_eur: 0,
      letzte_aktualisierung: new Date().toISOString(),
    });
  }
}
