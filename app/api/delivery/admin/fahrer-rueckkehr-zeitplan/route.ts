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

    // Active batches on route — estimate return based on remaining stops
    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select(`
        id, driver_id, state, created_at,
        stops:mise_delivery_batch_stops(id, sequence, completed_at, type),
        driver:mise_drivers!driver_id(id, name, vehicle)
      `)
      .eq('location_id', locationId)
      .in('state', ['on_route', 'at_restaurant', 'assigned']);

    const fahrer: Array<{
      driverId: string;
      name: string;
      vehicle: string;
      state: string;
      offeneStopps: number;
      geschaetzteRueckkehrMin: number;
      rueckkehrZeit: string;
    }> = [];

    for (const batch of batches ?? []) {
      const driver = (batch as any).driver;
      if (!driver) continue;

      const stops = (batch as any).stops ?? [];
      const offeneStopps = stops.filter(
        (s: any) => s.type === 'dropoff' && !s.completed_at,
      ).length;

      // Rough estimate: 8 min per remaining stop + 5 min return to base
      const remainingMin = offeneStopps * 8 + 5;
      const rueckkehrZeit = new Date(now.getTime() + remainingMin * 60_000);

      fahrer.push({
        driverId: driver.id,
        name: driver.name ?? 'Fahrer',
        vehicle: driver.vehicle ?? 'Auto',
        state: (batch as any).state,
        offeneStopps,
        geschaetzteRueckkehrMin: remainingMin,
        rueckkehrZeit: rueckkehrZeit.toISOString(),
      });
    }

    // Sort: soonest return first
    fahrer.sort((a, b) => a.geschaetzteRueckkehrMin - b.geschaetzteRueckkehrMin);

    return NextResponse.json({ ok: true, fahrer, generatedAt: now.toISOString() });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
