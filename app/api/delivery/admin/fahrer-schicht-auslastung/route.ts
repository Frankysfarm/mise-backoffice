import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const now = new Date();
    const nowIso = now.toISOString();

    // Active shifts for this location
    const { data: shifts, error } = await sb
      .from('driver_shifts')
      .select(`
        id, driver_id, planned_start, planned_end, actual_start, status,
        mise_drivers!driver_id(id, name, vehicle, state)
      `)
      .eq('location_id', locationId)
      .eq('status', 'active')
      .lte('actual_start', nowIso)
      .order('actual_start', { ascending: true });

    if (error) throw new Error(error.message);

    const activeShifts = shifts ?? [];

    // For each driver: count completed deliveries today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const driverIds = activeShifts.map((s) => s.driver_id as string);

    const deliveriesMap: Record<string, number> = {};
    if (driverIds.length > 0) {
      const { data: deliveries } = await sb
        .from('mise_delivery_batches')
        .select('driver_id')
        .in('driver_id', driverIds)
        .eq('location_id', locationId)
        .eq('state', 'delivered')
        .gte('completed_at', todayStart.toISOString());

      for (const d of deliveries ?? []) {
        const dId = d.driver_id as string;
        deliveriesMap[dId] = (deliveriesMap[dId] ?? 0) + 1;
      }
    }

    // Active tour count per driver
    const activeBatchMap: Record<string, number> = {};
    if (driverIds.length > 0) {
      const { data: activeBatches } = await sb
        .from('mise_delivery_batches')
        .select('driver_id')
        .in('driver_id', driverIds)
        .eq('location_id', locationId)
        .in('state', ['assigned', 'at_restaurant', 'on_the_way']);

      for (const b of activeBatches ?? []) {
        const dId = b.driver_id as string;
        activeBatchMap[dId] = (activeBatchMap[dId] ?? 0) + 1;
      }
    }

    const drivers = activeShifts.map((shift) => {
      const driver = (shift as Record<string, unknown>).mise_drivers as Record<string, unknown> | null;
      const plannedEnd = new Date(shift.planned_end as string);
      const actualStart = new Date(shift.actual_start as string);
      const totalDurationMin = (plannedEnd.getTime() - actualStart.getTime()) / 60_000;
      const elapsedMin = (now.getTime() - actualStart.getTime()) / 60_000;
      const remainingMin = Math.max(0, plannedEnd.getTime() - now.getTime()) / 60_000;
      const auslastungPct = totalDurationMin > 0 ? Math.min(100, Math.round((elapsedMin / totalDurationMin) * 100)) : 0;
      const deliveries = deliveriesMap[shift.driver_id as string] ?? 0;
      const activeTours = activeBatchMap[shift.driver_id as string] ?? 0;
      // Prognose: projected deliveries until shift end based on current rate
      const ratePerHour = elapsedMin > 0 ? (deliveries / elapsedMin) * 60 : 0;
      const projectedAdditional = Math.round(ratePerHour * (remainingMin / 60));

      return {
        shiftId: shift.id,
        driverId: shift.driver_id,
        driverName: driver?.name ?? 'Unbekannt',
        vehicle: driver?.vehicle ?? null,
        state: driver?.state ?? 'unknown',
        plannedStart: shift.planned_start,
        plannedEnd: shift.planned_end,
        actualStart: shift.actual_start,
        remainingMin: Math.round(remainingMin),
        auslastungPct,
        deliveriesToday: deliveries,
        activeTours,
        ratePerHour: Math.round(ratePerHour * 10) / 10,
        projectedTotal: deliveries + projectedAdditional,
      };
    });

    const totalAuslastung =
      drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + d.auslastungPct, 0) / drivers.length)
        : 0;

    const freiKapazitaet = drivers.filter((d) => d.activeTours === 0).length;

    return NextResponse.json({
      ok: true,
      locationId,
      capturedAt: nowIso,
      totalActiveDrivers: drivers.length,
      freiKapazitaet,
      avgAuslastungPct: totalAuslastung,
      drivers,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
