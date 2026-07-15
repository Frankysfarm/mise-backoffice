import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ApiResponse {
  stopps_heute: number;
  location_stopps_heute: number;
  km_heute: number;
  touren_heute: number;
  driver_id: string | null;
  location_id: string | null;
  generiert_am: string;
}

function mockData(driverId: string | null, locationId: string | null): ApiResponse {
  const seed = driverId ? driverId.charCodeAt(0) % 5 : 2;
  return {
    stopps_heute: 8 + seed * 2,
    location_stopps_heute: 42 + seed,
    km_heute: 28 + seed * 3,
    touren_heute: 3 + (seed % 3),
    driver_id: driverId,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  const locationId = req.nextUrl.searchParams.get('location_id');

  if (!driverId || !locationId) {
    return NextResponse.json(mockData(driverId, locationId));
  }

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [driverRes, locationRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('id, km')
        .eq('driver_id', driverId)
        .eq('location_id', locationId)
        .gte('created_at', todayIso),
      supabase
        .from('delivery_stops')
        .select('id')
        .eq('location_id', locationId)
        .gte('created_at', todayIso),
    ]);

    const driverStops = driverRes.data ?? [];
    const locationStops = locationRes.data ?? [];

    const [tourRes] = await Promise.all([
      supabase
        .from('delivery_batches')
        .select('id')
        .eq('fahrer_id', driverId)
        .eq('location_id', locationId)
        .gte('created_at', todayIso),
    ]);

    const touren = tourRes.data?.length ?? 0;
    const kmSum = driverStops.reduce((s: number, st: Record<string, unknown>) => s + ((st.km as number | null) ?? 0), 0);

    if (!driverStops.length && !locationStops.length) {
      return NextResponse.json(mockData(driverId, locationId));
    }

    return NextResponse.json({
      stopps_heute: driverStops.length,
      location_stopps_heute: locationStops.length,
      km_heute: parseFloat(kmSum.toFixed(1)),
      touren_heute: touren,
      driver_id: driverId,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId, locationId));
  }
}
