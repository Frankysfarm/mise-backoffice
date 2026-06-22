/**
 * GET /api/delivery/stats?location_id=...&from=ISO&to=ISO
 * Liefer-Statistiken für das Admin-Dashboard.
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
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // --- Schicht-Live-KPI (scope=shift) — für SchichtLiveKommando ---
  const scope = searchParams.get('scope');
  if (scope === 'shift') {
    const shiftHours = 8;
    const now = new Date();
    const shiftStart = new Date(now.getTime() - shiftHours * 3_600_000).toISOString();

    const [{ data: shiftOrders }, { data: activeBatches }, { data: lifecycles }] = await Promise.all([
      sb.from('customer_orders')
        .select('id, status, typ, delivery_zone, gesamtpreis, created_at')
        .eq('location_id', locationId)
        .gte('created_at', shiftStart),
      sb.from('mise_delivery_batches')
        .select('id, fahrer_id')
        .eq('location_id', locationId)
        .in('state', ['active', 'assigned']),
      sb.from('order_lifecycle_snapshots')
        .select('on_time, total_min')
        .eq('location_id', locationId)
        .gte('snapped_at', shiftStart),
    ]);

    const allOrders = shiftOrders ?? [];
    const deliveries = allOrders.filter((o) => o.typ === 'lieferung');
    const cancelled  = allOrders.filter((o) =>
      (o.status as string) === 'storniert' || (o.status as string) === 'abgebrochen'
    );
    const ordersCount = allOrders.length;
    const revenueEur  = allOrders
      .filter((o) => !['storniert', 'abgebrochen'].includes(o.status as string))
      .reduce((s, o) => s + ((o.gesamtpreis as number) ?? 0), 0);
    const cancelRate  = ordersCount > 0
      ? Math.round((cancelled.length / ordersCount) * 1000) / 10
      : 0;

    const lcRows = lifecycles ?? [];
    const onTimeRows = lcRows.filter((r) => r.on_time !== null);
    const onTimePct  = onTimeRows.length > 0
      ? Math.round(onTimeRows.filter((r) => r.on_time === true).length / onTimeRows.length * 100)
      : 0;
    const totalMins = lcRows.filter((r) => r.total_min != null).map((r) => r.total_min as number);
    const avgDeliveryMin = totalMins.length > 0
      ? Math.round(totalMins.reduce((s, v) => s + v, 0) / totalMins.length)
      : 0;

    const activeDrivers = new Set((activeBatches ?? []).map((b) => b.fahrer_id).filter(Boolean)).size;

    const shiftDurationH = (now.getTime() - new Date(shiftStart).getTime()) / 3_600_000;
    const ordersPerHour  = shiftDurationH > 0
      ? Math.round((ordersCount / shiftDurationH) * 10) / 10
      : 0;

    const zoneCounts = deliveries.reduce<Record<string, number>>((acc, o) => {
      const z = (o.delivery_zone as string) ?? 'unknown';
      acc[z] = (acc[z] ?? 0) + 1;
      return acc;
    }, {});
    const topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return NextResponse.json({
      orders_count:           ordersCount,
      revenue_eur:            Math.round(revenueEur * 100) / 100,
      avg_delivery_min:       avgDeliveryMin,
      on_time_pct:            onTimePct,
      active_drivers:         activeDrivers,
      cancellation_rate_pct:  cancelRate,
      orders_per_hour:        ordersPerHour,
      top_zone:               topZone,
    });
  }

  // --- Schicht-Pünktlichkeit ---
  if (action === 'shift_punctuality') {
    const shiftHours = 8;
    const now = new Date();
    const shiftStart = new Date(now.getTime() - shiftHours * 3_600_000).toISOString();
    const prevShiftStart = new Date(now.getTime() - 2 * shiftHours * 3_600_000).toISOString();

    const [{ data: current }, { data: prev }] = await Promise.all([
      sb.from('order_lifecycle_snapshots')
        .select('on_time, total_min')
        .eq('location_id', locationId)
        .gte('snapped_at', shiftStart),
      sb.from('order_lifecycle_snapshots')
        .select('on_time')
        .eq('location_id', locationId)
        .gte('snapped_at', prevShiftStart)
        .lt('snapped_at', shiftStart),
    ]);

    const rows = current ?? [];
    const totalDeliveries = rows.length;
    const onTimeCount = rows.filter((r) => r.on_time === true).length;
    const lateCount = totalDeliveries - onTimeCount;
    const onTimePct = totalDeliveries > 0 ? Math.round((onTimeCount / totalDeliveries) * 100) : null;

    const prevRows = prev ?? [];
    const prevTotal = prevRows.length;
    const prevOnTime = prevRows.filter((r) => r.on_time === true).length;
    const prevShiftPct = prevTotal > 0 ? Math.round((prevOnTime / prevTotal) * 100) : null;

    const lateTimes = rows
      .filter((r) => r.on_time === false && r.total_min != null)
      .map((r) => r.total_min as number);
    const avgDelayMin = lateTimes.length > 0
      ? Math.round((lateTimes.reduce((s, v) => s + v, 0) / lateTimes.length) * 10) / 10
      : null;

    return NextResponse.json({ onTimePct, totalDeliveries, onTimeCount, lateCount, prevShiftPct, avgDelayMin });
  }

  const now = new Date();
  const fromStr = searchParams.get('from') ?? new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const toStr   = searchParams.get('to')   ?? now.toISOString();

  // Touren in Zeitraum (location-gefiltert via Migration 010)
  const { data: tours } = await sb
    .from('mise_delivery_batches')
    .select('id, state, zone, dispatch_score, total_distance_km, total_eta_min, stop_count, created_at')
    .eq('location_id', locationId)
    .gte('created_at', fromStr)
    .lte('created_at', toStr)
    .not('state', 'eq', 'cancelled');

  // Bestellungen in Zeitraum
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, delivery_zone, dispatch_score, status, eta_earliest, eta_latest, created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('created_at', fromStr)
    .lte('created_at', toStr);

  // Scoring-Schnitt
  const { data: scores } = await sb
    .from('dispatch_scores')
    .select('total_score, decision')
    .eq('location_id', locationId)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);

  const totalOrders = orders?.length ?? 0;
  const delivered = orders?.filter((o) => o.status === 'abgeschlossen' || o.status === 'geliefert').length ?? 0;
  const zoneBreakdown = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    const z = (o.delivery_zone as string) ?? 'unknown';
    acc[z] = (acc[z] ?? 0) + 1;
    return acc;
  }, {});

  const avgScore = scores && scores.length > 0
    ? scores.reduce((s, r) => s + (r.total_score as number), 0) / scores.length
    : null;

  const avgDistKm = tours && tours.length > 0
    ? tours.reduce((s, t) => s + ((t.total_distance_km as number) ?? 0), 0) / tours.length
    : null;

  const bundled = scores?.filter((s) => s.decision === 'bundled').length ?? 0;
  const held    = scores?.filter((s) => s.decision === 'hold').length ?? 0;

  return NextResponse.json({
    period: { from: fromStr, to: toStr },
    orders: {
      total:     totalOrders,
      delivered,
      held,
      zone_breakdown: zoneBreakdown,
    },
    tours: {
      total:          tours?.length ?? 0,
      bundled_count:  bundled,
      avg_distance_km: avgDistKm != null ? Math.round(avgDistKm * 10) / 10 : null,
      avg_eta_min:    tours && tours.length > 0
        ? Math.round(tours.reduce((s, t) => s + ((t.total_eta_min as number) ?? 0), 0) / tours.length)
        : null,
    },
    scoring: {
      avg_score: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      total_decisions: scores?.length ?? 0,
    },
  });
}
