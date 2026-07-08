/**
 * GET /api/delivery/stats/heute
 * Heutige Liefer-KPIs vs. gestern — für LieferdienstPhase813StatistikenKompaktHub.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const paramId = req.nextUrl.searchParams.get('location_id');
  if (paramId) return paramId;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const validRoles = ['admin', 'manager', 'dispatcher'];
  if (!emp?.location_id || !validRoles.includes(emp.rolle as string)) return null;
  return emp.location_id as string;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);

  const [
    { data: todayOrders },
    { data: yesterdayOrders },
    { data: todayLifecycles },
    { data: yesterdayLifecycles },
    { data: activeBatches },
  ] = await Promise.all([
    sb.from('customer_orders')
      .select('id, status, gesamtpreis')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString()),
    sb.from('customer_orders')
      .select('id, status, gesamtpreis')
      .eq('location_id', locationId)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', yesterdayEnd.toISOString()),
    sb.from('order_lifecycle_snapshots')
      .select('on_time, total_min')
      .eq('location_id', locationId)
      .gte('snapped_at', todayStart.toISOString()),
    sb.from('order_lifecycle_snapshots')
      .select('on_time, total_min')
      .eq('location_id', locationId)
      .gte('snapped_at', yesterdayStart.toISOString())
      .lt('snapped_at', yesterdayEnd.toISOString()),
    sb.from('mise_delivery_batches')
      .select('fahrer_id')
      .eq('location_id', locationId)
      .in('state', ['active', 'assigned']),
  ]);

  function calcStats(orders: typeof todayOrders, lifecycles: typeof todayLifecycles) {
    const all = orders ?? [];
    const cancelled = all.filter((o) =>
      (o.status as string) === 'storniert' || (o.status as string) === 'abgebrochen'
    );
    const bestellungen = all.length;
    const umsatz = Math.round(
      all
        .filter((o) => !['storniert', 'abgebrochen'].includes(o.status as string))
        .reduce((s, o) => s + ((o.gesamtpreis as number) ?? 0), 0) * 100
    ) / 100;
    const storno_rate = bestellungen > 0
      ? Math.round((cancelled.length / bestellungen) * 1000) / 10
      : 0;

    const lc = lifecycles ?? [];
    const withTime = lc.filter((r) => r.total_min != null);
    const lieferzeit = withTime.length > 0
      ? Math.round(withTime.reduce((s, r) => s + (r.total_min as number), 0) / withTime.length)
      : 0;
    const onTimeRows = lc.filter((r) => r.on_time !== null);
    const puenktlichkeit = onTimeRows.length > 0
      ? Math.round(onTimeRows.filter((r) => r.on_time === true).length / onTimeRows.length * 100)
      : 0;

    return { bestellungen, umsatz, storno_rate, lieferzeit, puenktlichkeit };
  }

  const today = calcStats(todayOrders, todayLifecycles);
  const gestern = calcStats(yesterdayOrders, yesterdayLifecycles);

  const fahrer_online = new Set(
    (activeBatches ?? []).map((b) => b.fahrer_id).filter(Boolean)
  ).size;

  return NextResponse.json({
    bestellungen: today.bestellungen,
    bestellungen_gestern: gestern.bestellungen,
    lieferzeit: today.lieferzeit,
    lieferzeit_gestern: gestern.lieferzeit,
    puenktlichkeit: today.puenktlichkeit,
    puenktlichkeit_gestern: gestern.puenktlichkeit,
    fahrer_online,
    umsatz: today.umsatz,
    umsatz_gestern: gestern.umsatz,
    storno_rate: today.storno_rate,
    storno_rate_gestern: gestern.storno_rate,
  });
}
