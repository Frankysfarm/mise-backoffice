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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const vor30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active drivers today
    const { data: shifts } = await sb
      .from('driver_shifts')
      .select('driver_id, mise_drivers!driver_id(id, name, vehicle)')
      .eq('location_id', locationId)
      .eq('status', 'active');

    const activeShifts = shifts ?? [];
    const driverIds = activeShifts.map((s) => s.driver_id as string);

    if (driverIds.length === 0) {
      return NextResponse.json({ ok: true, locationId, drivers: [], capturedAt: now.toISOString() });
    }

    // Today's completed batches per driver
    const { data: todayBatches } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, completed_at, distance_km, tip_amount_eur')
      .in('driver_id', driverIds)
      .eq('location_id', locationId)
      .eq('state', 'delivered')
      .gte('completed_at', todayStart.toISOString());

    // Last 30 days batches per driver
    const { data: histBatches } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, completed_at, distance_km, tip_amount_eur')
      .in('driver_id', driverIds)
      .eq('location_id', locationId)
      .eq('state', 'delivered')
      .gte('completed_at', vor30d.toISOString())
      .lt('completed_at', todayStart.toISOString());

    const heute = todayBatches ?? [];
    const hist = histBatches ?? [];

    // Compute per driver
    const drivers = activeShifts.map((shift) => {
      const dId = shift.driver_id as string;
      const driverRec = (shift as Record<string, unknown>).mise_drivers as Record<string, unknown> | null;

      const todayList = heute.filter((b) => b.driver_id === dId);
      const histList = hist.filter((b) => b.driver_id === dId);

      // Group hist by day to compute daily avg
      const histDays = new Map<string, { touren: number; km: number; trinkgeld: number }>();
      for (const b of histList) {
        const day = b.completed_at ? b.completed_at.slice(0, 10) : 'unknown';
        const d = histDays.get(day) ?? { touren: 0, km: 0, trinkgeld: 0 };
        d.touren += 1;
        d.km += Number(b.distance_km ?? 0);
        d.trinkgeld += Number(b.tip_amount_eur ?? 0);
        histDays.set(day, d);
      }

      const numHistDays = histDays.size || 1;
      const histTotals = Array.from(histDays.values()).reduce(
        (acc, d) => ({ touren: acc.touren + d.touren, km: acc.km + d.km, trinkgeld: acc.trinkgeld + d.trinkgeld }),
        { touren: 0, km: 0, trinkgeld: 0 },
      );

      const schnitt = {
        touren: Math.round((histTotals.touren / numHistDays) * 10) / 10,
        km: Math.round((histTotals.km / numHistDays) * 10) / 10,
        trinkgeld: Math.round((histTotals.trinkgeld / numHistDays) * 100) / 100,
      };

      const heute30dAgg = {
        touren: todayList.length,
        km: Math.round(todayList.reduce((s, b) => s + Number(b.distance_km ?? 0), 0) * 10) / 10,
        trinkgeld: Math.round(todayList.reduce((s, b) => s + Number(b.tip_amount_eur ?? 0), 0) * 100) / 100,
      };

      const diff = {
        touren: Math.round((heute30dAgg.touren - schnitt.touren) * 10) / 10,
        km: Math.round((heute30dAgg.km - schnitt.km) * 10) / 10,
        trinkgeld: Math.round((heute30dAgg.trinkgeld - schnitt.trinkgeld) * 100) / 100,
      };

      return {
        driverId: dId,
        driverName: driverRec?.name ?? 'Unbekannt',
        vehicle: driverRec?.vehicle ?? null,
        heute: heute30dAgg,
        schnitt30d: schnitt,
        diff,
      };
    });

    return NextResponse.json({
      ok: true,
      locationId,
      drivers,
      capturedAt: now.toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
