/**
 * GET /api/delivery/dispatch/driver-matrix?location_id=...
 *
 * Liefert aktive Fahrer mit Status, Touren-Heute und Auslastung
 * für die Fahrer-Auslastungs-Matrix im Lieferdienst-Dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type FahrerStatus = 'Aktiv' | 'Pause' | 'Bereit';

export interface DriverMatrixEntry {
  id: string;
  name: string;
  initials: string;
  status: FahrerStatus;
  toursHeute: number;
  auslastung: number;
}

function deriveStatus(driverState: string, shiftStatus: string): FahrerStatus {
  if (driverState === 'available' && shiftStatus === 'active') return 'Bereit';
  if (driverState === 'on_break') return 'Pause';
  if (driverState === 'delivering' || driverState === 'at_restaurant') return 'Aktiv';
  if (shiftStatus === 'active') return 'Bereit';
  return 'Bereit';
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sbService = createServiceClient();
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();

    // Aktive Schichten + Fahrer-State laden
    const { data: shifts, error: shiftErr } = await sbService
      .from('driver_shifts')
      .select(`
        id, status, driver_id,
        mise_drivers!driver_id(id, name, state)
      `)
      .eq('location_id', locationId)
      .eq('status', 'active');

    if (shiftErr) throw new Error(shiftErr.message);

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ fahrer: [], generatedAt: now.toISOString() });
    }

    // Touren heute pro Fahrer zählen
    const driverIds = shifts.map((s) => s.driver_id as string);
    const { data: batchCounts } = await sbService
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart)
      .not('state', 'eq', 'cancelled');

    const toursPerDriver = new Map<string, number>();
    for (const b of batchCounts ?? []) {
      const dId = b.driver_id as string;
      toursPerDriver.set(dId, (toursPerDriver.get(dId) ?? 0) + 1);
    }

    // Max Touren für Auslastungs-Berechnung (Referenz: 8 Touren = 100%)
    const MAX_TOURS_PER_SHIFT = 8;

    type DriverShape = { id: string; name: string; state: string };
    const fahrer: DriverMatrixEntry[] = shifts.map((shift) => {
      const driverRaw = shift.mise_drivers;
      const driver: DriverShape | null = Array.isArray(driverRaw)
        ? ((driverRaw as unknown[])[0] as DriverShape ?? null)
        : (driverRaw as unknown as DriverShape | null);

      const driverId = shift.driver_id as string;
      const name = driver?.name ?? 'Fahrer';
      const toursHeute = toursPerDriver.get(driverId) ?? 0;
      const auslastung = Math.min(100, Math.round((toursHeute / MAX_TOURS_PER_SHIFT) * 100));
      const status = deriveStatus(driver?.state ?? '', shift.status as string);

      return {
        id: driverId,
        name,
        initials: makeInitials(name),
        status,
        toursHeute,
        auslastung,
      };
    });

    return NextResponse.json({ fahrer, generatedAt: now.toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
