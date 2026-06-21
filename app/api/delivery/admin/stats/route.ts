/**
 * GET /api/delivery/admin/stats
 *
 * action=storno_quote  — Stornoquote heute + Verlauf
 * period=today         — Umfassende Tages-KPIs für alle Dashboard-Komponenten
 *                        Liefert: total_orders, delivered_orders, cancelled_orders,
 *                        revenue, revenue_prev, orders_prev, avg_delivery_min,
 *                        on_time_rate, on_time_pct, active_drivers, orders_per_hour,
 *                        stops_per_hour, hourly_volume, topZone, peakHour, …
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action = searchParams.get('action');
  const period = searchParams.get('period');

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // ─── period=today ──────────────────────────────────────────────────────────
  if (period === 'today') {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const shiftStartMs = now.getTime() - 8 * 3_600_000; // gleitende 8h-Schicht

    const [
      { data: todayRows },
      { data: yesterdayRows },
      { data: perfRows },
      { data: driverRows },
    ] = await Promise.all([
      // heutige Lieferbestellungen
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag, created_at, geliefert_am, delivery_zone, eta_latest')
        .eq('location_id', locationId)
        .eq('typ', 'lieferung')
        .gte('created_at', todayStart.toISOString()),

      // gestrige Lieferbestellungen für Vergleich
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag, created_at')
        .eq('location_id', locationId)
        .eq('typ', 'lieferung')
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),

      // Liefer-Performance heute (avg_min, on_time)
      sb.from('delivery_performance')
        .select('delivery_min, on_time, recorded_at')
        .eq('location_id', locationId)
        .gte('recorded_at', todayStart.toISOString()),

      // aktive Fahrer (online)
      sb.from('mise_drivers')
        .select('id')
        .eq('location_id', locationId)
        .eq('is_online', true),
    ]);

    type OrderRow = {
      id: string;
      status: string;
      gesamtbetrag: number | null;
      created_at: string;
      geliefert_am?: string | null;
      delivery_zone?: string | null;
      eta_latest?: string | null;
    };

    type PerfRow = { delivery_min: number | null; on_time: boolean | null; recorded_at: string };

    const orders = (todayRows ?? []) as OrderRow[];
    const yesterday = (yesterdayRows ?? []) as OrderRow[];
    const perf = (perfRows ?? []) as PerfRow[];
    const activeDrivers = (driverRows ?? []).length;

    // ── Basis-Zählungen
    const deliveredOrders = orders.filter(
      (o) => o.status === 'geliefert' || o.status === 'delivered',
    );
    const cancelledOrders = orders.filter(
      (o) => o.status === 'storniert' || o.status === 'cancelled',
    );
    const pendingOrders = orders.filter((o) =>
      ['neu', 'angenommen', 'in_zubereitung', 'fertig', 'unterwegs'].includes(o.status),
    );

    const totalOrders = orders.length;
    const revenue = orders.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
    const revenueDelivered = deliveredOrders.reduce(
      (s, o) => s + (Number(o.gesamtbetrag) || 0),
      0,
    );
    const avgOrderValue = deliveredOrders.length > 0 ? revenueDelivered / deliveredOrders.length : 0;

    // ── Vergleich gestern
    const ordersYesterday = yesterday.length;
    const revenueYesterday = yesterday.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);

    // ── Performance-Metriken aus delivery_performance
    const deliveryMins = perf
      .map((p) => p.delivery_min)
      .filter((m): m is number => m != null && m > 0);
    const avgDeliveryMin =
      deliveryMins.length > 0
        ? Math.round(deliveryMins.reduce((a, b) => a + b, 0) / deliveryMins.length)
        : null;

    const onTimeCount = perf.filter((p) => p.on_time === true).length;
    const onTimeRate = perf.length > 0 ? onTimeCount / perf.length : null;
    const onTimePct = onTimeRate != null ? Math.round(onTimeRate * 100) : null;

    // ── Stündliches Volumen (hourly_volume für LieferdienstStundenEffizienzMatrix)
    const hourCountMap = new Map<number, number>();
    for (const o of orders) {
      const h = new Date(o.created_at).getHours();
      hourCountMap.set(h, (hourCountMap.get(h) ?? 0) + 1);
    }
    const hourlyVolume: { hour: number; count: number }[] = Array.from(
      hourCountMap.entries(),
    )
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    // Peak-Stunde
    const peakEntry =
      hourlyVolume.length > 0
        ? hourlyVolume.reduce((best, cur) => (cur.count > best.count ? cur : best))
        : null;
    const peakHour = peakEntry?.hour ?? null;

    // ── Top-Zone
    const zoneMap = new Map<string, number>();
    for (const o of deliveredOrders) {
      if (o.delivery_zone) {
        zoneMap.set(o.delivery_zone, (zoneMap.get(o.delivery_zone) ?? 0) + 1);
      }
    }
    const topZone =
      zoneMap.size > 0
        ? [...zoneMap.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
        : null;

    // ── Durchsatz-Metriken
    const shiftHours = Math.max(
      (now.getTime() - todayStart.getTime()) / 3_600_000,
      0.1,
    );
    const ordersPerHour = totalOrders > 0 ? Math.round((totalOrders / shiftHours) * 10) / 10 : 0;
    const stopsPerHour =
      deliveredOrders.length > 0
        ? Math.round((deliveredOrders.length / shiftHours) * 10) / 10
        : 0;

    // Schicht-Stündliche Zahlen (letzte 8h für Schicht-Bilanz)
    const schichtOrders = orders.filter(
      (o) => new Date(o.created_at).getTime() >= shiftStartMs,
    );
    const schichtRevenue = schichtOrders.reduce(
      (s, o) => s + (Number(o.gesamtbetrag) || 0),
      0,
    );

    return NextResponse.json({
      // Kern-KPIs (snake_case für alle Komponenten)
      total_orders: totalOrders,
      delivered_orders: deliveredOrders.length,
      cancelled_orders: cancelledOrders.length,
      pending_orders: pendingOrders.length,
      revenue,
      revenue_prev: revenueYesterday,
      orders_prev: ordersYesterday,
      avg_delivery_min: avgDeliveryMin,
      on_time_rate: onTimeRate,
      on_time_pct: onTimePct,
      avg_rating: null,
      active_drivers: activeDrivers,
      orders_per_hour: ordersPerHour,
      stops_per_hour: stopsPerHour,

      // camelCase-Aliase (für schicht-echtzeit-bilanz + schicht-leistungs-radar)
      orders: totalOrders,
      deliveries: deliveredOrders.length,
      revenue_eur: revenue,
      activeDrivers,
      avgDeliveryMin: avgDeliveryMin,
      onTimeRatePct: onTimePct,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      topZone,
      peakHour,

      // Stündliches Volumen für LieferdienstStundenEffizienzMatrix
      hourly_volume: hourlyVolume,

      // Schicht-Daten
      schicht_revenue: schichtRevenue,
      schicht_orders: schichtOrders.length,
    });
  }

  // ─── action=storno_quote ───────────────────────────────────────────────────
  if (action === 'storno_quote') {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const [{ data: todayOrders }, { data: yesterdayOrders }] = await Promise.all([
      sb.from('customer_orders')
        .select('id, status, storniert_am, stornogrund, gesamtbetrag, created_at, bestellnummer')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag, created_at')
        .eq('location_id', locationId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
    ]);

    const today = todayOrders ?? [];
    const yesterday = yesterdayOrders ?? [];

    const todayStorniert = today.filter((o: Record<string, unknown>) => o.status === 'storniert');
    const gesternStorniert = yesterday.filter((o: Record<string, unknown>) => o.status === 'storniert');

    const storno_quote = today.length > 0 ? (todayStorniert.length / today.length) * 100 : 0;
    const prev_quote = yesterday.length > 0 ? (gesternStorniert.length / yesterday.length) * 100 : 0;
    const verlust_eur = todayStorniert.reduce((s: number, o: Record<string, unknown>) => s + (Number(o.gesamtbetrag) || 0), 0);

    const grundMap = new Map<string, number>();
    for (const o of todayStorniert) {
      const g = (o.stornogrund as string) || 'Unbekannt';
      grundMap.set(g, (grundMap.get(g) ?? 0) + 1);
    }
    const gruende = Array.from(grundMap.entries())
      .map(([grund, count]) => ({ grund, count }))
      .sort((a, b) => b.count - a.count);

    const verlaufMap = new Map<string, { storniert: number; gesamt: number }>();
    for (let h = 0; h < 12; h++) {
      const hour = new Date(now.getTime() - (11 - h) * 3_600_000);
      verlaufMap.set(String(hour.getHours()).padStart(2, '0') + ':00', { storniert: 0, gesamt: 0 });
    }
    for (const o of today) {
      const h = new Date(o.created_at as string).getHours();
      const key = String(h).padStart(2, '0') + ':00';
      if (verlaufMap.has(key)) {
        verlaufMap.get(key)!.gesamt++;
        if ((o.status as string) === 'storniert') verlaufMap.get(key)!.storniert++;
      }
    }
    const verlauf = Array.from(verlaufMap.entries()).map(([stunde, v]) => ({ stunde, ...v }));

    const letzte_stornos = todayStorniert
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, 10)
      .map((o: Record<string, unknown>) => ({
        bestellnummer: o.bestellnummer,
        grund: o.stornogrund,
        storniert_am: o.storniert_am ?? o.created_at,
        gesamtbetrag: Number(o.gesamtbetrag) || 0,
      }));

    return NextResponse.json({
      heut_gesamt: today.length,
      heut_storniert: todayStorniert.length,
      storno_quote,
      prev_quote,
      verlust_eur,
      gruende,
      verlauf,
      letzte_stornos,
    });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
