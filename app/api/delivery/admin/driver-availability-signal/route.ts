/**
 * POST /api/delivery/admin/driver-availability-signal
 * GET  /api/delivery/admin/driver-availability-signal?location_id=...
 *
 * Driver-Availability-Signal-API — Fahrer-Verfügbarkeits-Signale.
 * Phase 488
 *
 * Auth: admin (createClient)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SIGNALS = ['available', 'break', 'end'] as const;
type Signal = (typeof VALID_SIGNALS)[number];

type DriverState = 'available' | 'break' | 'offline';

const SIGNAL_TO_STATE: Record<Signal, DriverState> = {
  available: 'available',
  break:     'break',
  end:       'offline',
};

interface PostBody {
  driver_id: string;
  signal: Signal;
  note?: string;
  location_id?: string;
}

interface MiseDriverRow {
  id: string;
  name: string;
  location_id: string;
  state: string | null;
}

interface DriverSignalRow {
  id: string;
  driver_id: string;
  signal: string;
  created_at: string;
}

interface MiseDriverWithSignal {
  id: string;
  name: string;
  vehicle: string | null;
  state: string | null;
  location_id: string;
}

interface SignalRow {
  driver_id: string;
  signal: string;
  created_at: string;
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { driver_id, signal, note, location_id: bodyLocationId } = body;

  if (!driver_id) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }
  if (!VALID_SIGNALS.includes(signal as Signal)) {
    return NextResponse.json({ error: 'signal must be available, break, or end' }, { status: 400 });
  }

  const driverQuery = sb
    .from('mise_drivers')
    .select('id, name, location_id, state')
    .eq('id', driver_id);

  if (bodyLocationId) {
    driverQuery.eq('location_id', bodyLocationId);
  }

  const { data: driverData, error: driverError } = await driverQuery.single();

  if (driverError || !driverData) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  const driver = driverData as unknown as MiseDriverRow;
  const newState: DriverState = SIGNAL_TO_STATE[signal as Signal];

  const { error: updateError } = await sb
    .from('mise_drivers')
    .update({ state: newState })
    .eq('id', driver_id);

  if (updateError) {
    console.error('[driver-availability-signal POST] update error:', updateError);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }

  const { error: insertError } = await sb
    .from('driver_availability_signals')
    .insert({
      driver_id,
      location_id: driver.location_id,
      signal,
      note: note ?? null,
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error('[driver-availability-signal POST] insert error:', insertError);
    // Non-fatal — state was already updated
  }

  return NextResponse.json({ ok: true, state: newState, driver: { id: driver.id, name: driver.name } });
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const { data: driversData, error: driversError } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, state, location_id')
    .eq('location_id', locationId);

  if (driversError) {
    console.error('[driver-availability-signal GET] drivers error:', driversError);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }

  const drivers = (driversData ?? []) as unknown as MiseDriverWithSignal[];

  if (drivers.length === 0) {
    return NextResponse.json({ drivers: [] });
  }

  const driverIds = drivers.map((d) => d.id);

  // Get latest signal per driver
  const { data: signalsData } = await sb
    .from('driver_availability_signals')
    .select('driver_id, signal, created_at')
    .in('driver_id', driverIds)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  const signals = (signalsData ?? []) as unknown as SignalRow[];

  // Build map: latest signal per driver
  const latestSignalMap = new Map<string, SignalRow>();
  for (const sig of signals) {
    if (!latestSignalMap.has(sig.driver_id)) {
      latestSignalMap.set(sig.driver_id, sig);
    }
  }

  const result = drivers.map((d) => {
    const latest = latestSignalMap.get(d.id) ?? null;
    return {
      driverId:     d.id,
      driverName:   d.name,
      vehicle:      d.vehicle ?? null,
      state:        d.state ?? 'offline',
      lastSignal:   latest?.signal ?? null,
      lastSignalAt: latest?.created_at ?? null,
    };
  });

  return NextResponse.json({ drivers: result });
}
