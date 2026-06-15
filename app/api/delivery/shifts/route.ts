/**
 * GET /api/delivery/shifts?action=current_stats
 *
 * Liefert Echtzeit-Schicht-KPIs für das LieferdienstStatsDashboard.
 * Auth: Employee-Session → tenant_id als location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Superadmin-Override via Query-Param
  const { searchParams } = new URL(req.url);
  const qParam = searchParams.get('location_id');
  if (qParam) return qParam;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.tenant_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? '';

  if (action !== 'current_stats') {
    return NextResponse.json(
      { error: 'Ungültige action. Erlaubt: current_stats' },
      { status: 400 },
    );
  }

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();

  // Schichtstart = heute Mitternacht UTC
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const shiftStartIso = todayStart.toISOString();

  const [ordersRes, driversRes] = await Promise.all([
    svc
      .from('customer_orders')
      .select('id, status, gesamtbetrag, created_at, eta_earliest, fertig_am')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', shiftStartIso),
    svc
      .from('mise_drivers')
      .select('id, state')
      .eq('location_id', locationId)
      .eq('active', true),
  ]);

  const orders = (ordersRes.data ?? []) as {
    id: string;
    status: string;
    gesamtbetrag: number | null;
    created_at: string;
    eta_earliest: string | null;
    fertig_am: string | null;
  }[];

  const drivers = (driversRes.data ?? []) as { id: string; state: string }[];

  const DONE_STATUSES = ['geliefert', 'storniert', 'abgeschlossen'];

  const delivered = orders.filter(o => o.status === 'geliefert');
  const pending   = orders.filter(o => !DONE_STATUSES.includes(o.status));

  const revenue = delivered.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
  const avgOrderValue = delivered.length > 0 ? revenue / delivered.length : 0;

  // Lieferzeit: von Bestelleingang bis Küche fertig (fertig_am)
  const deliveryTimes = delivered
    .filter(o => o.fertig_am)
    .map(o => (new Date(o.fertig_am!).getTime() - new Date(o.created_at).getTime()) / 60_000)
    .filter(t => t > 0 && t < 240); // Ausreißer ignorieren

  const avgDeliveryMin = deliveryTimes.length > 0
    ? deliveryTimes.reduce((s, t) => s + t, 0) / deliveryTimes.length
    : 0;

  // Pünktlichkeit: fertig_am ≤ eta_earliest
  const timedDeliveries = delivered.filter(o => o.fertig_am && o.eta_earliest);
  const onTimeCount = timedDeliveries.filter(
    o => new Date(o.fertig_am!).getTime() <= new Date(o.eta_earliest!).getTime(),
  ).length;
  const onTimeRatePct = timedDeliveries.length > 0
    ? (onTimeCount / timedDeliveries.length) * 100
    : 0;

  // Aktive Fahrer: auf Tour oder im Dispatch
  const activeDrivers = drivers.filter(d =>
    ['on_tour', 'dispatched', 'active'].includes(d.state),
  ).length;

  // Stunden-Buckets: letzte 6 Stunden
  const now = Date.now();
  const hourBuckets = Array.from({ length: 6 }, (_, i) => {
    const hStart = new Date(now - (5 - i) * 3_600_000);
    hStart.setMinutes(0, 0, 0);
    const hEnd = new Date(hStart.getTime() + 3_600_000);
    const label = `${String(hStart.getUTCHours()).padStart(2, '0')}:00`;

    const inHour = orders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= hStart.getTime() && t < hEnd.getTime();
    });

    return {
      hour: label,
      orders: inHour.length,
      revenue: inHour
        .filter(o => o.status === 'geliefert')
        .reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0),
    };
  });

  return NextResponse.json({
    revenue,
    orders: orders.length,
    avgOrderValue,
    deliveries: delivered.length,
    avgDeliveryMin,
    onTimeRatePct,
    pendingOrders: pending.length,
    activeDrivers,
    hourBuckets,
  });
}
