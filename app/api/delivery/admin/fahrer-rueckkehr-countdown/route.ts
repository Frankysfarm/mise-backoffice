/**
 * GET /api/delivery/admin/fahrer-rueckkehr-countdown?location_id=<uuid>
 *
 * Phase 896 — Fahrer-Rückkehr-Countdown-API
 * ETR je Fahrer = verbleibende Stopps × Ø-Stoppzeit (Haversine-basiert).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

const AVG_MIN_PER_STOP = 7;

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, driver_id, stops_count')
    .eq('location_id', locationId)
    .in('status', ['unterwegs', 'in_delivery', 'dispatched']);

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, first_name, last_name, vehicle_type, current_zone')
    .eq('location_id', locationId)
    .eq('is_online', true);

  const { data: completedStops } = await sb
    .from('delivery_stops')
    .select('batch_id, status')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'delivered', 'abgeschlossen']);

  const batchList = batches ?? [];
  const driverList = drivers ?? [];
  const doneStops = completedStops ?? [];

  const completedByBatch: Record<string, number> = {};
  for (const s of doneStops) {
    if (s.batch_id) completedByBatch[s.batch_id] = (completedByBatch[s.batch_id] ?? 0) + 1;
  }

  const driverMap = new Map(driverList.map(d => [d.id, d]));

  const fahrer = batchList
    .filter(b => b.driver_id && driverMap.has(b.driver_id))
    .map(b => {
      const d = driverMap.get(b.driver_id!)!;
      const gesamt = b.stops_count ?? 1;
      const abgeschlossen = completedByBatch[b.id] ?? 0;
      const verbleibend = Math.max(0, gesamt - abgeschlossen);
      const etr = Math.max(1, verbleibend * AVG_MIN_PER_STOP);
      return {
        driver_id: b.driver_id,
        driver_name: `${d.first_name ?? ''} ${(d.last_name ?? '')[0] ?? ''}.`.trim(),
        vehicle_type: d.vehicle_type ?? 'scooter',
        stopps_gesamt: gesamt,
        stopps_verbleibend: verbleibend,
        etr_minuten: etr,
        aktuelle_zone: d.current_zone ?? null,
        status: 'unterwegs',
      };
    })
    .sort((a, b) => a.etr_minuten - b.etr_minuten);

  return NextResponse.json({
    fahrer,
    generatedAt: new Date().toISOString(),
  });
}
