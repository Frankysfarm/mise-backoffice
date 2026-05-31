/**
 * GET  /api/delivery/admin/shifts?location_id=...&date=YYYY-MM-DD&status=...
 * POST /api/delivery/admin/shifts
 *
 * Schicht-Management: Schichten auflisten und erstellen.
 *
 * GET-Parameter:
 *   location_id  — Pflicht
 *   date         — Optional: YYYY-MM-DD, zeigt Schichten dieses Tages
 *   status       — Optional: scheduled|active|completed|missed|cancelled
 *   hours        — Optional (statt date): nächste N Stunden (default 24)
 *
 * POST-Body:
 *   {
 *     driver_id:     string (uuid)
 *     location_id:   string (uuid)
 *     planned_start: string (ISO)
 *     planned_end:   string (ISO)
 *     notes?:        string
 *   }
 *
 * Response GET:
 *   { shifts: ShiftRow[]; count: number }
 *
 * Response POST:
 *   { shift: ShiftRow }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getShiftsByDate, getUpcomingShifts } from '@/lib/delivery/shifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const dateStr  = searchParams.get('date');
  const statusFilter = searchParams.get('status');
  const hours    = Math.min(Math.max(Number(searchParams.get('hours') ?? 24), 1), 168);

  try {
    let shifts;

    if (dateStr) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Ungültiges Datum (erwartet: YYYY-MM-DD)' }, { status: 400 });
      }
      shifts = await getShiftsByDate(locationId, date);
    } else {
      shifts = await getUpcomingShifts(locationId, hours);
    }

    // Optional: Status-Filter clientseitig (View gibt bereits gefiltert zurück für upcoming)
    if (statusFilter) {
      shifts = shifts.filter((s) => s.status === statusFilter);
    }

    return NextResponse.json({ shifts, count: shifts.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: {
    driver_id: string;
    location_id: string;
    planned_start: string;
    planned_end: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { driver_id, location_id, planned_start, planned_end, notes } = body;
  if (!driver_id || !location_id || !planned_start || !planned_end) {
    return NextResponse.json(
      { error: 'driver_id, location_id, planned_start, planned_end sind Pflichtfelder' },
      { status: 400 },
    );
  }

  const startTs = new Date(planned_start);
  const endTs   = new Date(planned_end);
  if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
    return NextResponse.json({ error: 'Ungültige Zeitstempel' }, { status: 400 });
  }
  if (endTs <= startTs) {
    return NextResponse.json({ error: 'planned_end muss nach planned_start liegen' }, { status: 400 });
  }

  try {
    const svc = createServiceClient();
    const { data: shift, error } = await svc
      .from('driver_shifts')
      .insert({
        driver_id,
        location_id,
        planned_start: startTs.toISOString(),
        planned_end:   endTs.toISOString(),
        notes:         notes ?? null,
        created_by:    user.id,
      })
      .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at')
      .single();

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Fahrer oder Location nicht gefunden' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shift }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
