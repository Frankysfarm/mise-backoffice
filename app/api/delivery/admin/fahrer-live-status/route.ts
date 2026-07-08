/**
 * GET /api/delivery/admin/fahrer-live-status?location_id=<uuid>
 *
 * Phase 641 — Fahrer-Live-Status-API
 * Liefert aktuellen GPS/Online-Status je aktivem Fahrer einer Location.
 *
 * Response: { fahrer: FahrerLiveStatus[], generiert_am: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface FahrerLiveStatus {
  driver_id: string;
  name: string;
  status: 'aktiv' | 'pausiert' | 'offline';
  letzte_gps_at: string | null;
  letzte_gps_min_vor: number | null;
  lat: number | null;
  lng: number | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: shifts, error: shiftErr } = await supabase
      .from('driver_shifts')
      .select('id, employee_id, status, started_at')
      .eq('location_id', locationId)
      .in('status', ['active', 'on_break'])
      .order('started_at', { ascending: false });

    if (shiftErr) throw shiftErr;

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ fahrer: [], generiert_am: new Date().toISOString() });
    }

    const employeeIds = [...new Set(shifts.map((s) => s.employee_id as string))];

    const { data: drivers, error: driverErr } = await supabase
      .from('mise_drivers')
      .select('id, employee_id, vorname, nachname, last_gps_at, last_lat, last_lng')
      .in('employee_id', employeeIds)
      .eq('location_id', locationId);

    if (driverErr) throw driverErr;

    const driverMap = new Map<string, (typeof drivers)[number]>();
    for (const d of drivers ?? []) {
      driverMap.set(d.employee_id as string, d);
    }

    const now = Date.now();

    const fahrer: FahrerLiveStatus[] = shifts.map((shift) => {
      const d = driverMap.get(shift.employee_id as string);
      const name = d
        ? `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer'
        : 'Fahrer';

      const lastGpsAt = (d?.last_gps_at as string | null) ?? null;
      const letzteGpsMinVor = lastGpsAt
        ? Math.round((now - new Date(lastGpsAt).getTime()) / 60_000)
        : null;

      const status: FahrerLiveStatus['status'] =
        shift.status === 'on_break'
          ? 'pausiert'
          : shift.status === 'active'
          ? 'aktiv'
          : 'offline';

      return {
        driver_id: (d?.id as string) ?? (shift.employee_id as string),
        name,
        status,
        letzte_gps_at: lastGpsAt,
        letzte_gps_min_vor: letzteGpsMinVor,
        lat: (d?.last_lat as number | null) ?? null,
        lng: (d?.last_lng as number | null) ?? null,
      };
    });

    return NextResponse.json({ fahrer, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('[fahrer-live-status]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
