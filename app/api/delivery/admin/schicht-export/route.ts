/**
 * GET /api/delivery/admin/schicht-export
 *
 * Schicht-Abschluss-Bericht-Generator
 * Params: location_id, date (YYYY-MM-DD, default today), format=json|csv
 *
 * Response (JSON): SchichtExportReport
 * Response (CSV):  text/csv attachment
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DriverKpi {
  driver_id: string;
  driver_name: string;
  deliveries: number;
  avg_delivery_min: number | null;
  on_time_pct: number | null;
  total_tips_eur: number;
}

interface SchichtExportReport {
  location_id: string;
  date: string;
  generated_at: string;
  summary: {
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue_eur: number;
    avg_delivery_min: number | null;
    punctuality_pct: number | null;
    active_drivers: number;
    cancellation_rate_pct: number | null;
  };
  drivers: DriverKpi[];
  hourly: { hour: number; orders: number; revenue_eur: number }[];
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  let locationId = params.get('location_id');
  const format = params.get('format') ?? 'json';

  const dateParam = params.get('date');
  const date = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  if (!locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .single();
    locationId = (emp?.location_id as string | null) ?? null;
  }

  if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 400 });

  // Fetch all orders for the day
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, gesamtpreis, bestellt_am, geliefert_am, geschaetzte_lieferzeit_min, trinkgeld_eur')
    .eq('location_id', locationId)
    .gte('bestellt_am', dayStart)
    .lte('bestellt_am', dayEnd);

  const allOrders = orders ?? [];
  const completed = allOrders.filter((o) => o.status === 'geliefert');
  const cancelled = allOrders.filter((o) => ['storniert', 'cancelled'].includes(o.status as string));

  // Revenue
  const totalRevenue = allOrders
    .filter((o) => !['storniert', 'cancelled'].includes(o.status as string))
    .reduce((sum, o) => sum + (Number(o.gesamtpreis) || 0), 0);

  // Avg delivery time for completed orders with both timestamps
  const withDeliveryTime = completed.filter((o) => o.bestellt_am && o.geliefert_am);
  const avgDeliveryMin = withDeliveryTime.length > 0
    ? withDeliveryTime.reduce((sum, o) => {
        const diff = (new Date(o.geliefert_am as string).getTime() - new Date(o.bestellt_am as string).getTime()) / 60_000;
        return sum + diff;
      }, 0) / withDeliveryTime.length
    : null;

  // Punctuality: orders delivered within estimated time
  const withEstimate = withDeliveryTime.filter((o) => o.geschaetzte_lieferzeit_min);
  const onTime = withEstimate.filter((o) => {
    const actualMin = (new Date(o.geliefert_am as string).getTime() - new Date(o.bestellt_am as string).getTime()) / 60_000;
    return actualMin <= (Number(o.geschaetzte_lieferzeit_min) + 5);
  });
  const punctualityPct = withEstimate.length > 0 ? (onTime.length / withEstimate.length) * 100 : null;

  // Cancellation rate
  const cancellationPct = allOrders.length > 0 ? (cancelled.length / allOrders.length) * 100 : null;

  // Hourly distribution
  const hourlyMap = new Map<number, { orders: number; revenue: number }>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { orders: 0, revenue: 0 });
  for (const o of allOrders) {
    if (!o.bestellt_am) continue;
    const hour = new Date(o.bestellt_am as string).getUTCHours();
    const entry = hourlyMap.get(hour) ?? { orders: 0, revenue: 0 };
    entry.orders++;
    if (!['storniert', 'cancelled'].includes(o.status as string)) {
      entry.revenue += Number(o.gesamtpreis) || 0;
    }
    hourlyMap.set(hour, entry);
  }
  const hourly = Array.from(hourlyMap.entries())
    .map(([hour, v]) => ({ hour, orders: v.orders, revenue_eur: Math.round(v.revenue * 100) / 100 }))
    .filter((h) => h.orders > 0);

  // Driver KPIs from driver_shifts + delivery_batches
  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('driver_id, drivers(name)')
    .eq('location_id', locationId)
    .gte('started_at', dayStart)
    .lte('started_at', dayEnd);

  const driverIds = [...new Set((shifts ?? []).map((s) => s.driver_id as string))];

  const driverKpis: DriverKpi[] = [];
  for (const driverId of driverIds) {
    const shift = shifts?.find((s) => s.driver_id === driverId);
    const driverName = (shift?.drivers as unknown as { name: string } | null)?.name ?? driverId.slice(0, 8);

    // Count completed deliveries by this driver
    const { data: dBatches } = await sb
      .from('delivery_batches')
      .select('id')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .eq('status', 'abgeschlossen')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);

    const deliveries = dBatches?.length ?? 0;

    // Tips
    const { data: tips } = await sb
      .from('driver_tips')
      .select('amount_eur')
      .eq('driver_id', driverId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);

    const totalTips = (tips ?? []).reduce((sum, t) => sum + (Number(t.amount_eur) || 0), 0);

    driverKpis.push({
      driver_id: driverId,
      driver_name: driverName,
      deliveries,
      avg_delivery_min: avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
      on_time_pct: punctualityPct !== null ? Math.round(punctualityPct * 10) / 10 : null,
      total_tips_eur: Math.round(totalTips * 100) / 100,
    });
  }

  const report: SchichtExportReport = {
    location_id: locationId,
    date,
    generated_at: new Date().toISOString(),
    summary: {
      total_orders: allOrders.length,
      completed_orders: completed.length,
      cancelled_orders: cancelled.length,
      total_revenue_eur: Math.round(totalRevenue * 100) / 100,
      avg_delivery_min: avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
      punctuality_pct: punctualityPct !== null ? Math.round(punctualityPct * 10) / 10 : null,
      active_drivers: driverIds.length,
      cancellation_rate_pct: cancellationPct !== null ? Math.round(cancellationPct * 10) / 10 : null,
    },
    drivers: driverKpis.sort((a, b) => b.deliveries - a.deliveries),
    hourly,
  };

  if (format === 'csv') {
    const lines: string[] = [
      '# Mise Schicht-Abschluss-Bericht',
      `# Datum: ${date} | Generiert: ${report.generated_at}`,
      '',
      '## Zusammenfassung',
      'Metrik,Wert',
      `Gesamt-Bestellungen,${report.summary.total_orders}`,
      `Abgeschlossen,${report.summary.completed_orders}`,
      `Storniert,${report.summary.cancelled_orders}`,
      `Umsatz (EUR),${report.summary.total_revenue_eur.toFixed(2)}`,
      `Ø Lieferzeit (Min),${report.summary.avg_delivery_min ?? 'N/A'}`,
      `Pünktlichkeit (%),${report.summary.punctuality_pct ?? 'N/A'}`,
      `Aktive Fahrer,${report.summary.active_drivers}`,
      `Stornoquote (%),${report.summary.cancellation_rate_pct ?? 'N/A'}`,
      '',
      '## Fahrer-KPIs',
      'Fahrer,Lieferungen,Ø Lieferzeit (Min),Pünktlichkeit (%),Trinkgeld (EUR)',
      ...report.drivers.map((d) =>
        `${d.driver_name},${d.deliveries},${d.avg_delivery_min ?? 'N/A'},${d.on_time_pct ?? 'N/A'},${d.total_tips_eur.toFixed(2)}`,
      ),
      '',
      '## Stündliche Verteilung',
      'Stunde,Bestellungen,Umsatz (EUR)',
      ...report.hourly.map((h) =>
        `${String(h.hour).padStart(2, '0')}:00,${h.orders},${h.revenue_eur.toFixed(2)}`,
      ),
    ];

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="schicht-bericht-${date}.csv"`,
      },
    });
  }

  return NextResponse.json(report);
}
