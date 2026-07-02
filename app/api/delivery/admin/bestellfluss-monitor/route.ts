/**
 * GET /api/delivery/admin/bestellfluss-monitor
 *
 * Echtzeit-Bestellfluss-Monitor: Aktuelle Bestellrate vs. Fahrerkapazität.
 * Phase 517
 *
 * Query: ?location_id=<uuid>
 * Response: { ok, currentRatePerHour, capacityPerHour, utilizationPct, alertLevel, history }
 *   alertLevel: 'ok' | 'busy' | 'critical'
 *   history: letzte 6×10-Min-Buckets mit Bestellanzahl
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AlertLevel = 'ok' | 'busy' | 'critical';

export interface BestellflussHistorySlot {
  label: string;     // HH:MM
  count: number;
}

export interface BestellflussMonitorResponse {
  ok: boolean;
  currentRatePerHour: number;
  capacityPerHour: number;
  utilizationPct: number;
  alertLevel: AlertLevel;
  onlineDrivers: number;
  history: BestellflussHistorySlot[];
  generatedAt: string;
}

const DRIVER_THROUGHPUT = 3; // Ø Bestellungen/Fahrer/Stunde

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();
    const since1h = new Date(now.getTime() - 60 * 60_000).toISOString();
    const since5min = new Date(now.getTime() - 5 * 60_000).toISOString();

    // Aktive Fahrer: GPS-Events der letzten 5 Min
    const { data: gpsRows } = await svc
      .from('driver_gps_events')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('recorded_at', since5min);

    const onlineDrivers = new Set(
      ((gpsRows as { driver_id: string }[] | null) ?? []).map((r) => r.driver_id)
    ).size;

    // Bestellungen letzte 60 Min (für Rate)
    const { data: recentOrders } = await svc
      .from('orders')
      .select('id, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since1h);

    const currentRatePerHour = (recentOrders as unknown[] | null)?.length ?? 0;

    // History: 6×10-Min-Buckets
    const history: BestellflussHistorySlot[] = [];
    for (let i = 5; i >= 0; i--) {
      const slotEnd = new Date(now.getTime() - i * 10 * 60_000);
      const slotStart = new Date(slotEnd.getTime() - 10 * 60_000);
      const label = `${String(slotStart.getUTCHours()).padStart(2, '0')}:${String(slotStart.getUTCMinutes()).padStart(2, '0')}`;
      const count = ((recentOrders as { created_at: string }[] | null) ?? [])
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= slotStart.getTime() && t < slotEnd.getTime();
        }).length;
      history.push({ label, count });
    }

    const capacityPerHour = Math.max(onlineDrivers * DRIVER_THROUGHPUT, 1);
    const utilizationPct = Math.round((currentRatePerHour / capacityPerHour) * 100);

    let alertLevel: AlertLevel = 'ok';
    if (utilizationPct >= 100) alertLevel = 'critical';
    else if (utilizationPct >= 80) alertLevel = 'busy';

    return NextResponse.json<BestellflussMonitorResponse>({
      ok: true,
      currentRatePerHour,
      capacityPerHour,
      utilizationPct,
      alertLevel,
      onlineDrivers,
      history,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('[bestellfluss-monitor]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
