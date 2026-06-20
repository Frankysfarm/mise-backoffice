/**
 * GET /api/delivery/admin/schicht-roi
 *
 * Echte Schicht-ROI-Daten für SchichtROIPanel:
 * - Umsatz pro Fahrer-Stunde (heute vs. 7d-Ø)
 * - Kosten pro Lieferung (heute vs. 7d-Ø)
 * - Netto-Marge in % (heute vs. 7d-Ø)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id || !['admin', 'manager', 'dispatcher'].includes(emp.rolle)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const paramLocation = req.nextUrl.searchParams.get('location_id');
  const locationId = paramLocation ?? emp.location_id;

  const svc = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  // 7-Tage-Fenster für Vergleich
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const [todayOrdersRes, todayShiftsRes, histOrdersRes, histShiftsRes] = await Promise.all([
    // Heute: abgeschlossene Lieferbestellungen
    svc.from('customer_orders')
      .select('gesamtbetrag, liefergebuehr')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen'])
      .gte('bestellt_am', todayStart.toISOString())
      .lte('bestellt_am', todayEnd.toISOString()),

    // Heute: aktive Schichten (zur Stunden-Schätzung)
    svc.from('driver_shifts')
      .select('planned_start, planned_end, base_wage_eur')
      .eq('location_id', locationId)
      .gte('planned_start', todayStart.toISOString())
      .lte('planned_start', todayEnd.toISOString()),

    // 7 Tage: Lieferbestellungen
    svc.from('customer_orders')
      .select('gesamtbetrag, liefergebuehr, bestellt_am')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen'])
      .gte('bestellt_am', sevenDaysAgo.toISOString())
      .lt('bestellt_am', todayStart.toISOString()),

    // 7 Tage: Schichten
    svc.from('driver_shifts')
      .select('planned_start, planned_end, base_wage_eur')
      .eq('location_id', locationId)
      .gte('planned_start', sevenDaysAgo.toISOString())
      .lt('planned_start', todayStart.toISOString()),
  ]);

  type OrderRow = { gesamtbetrag: number | null; liefergebuehr: number | null };
  type ShiftRow = { planned_start: string; planned_end: string; base_wage_eur: number | null };

  function calcMetrics(orders: OrderRow[], shifts: ShiftRow[], days: number) {
    const totalRevenue = orders.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
    const deliveryCount = orders.length;
    const deliveryCosts = orders.reduce((s, o) => s + Number(o.liefergebuehr ?? 0), 0);

    let totalDriverHours = 0;
    let totalWageCost = 0;
    for (const sh of shifts) {
      const start = new Date(sh.planned_start);
      const end = new Date(sh.planned_end);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
      totalDriverHours += hours;
      totalWageCost += hours * Number(sh.base_wage_eur ?? 12);
    }

    const avgPerDay = days > 0 ? totalDriverHours / days : totalDriverHours;
    const umsatzProFahrerStunde = avgPerDay > 0 ? totalRevenue / avgPerDay : 0;
    const kostenProLieferung = deliveryCount > 0
      ? (totalWageCost + deliveryCosts) / deliveryCount
      : 0;
    const totalCosts = totalWageCost + deliveryCosts;
    const nettoMargeProz = totalRevenue > 0
      ? Math.round(((totalRevenue - totalCosts) / totalRevenue) * 100)
      : 0;

    return { umsatzProFahrerStunde, kostenProLieferung, nettoMargeProz };
  }

  const todayOrders = (todayOrdersRes.data ?? []) as OrderRow[];
  const todayShifts = (todayShiftsRes.data ?? []) as ShiftRow[];
  const histOrders = (histOrdersRes.data ?? []) as OrderRow[];
  const histShifts = (histShiftsRes.data ?? []) as ShiftRow[];

  const today = calcMetrics(todayOrders, todayShifts, 1);
  const hist = calcMetrics(histOrders, histShifts, 7);

  return NextResponse.json({
    umsatzProFahrerStunde: Math.round(today.umsatzProFahrerStunde * 100) / 100,
    kostenProLieferung: Math.round(today.kostenProLieferung * 100) / 100,
    nettoMargeProz: today.nettoMargeProz,
    vergleichUmsatz7d: Math.round(hist.umsatzProFahrerStunde * 100) / 100,
    vergleichKosten7d: Math.round(hist.kostenProLieferung * 100) / 100,
    vergleichMarge7d: hist.nettoMargeProz,
  });
}
